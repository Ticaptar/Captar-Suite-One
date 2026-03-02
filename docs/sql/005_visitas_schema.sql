BEGIN;

CREATE SCHEMA IF NOT EXISTS contrato;

CREATE TABLE IF NOT EXISTS contrato.visita (
  id BIGSERIAL PRIMARY KEY,
  created_on TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_on TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  empresa_id BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'oportunidade',
  data_visita DATE NOT NULL,
  parceiro_id BIGINT NULL,
  parceiro_codigo VARCHAR(64) NULL,
  parceiro_nome VARCHAR(255) NULL,
  responsavel_id BIGINT NULL,
  responsavel_codigo VARCHAR(64) NULL,
  responsavel_nome VARCHAR(255) NULL,
  cep VARCHAR(16) NULL,
  endereco VARCHAR(255) NULL,
  complemento VARCHAR(255) NULL,
  bairro VARCHAR(120) NULL,
  cidade VARCHAR(120) NULL,
  estado VARCHAR(64) NULL,
  telefone VARCHAR(40) NULL,
  email VARCHAR(120) NULL,
  rebanho_atual NUMERIC(29, 6) NOT NULL DEFAULT 0,
  informacoes_detalhadas TEXT NULL,
  categoria VARCHAR(120) NULL,
  observacoes TEXT NULL,
  tipo_contrato_sugerido VARCHAR(32) NOT NULL DEFAULT 'entrada_animais',
  contrato_gerado_id BIGINT NULL
);

CREATE TABLE IF NOT EXISTS contrato.visita_atividade (
  id BIGSERIAL PRIMARY KEY,
  visita_id BIGINT NOT NULL,
  tipo_atividade VARCHAR(120) NULL,
  data_vencimento DATE NULL,
  resumo VARCHAR(255) NULL,
  responsavel VARCHAR(255) NULL,
  data_realizacao DATE NULL,
  descricao_atividade TEXT NULL,
  created_on TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_on TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  CONSTRAINT fk_visita_atividade_visita
    FOREIGN KEY (visita_id) REFERENCES contrato.visita(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_visita_status ON contrato.visita(status);
CREATE INDEX IF NOT EXISTS idx_visita_data_visita ON contrato.visita(data_visita DESC);
CREATE INDEX IF NOT EXISTS idx_visita_parceiro_nome ON contrato.visita(parceiro_nome);
CREATE INDEX IF NOT EXISTS idx_visita_responsavel_nome ON contrato.visita(responsavel_nome);
CREATE INDEX IF NOT EXISTS idx_visita_atividade_visita_id ON contrato.visita_atividade(visita_id);

CREATE OR REPLACE FUNCTION contrato.fn_set_updated_on()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_on := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visita_set_updated_on ON contrato.visita;
CREATE TRIGGER trg_visita_set_updated_on
BEFORE UPDATE ON contrato.visita
FOR EACH ROW
EXECUTE FUNCTION contrato.fn_set_updated_on();

DROP TRIGGER IF EXISTS trg_visita_atividade_set_updated_on ON contrato.visita_atividade;
CREATE TRIGGER trg_visita_atividade_set_updated_on
BEFORE UPDATE ON contrato.visita_atividade
FOR EACH ROW
EXECUTE FUNCTION contrato.fn_set_updated_on();

COMMIT;

