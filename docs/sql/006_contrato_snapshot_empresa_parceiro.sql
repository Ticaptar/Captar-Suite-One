BEGIN;

CREATE SCHEMA IF NOT EXISTS contrato;

ALTER TABLE IF EXISTS contrato.contrato
  ADD COLUMN IF NOT EXISTS empresa_codigo_snapshot varchar(64),
  ADD COLUMN IF NOT EXISTS empresa_nome_snapshot varchar(255),
  ADD COLUMN IF NOT EXISTS empresa_cnpj_snapshot varchar(20),
  ADD COLUMN IF NOT EXISTS parceiro_codigo_snapshot varchar(64),
  ADD COLUMN IF NOT EXISTS parceiro_nome_snapshot varchar(255),
  ADD COLUMN IF NOT EXISTS parceiro_documento_snapshot varchar(20);

CREATE TABLE IF NOT EXISTS contrato.cs_empresa (
  id BIGSERIAL PRIMARY KEY,
  codigo varchar(64) NULL,
  nome varchar(255) NOT NULL,
  cnpj varchar(20) NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_on timestamp without time zone NOT NULL DEFAULT now(),
  updated_on timestamp without time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cs_empresa_codigo
  ON contrato.cs_empresa (codigo)
  WHERE codigo IS NOT NULL;

CREATE TABLE IF NOT EXISTS contrato.cs_parceiro (
  id BIGSERIAL PRIMARY KEY,
  codigo varchar(64) NULL,
  nome varchar(255) NOT NULL,
  documento varchar(20) NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_on timestamp without time zone NOT NULL DEFAULT now(),
  updated_on timestamp without time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cs_parceiro_codigo
  ON contrato.cs_parceiro (codigo)
  WHERE codigo IS NOT NULL;

CREATE TABLE IF NOT EXISTS contrato.cs_empresa_sap_cache (
  id BIGSERIAL PRIMARY KEY,
  sap_external_id varchar(128) NOT NULL UNIQUE,
  codigo varchar(64) NULL,
  nome varchar(255) NOT NULL,
  cnpj varchar(20) NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_on timestamp without time zone NOT NULL DEFAULT now(),
  updated_on timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contrato.cs_parceiro_sap_cache (
  id BIGSERIAL PRIMARY KEY,
  sap_external_id varchar(128) NOT NULL UNIQUE,
  codigo varchar(64) NULL,
  nome varchar(255) NOT NULL,
  documento varchar(20) NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_on timestamp without time zone NOT NULL DEFAULT now(),
  updated_on timestamp without time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.cs_empresa_sap_cache') IS NOT NULL THEN
    INSERT INTO contrato.cs_empresa_sap_cache (
      sap_external_id, codigo, nome, cnpj, ativo, created_on, updated_on
    )
    SELECT
      sap_external_id,
      codigo,
      nome,
      cnpj,
      coalesce(ativo, true),
      coalesce(created_on, now()),
      coalesce(updated_on, now())
    FROM public.cs_empresa_sap_cache
    ON CONFLICT (sap_external_id)
    DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nome = EXCLUDED.nome,
      cnpj = EXCLUDED.cnpj,
      ativo = EXCLUDED.ativo,
      updated_on = now();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cs_empresa') IS NOT NULL THEN
    INSERT INTO contrato.cs_empresa (
      codigo, nome, cnpj, ativo, created_on, updated_on
    )
    SELECT
      nullif(trim(codigo), ''),
      nome,
      cnpj,
      coalesce(ativo, true),
      coalesce(created_at, now()),
      coalesce(updated_at, now())
    FROM public.cs_empresa
    ON CONFLICT (codigo) WHERE codigo IS NOT NULL
    DO UPDATE SET
      nome = EXCLUDED.nome,
      cnpj = EXCLUDED.cnpj,
      ativo = EXCLUDED.ativo,
      updated_on = now();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cs_parceiro') IS NOT NULL THEN
    INSERT INTO contrato.cs_parceiro (
      codigo, nome, documento, ativo, created_on, updated_on
    )
    SELECT
      nullif(trim(codigo), ''),
      nome,
      documento,
      coalesce(ativo, true),
      coalesce(created_at, now()),
      coalesce(updated_at, now())
    FROM public.cs_parceiro
    ON CONFLICT (codigo) WHERE codigo IS NOT NULL
    DO UPDATE SET
      nome = EXCLUDED.nome,
      documento = EXCLUDED.documento,
      ativo = EXCLUDED.ativo,
      updated_on = now();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.cs_parceiro_sap_cache') IS NOT NULL THEN
    INSERT INTO contrato.cs_parceiro_sap_cache (
      sap_external_id, codigo, nome, documento, ativo, created_on, updated_on
    )
    SELECT
      sap_external_id,
      codigo,
      nome,
      documento,
      coalesce(ativo, true),
      coalesce(created_on, now()),
      coalesce(updated_on, now())
    FROM public.cs_parceiro_sap_cache
    ON CONFLICT (sap_external_id)
    DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nome = EXCLUDED.nome,
      documento = EXCLUDED.documento,
      ativo = EXCLUDED.ativo,
      updated_on = now();
  END IF;
END $$;

COMMIT;
