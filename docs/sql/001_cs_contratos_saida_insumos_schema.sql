-- DESCONTINUADO / DESCONSIDERAR
-- Este script foi substituido pela estrategia de compatibilidade legado.
-- Base atual: docs/sql/002_contrato_legado_pg.sql
-- Mantido apenas para historico.
--
-- Captar Suite - Modulo Negociacoes e Contratos
-- Modelo inicial para "Contrato de Saida de Insumos"
-- Banco alvo: PostgreSQL

BEGIN;

-- ==========================================================
-- Cadastros base
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_empresa (
  id serial PRIMARY KEY,
  codigo varchar(30) NOT NULL UNIQUE,
  nome varchar(180) NOT NULL,
  cnpj varchar(18),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contrato.cs_parceiro (
  id serial PRIMARY KEY,
  codigo varchar(30) UNIQUE,
  nome varchar(180) NOT NULL,
  documento varchar(18),
  tipo_pessoa varchar(10) NOT NULL DEFAULT 'juridica',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_parceiro_tipo_pessoa_check CHECK (tipo_pessoa IN ('fisica', 'juridica'))
);

CREATE INDEX IF NOT EXISTS idx_cs_parceiro_nome ON contrato.cs_parceiro (nome);

-- ==========================================================
-- Numeracao por exercicio/tipo/empresa
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_numeracao (
  empresa_id integer NOT NULL REFERENCES contrato.cs_empresa(id) ON DELETE CASCADE,
  tipo_contrato varchar(30) NOT NULL,
  exercicio integer NOT NULL CHECK (exercicio BETWEEN 2000 AND 2100),
  ultimo_numero integer NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
  atualizado_em timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, tipo_contrato, exercicio),
  CONSTRAINT cs_contrato_numeracao_tipo_check CHECK (
    tipo_contrato IN ('saida_insumos', 'entrada_insumos', 'saida_animais', 'entrada_animais')
  )
);

