BEGIN;

CREATE SCHEMA IF NOT EXISTS contrato;

CREATE TABLE IF NOT EXISTS contrato.clausula (
  id BIGSERIAL PRIMARY KEY,
  descricao VARCHAR(100) NOT NULL UNIQUE,
  created_by_id BIGINT NULL,
  created_on TIMESTAMP NULL,
  updated_by_id BIGINT NULL,
  updated_on TIMESTAMP NULL,
  codigo VARCHAR(100) NULL,
  _descricao VARCHAR(1024) NULL
);

CREATE INDEX IF NOT EXISTS idx_contrato_clausula_codigo
  ON contrato.clausula (codigo);

COMMIT;
