-- Modulo: Pesagem de Caminhao de Entrada de Animal
-- Banco: PostgreSQL
-- Observacao: schema "agro" local, sem dependencia de confina_captar

CREATE SCHEMA IF NOT EXISTS agro;

CREATE TABLE IF NOT EXISTS agro.pesagem_veiculo (
  id BIGSERIAL PRIMARY KEY,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(32) NOT NULL DEFAULT 'disponivel',
  tipo VARCHAR(32) NOT NULL DEFAULT 'entrada_animais',
  numero VARCHAR(30) NULL,
  contrato_id BIGINT NULL,
  contrato_referencia VARCHAR(255) NULL,
  item_id BIGINT NULL,
  item_descricao VARCHAR(255) NULL,
  fazenda_id BIGINT NULL,
  fazenda_nome VARCHAR(255) NULL,
  tp_frete VARCHAR(32) NULL,
  responsavel_frete VARCHAR(32) NULL,
  transportador_id BIGINT NULL,
  transportador_nome VARCHAR(255) NULL,
  contratante_id BIGINT NULL,
  contratante_nome VARCHAR(255) NULL,
  motorista_id BIGINT NULL,
  motorista_nome VARCHAR(255) NULL,
  dt_chegada DATE NULL,
  hr_chegada TIME NULL,
  dt_saida DATE NULL,
  hr_saida TIME NULL,
  placa VARCHAR(10) NULL,
  equipamento_id BIGINT NULL,
  equipamento_nome VARCHAR(255) NULL,
  viagem VARCHAR(255) NULL,
  dt_inicio DATE NULL,
  dt_fim DATE NULL,
  km_inicial NUMERIC(29, 6) NOT NULL DEFAULT 0,
  km_final NUMERIC(29, 6) NOT NULL DEFAULT 0,
  km_total NUMERIC(29, 6) NOT NULL DEFAULT 0,
  observacao TEXT NULL,
  peso_bruto NUMERIC(29, 6) NOT NULL DEFAULT 0,
  peso_tara NUMERIC(29, 6) NOT NULL DEFAULT 0,
  peso_liquido NUMERIC(29, 6) NOT NULL DEFAULT 0,
  operacao VARCHAR(128) NULL
);

CREATE INDEX IF NOT EXISTS idx_pesagem_veiculo_tipo_status_id
  ON agro.pesagem_veiculo(tipo, status, id DESC);

CREATE INDEX IF NOT EXISTS idx_pesagem_veiculo_numero
  ON agro.pesagem_veiculo(numero);

CREATE TABLE IF NOT EXISTS agro.pesagem_veiculo_documento_fiscal (
  id BIGSERIAL PRIMARY KEY,
  pesagem_id BIGINT NOT NULL REFERENCES agro.pesagem_veiculo(id) ON DELETE CASCADE,
  documento VARCHAR(128) NOT NULL,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_on TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agro.pesagem_veiculo_motivo_atraso (
  id BIGSERIAL PRIMARY KEY,
  pesagem_id BIGINT NOT NULL REFERENCES agro.pesagem_veiculo(id) ON DELETE CASCADE,
  motivo VARCHAR(4000) NOT NULL,
  tempo_minutos INTEGER NOT NULL DEFAULT 0,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_on TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agro.pesagem_veiculo_motivo_espera (
  id BIGSERIAL PRIMARY KEY,
  pesagem_id BIGINT NOT NULL REFERENCES agro.pesagem_veiculo(id) ON DELETE CASCADE,
  motivo VARCHAR(4000) NOT NULL,
  tempo_minutos INTEGER NOT NULL DEFAULT 0,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_on TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agro.pesagem_veiculo_calendario (
  id BIGSERIAL PRIMARY KEY,
  pesagem_id BIGINT NOT NULL REFERENCES agro.pesagem_veiculo(id) ON DELETE CASCADE,
  dt DATE NOT NULL,
  dia VARCHAR(32) NULL,
  feriado BOOLEAN NOT NULL DEFAULT false,
  pago BOOLEAN NOT NULL DEFAULT false,
  vl NUMERIC(28, 6) NOT NULL DEFAULT 0,
  created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_on TIMESTAMPTZ NOT NULL DEFAULT now()
);