CREATE OR REPLACE FUNCTION contrato.cs_next_numero_contrato(
  p_empresa_id integer,
  p_tipo_contrato varchar,
  p_exercicio integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero integer;
BEGIN
  INSERT INTO contrato.cs_contrato_numeracao (
    empresa_id,
    tipo_contrato,
    exercicio,
    ultimo_numero,
    atualizado_em
  )
  VALUES (p_empresa_id, p_tipo_contrato, p_exercicio, 1, now())
  ON CONFLICT (empresa_id, tipo_contrato, exercicio)
  DO UPDATE
    SET ultimo_numero = contrato.cs_contrato_numeracao.ultimo_numero + 1,
        atualizado_em = now()
  RETURNING ultimo_numero INTO v_numero;

  RETURN v_numero;
END;
$$;

-- ==========================================================
-- Contrato principal (aba Dados Basicos + Informacoes Legais)
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato (
  id bigserial PRIMARY KEY,
  empresa_id integer NOT NULL REFERENCES contrato.cs_empresa(id) ON DELETE RESTRICT,
  parceiro_id integer REFERENCES contrato.cs_parceiro(id) ON DELETE RESTRICT,

  -- Snapshot do parceiro para preservar historico no contrato
  parceiro_codigo_snapshot varchar(30),
  parceiro_nome_snapshot varchar(180),
  parceiro_documento_snapshot varchar(18),

  tipo_contrato varchar(30) NOT NULL DEFAULT 'saida_insumos',
  exercicio integer NOT NULL CHECK (exercicio BETWEEN 2000 AND 2100),
  numero integer NOT NULL CHECK (numero > 0),

  referencia_contrato varchar(350) NOT NULL,
  ref_object_id varchar(60),
  status varchar(30) NOT NULL DEFAULT 'aguardando_aprovacao',

  assinatura_em date,
  prazo_entrega_em date,
  inicio_em date,
  vencimento_em date,

  permuta boolean NOT NULL DEFAULT false,
  contrato_permuta_id bigint REFERENCES contrato.cs_contrato(id) ON DELETE SET NULL,

  aditivo boolean NOT NULL DEFAULT false,
  tipo_aditivo varchar(20) NOT NULL DEFAULT 'nenhum',
  contrato_cedente_id bigint REFERENCES contrato.cs_contrato(id) ON DELETE SET NULL,
  contrato_anterior_id bigint REFERENCES contrato.cs_contrato(id) ON DELETE SET NULL,

  valor numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  valor_mao_obra numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_mao_obra >= 0),

  responsavel_frete varchar(20) NOT NULL DEFAULT 'empresa',
  calculo_frete varchar(20) NOT NULL DEFAULT 'fixo',
  valor_unitario_frete numeric(14,4) NOT NULL DEFAULT 0 CHECK (valor_unitario_frete >= 0),

  emissor_nota varchar(20) NOT NULL DEFAULT 'empresa',
  assinatura_parceiro varchar(80),
  assinatura_empresa varchar(80),

  comissionado_tipo varchar(20) NOT NULL DEFAULT 'nao_aplica',
  comissionado_nome varchar(150),
  valor_comissao numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_comissao >= 0),

  responsavel_juridico_nome varchar(150),
  testemunha_1_nome varchar(150),
  testemunha_1_cpf varchar(14),
  testemunha_2_nome varchar(150),
  testemunha_2_cpf varchar(14),

  objeto text,
  execucao text,
  observacoes text,

  -- Aba SAP B1 / lista
  sap_doc_entry integer,
  sap_doc_num integer,
  sap_valor_pago numeric(14,2) NOT NULL DEFAULT 0 CHECK (sap_valor_pago >= 0),
  sap_ultimo_sync_em timestamp without time zone,

  criado_por varchar(80),
  atualizado_por varchar(80),
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp without time zone NOT NULL DEFAULT now(),

  CONSTRAINT cs_contrato_tipo_check CHECK (
    tipo_contrato IN ('saida_insumos', 'entrada_insumos', 'saida_animais', 'entrada_animais')
  ),
  CONSTRAINT cs_contrato_status_check CHECK (
    status IN ('aguardando_aprovacao', 'ativo', 'contendo_parc', 'encerrado', 'inativo_cancelado')
  ),
  CONSTRAINT cs_contrato_tipo_aditivo_check CHECK (
    tipo_aditivo IN ('nenhum', 'valor', 'prazo', 'quantidade', 'misto')
  ),
  CONSTRAINT cs_contrato_responsavel_frete_check CHECK (
    responsavel_frete IN ('empresa', 'parceiro', 'terceiro')
  ),
  CONSTRAINT cs_contrato_calculo_frete_check CHECK (
    calculo_frete IN ('fixo', 'por_tonelada', 'por_unidade', 'por_km', 'sem_frete')
  ),
  CONSTRAINT cs_contrato_emissor_nota_check CHECK (
    emissor_nota IN ('empresa', 'parceiro', 'terceiro')
  ),
  CONSTRAINT cs_contrato_comissionado_tipo_check CHECK (
    comissionado_tipo IN ('nao_aplica', 'interno', 'parceiro', 'corretor')
  ),
  CONSTRAINT cs_contrato_uniq_numero UNIQUE (empresa_id, tipo_contrato, exercicio, numero)
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_lista ON contrato.cs_contrato (tipo_contrato, status, exercicio DESC, numero DESC);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_parceiro ON contrato.cs_contrato (parceiro_id);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_inicio_vencimento ON contrato.cs_contrato (inicio_em, vencimento_em);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_referencia ON contrato.cs_contrato (referencia_contrato);

CREATE OR REPLACE FUNCTION contrato.cs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cs_contrato_set_updated_at ON contrato.cs_contrato;
CREATE TRIGGER trg_cs_contrato_set_updated_at
BEFORE UPDATE ON contrato.cs_contrato
FOR EACH ROW
EXECUTE FUNCTION contrato.cs_set_updated_at();

-- ==========================================================
-- Aba Itens
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_item_insumo (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  sequencia integer NOT NULL CHECK (sequencia > 0),
  codigo_insumo varchar(60),
  descricao varchar(220) NOT NULL,
  unidade varchar(20) NOT NULL DEFAULT 'TON',
  quantidade numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  valor_unitario numeric(14,4) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  valor_desconto numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_desconto >= 0),
  valor_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  observacao text,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_item_uniq_seq UNIQUE (contrato_id, sequencia)
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_item_contrato ON contrato.cs_contrato_item_insumo (contrato_id);

-- ==========================================================
-- Aba Frete
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_frete (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  sequencia integer NOT NULL CHECK (sequencia > 0),
  origem varchar(180),
  destino varchar(180),
  descricao varchar(220),
  quantidade numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  unidade varchar(20) NOT NULL DEFAULT 'TON',
  valor_unitario numeric(14,4) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  valor_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  responsavel_frete varchar(20) NOT NULL DEFAULT 'empresa',
  observacao text,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_frete_responsavel_check CHECK (
    responsavel_frete IN ('empresa', 'parceiro', 'terceiro')
  ),
  CONSTRAINT cs_contrato_frete_uniq_seq UNIQUE (contrato_id, sequencia)
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_frete_contrato ON contrato.cs_contrato_frete (contrato_id);

-- ==========================================================
-- Aba Financeiro
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_financeiro_parcela (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  parcela integer NOT NULL CHECK (parcela > 0),
  tipo_lancamento varchar(20) NOT NULL DEFAULT 'receber',
  vencimento_em date NOT NULL,
  valor_previsto numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_previsto >= 0),
  valor_pago numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
  desconto numeric(14,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  acrescimo numeric(14,2) NOT NULL DEFAULT 0 CHECK (acrescimo >= 0),
  forma_pagamento varchar(40),
  status varchar(20) NOT NULL DEFAULT 'aberto',
  documento_referencia varchar(60),
  observacao text,
  pago_em date,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_financeiro_tipo_check CHECK (tipo_lancamento IN ('receber', 'pagar')),
  CONSTRAINT cs_contrato_financeiro_status_check CHECK (status IN ('aberto', 'parcial', 'pago', 'cancelado')),
  CONSTRAINT cs_contrato_financeiro_uniq_parcela UNIQUE (contrato_id, parcela, tipo_lancamento)
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_financeiro_contrato ON contrato.cs_contrato_financeiro_parcela (contrato_id);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_financeiro_vencimento ON contrato.cs_contrato_financeiro_parcela (vencimento_em, status);

-- ==========================================================
-- Aba Notas
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_nota (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  tipo_nota varchar(20) NOT NULL DEFAULT 'saida',
  numero varchar(30),
  serie varchar(10),
  emissao_em date,
  chave_nfe varchar(44),
  valor_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  valor_pago_sap numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_pago_sap >= 0),
  sap_doc_entry integer,
  sap_doc_num integer,
  observacao text,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_nota_tipo_check CHECK (tipo_nota IN ('saida', 'entrada', 'servico', 'ajuste', 'outro'))
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_nota_contrato ON contrato.cs_contrato_nota (contrato_id);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_cs_contrato_nota_chave_nfe
  ON contrato.cs_contrato_nota (chave_nfe)
  WHERE chave_nfe IS NOT NULL;

-- ==========================================================
-- Aba Clausulas
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_clausula (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  ordem integer NOT NULL CHECK (ordem > 0),
  titulo varchar(160),
  conteudo text NOT NULL,
  obrigatoria boolean NOT NULL DEFAULT false,
  ativa boolean NOT NULL DEFAULT true,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_clausula_uniq_ordem UNIQUE (contrato_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_clausula_contrato ON contrato.cs_contrato_clausula (contrato_id);

-- ==========================================================
-- Aba Previsoes
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_previsao (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  tipo_evento varchar(30) NOT NULL,
  previsto_em date NOT NULL,
  quantidade_prevista numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantidade_prevista >= 0),
  unidade varchar(20),
  valor_previsto numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_previsto >= 0),
  status varchar(20) NOT NULL DEFAULT 'previsto',
  observacao text,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_previsao_tipo_check CHECK (
    tipo_evento IN ('entrega_insumo', 'retirada_insumo', 'pagamento', 'faturamento', 'outro')
  ),
  CONSTRAINT cs_contrato_previsao_status_check CHECK (
    status IN ('previsto', 'realizado', 'cancelado')
  )
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_previsao_contrato ON contrato.cs_contrato_previsao (contrato_id);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_previsao_data ON contrato.cs_contrato_previsao (previsto_em, status);

-- ==========================================================
-- Aba Entrada/Saida de Insumos + dados para GTA
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_movimento_insumo (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  item_id bigint REFERENCES contrato.cs_contrato_item_insumo(id) ON DELETE SET NULL,
  tipo_movimento varchar(10) NOT NULL,
  data_movimento date NOT NULL,
  codigo_insumo varchar(60),
  descricao_insumo varchar(220),
  quantidade numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  unidade varchar(20) NOT NULL DEFAULT 'TON',
  local_origem varchar(180),
  local_destino varchar(180),
  documento_referencia varchar(60),
  gta_numero varchar(40),
  gta_serie varchar(20),
  observacao text,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_movimento_tipo_check CHECK (tipo_movimento IN ('entrada', 'saida'))
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_movimento_contrato ON contrato.cs_contrato_movimento_insumo (contrato_id);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_movimento_data ON contrato.cs_contrato_movimento_insumo (data_movimento);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_movimento_gta ON contrato.cs_contrato_movimento_insumo (gta_numero);

-- ==========================================================
-- Aba SAP B1 (log de integracao)
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_sap_b1_integracao (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  operacao varchar(40) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pendente',
  object_type varchar(20),
  doc_entry integer,
  doc_num integer,
  payload_envio jsonb,
  payload_resposta jsonb,
  mensagem_erro text,
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  ultimo_envio_em timestamp without time zone,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_sap_status_check CHECK (status IN ('pendente', 'enviado', 'sincronizado', 'erro'))
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_sap_contrato ON contrato.cs_contrato_sap_b1_integracao (contrato_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_sap_status ON contrato.cs_contrato_sap_b1_integracao (status, ultimo_envio_em);

-- ==========================================================
-- Controle de pedido (botao "Aprovar/Gerar Pedido")
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_pedido (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  origem varchar(20) NOT NULL DEFAULT 'interno',
  numero_pedido varchar(40),
  sap_doc_entry integer,
  sap_doc_num integer,
  status varchar(20) NOT NULL DEFAULT 'gerado',
  mensagem text,
  criado_em timestamp without time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_pedido_origem_check CHECK (origem IN ('interno', 'sap_b1')),
  CONSTRAINT cs_contrato_pedido_status_check CHECK (status IN ('gerado', 'enviado', 'cancelado', 'erro'))
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_pedido_contrato ON contrato.cs_contrato_pedido (contrato_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_cs_contrato_pedido_status ON contrato.cs_contrato_pedido (status, atualizado_em DESC);

DROP TRIGGER IF EXISTS trg_cs_contrato_pedido_set_updated_at ON contrato.cs_contrato_pedido;
CREATE TRIGGER trg_cs_contrato_pedido_set_updated_at
BEFORE UPDATE ON contrato.cs_contrato_pedido
FOR EACH ROW
EXECUTE FUNCTION contrato.cs_set_updated_at();

-- ==========================================================
-- Historico de status do contrato
-- ==========================================================

CREATE TABLE IF NOT EXISTS contrato.cs_contrato_status_historico (
  id bigserial PRIMARY KEY,
  contrato_id bigint NOT NULL REFERENCES contrato.cs_contrato(id) ON DELETE CASCADE,
  status_anterior varchar(30),
  status_novo varchar(30) NOT NULL,
  motivo text,
  alterado_por varchar(80),
  alterado_em timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT cs_contrato_status_hist_status_novo_check CHECK (
    status_novo IN ('aguardando_aprovacao', 'ativo', 'contendo_parc', 'encerrado', 'inativo_cancelado')
  )
);

CREATE INDEX IF NOT EXISTS idx_cs_contrato_status_hist_contrato ON contrato.cs_contrato_status_historico (contrato_id, alterado_em DESC);

-- ==========================================================
-- View de listagem no padrao da tela
-- ==========================================================

CREATE OR REPLACE VIEW contrato.cs_vw_contrato_saida_insumos_lista AS
SELECT
  c.exercicio,
  c.id,
  c.referencia_contrato,
  concat(c.numero, '.', c.exercicio) AS numero,
  c.ref_object_id,
  trim(
    BOTH ' - '
    FROM concat_ws(
      ' - ',
      coalesce(c.parceiro_codigo_snapshot, p.codigo),
      coalesce(c.parceiro_nome_snapshot, p.nome),
      coalesce(c.parceiro_documento_snapshot, p.documento)
    )
  ) AS parceiro,
  c.status,
  c.tipo_contrato,
  c.inicio_em,
  c.sap_valor_pago AS valor_pago_sap
FROM contrato.cs_contrato c
LEFT JOIN contrato.cs_parceiro p ON p.id = c.parceiro_id
WHERE c.tipo_contrato = 'saida_insumos';

COMMIT;

-- ==========================================================
-- Exemplo rapido (opcional)
-- ==========================================================
-- INSERT INTO contrato.cs_empresa (codigo, nome, cnpj)
-- VALUES ('MATRIZ', 'Captar Pecuaria Matriz', '00000000000199');
--
-- INSERT INTO contrato.cs_parceiro (codigo, nome, documento)
-- VALUES ('C02452', 'SV LEM ASFALTOS LTDA', '29085245000140');
--
-- INSERT INTO contrato.cs_contrato (
--   empresa_id,
--   parceiro_id,
--   parceiro_codigo_snapshot,
--   parceiro_nome_snapshot,
--   parceiro_documento_snapshot,
--   tipo_contrato,
--   exercicio,
--   numero,
--   referencia_contrato,
--   status,
--   inicio_em
-- )
-- VALUES (
--   1,
--   1,
--   'C02452',
--   'SV LEM ASFALTOS LTDA',
--   '29085245000140',
--   'saida_insumos',
--   2026,
--   contrato.cs_next_numero_contrato(1, 'saida_insumos', 2026),
--   'VENDA ESTERCO - EXEMPLO',
--   'aguardando_aprovacao',
--   CURRENT_DATE
-- );
