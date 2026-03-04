BEGIN;

CREATE SCHEMA IF NOT EXISTS contrato;

CREATE TABLE IF NOT EXISTS contrato.clausula_item (
  id BIGSERIAL PRIMARY KEY,
  clausula_id BIGINT NULL,
  codigo VARCHAR(50) NULL,
  referencia VARCHAR(100) NULL,
  descricao TEXT NULL,
  created_by_id BIGINT NULL,
  created_on TIMESTAMP NULL,
  updated_by_id BIGINT NULL,
  updated_on TIMESTAMP NULL
);

WITH modelos AS (
  SELECT
    c.id,
    row_number() OVER (ORDER BY c.id) AS pos
  FROM contrato.clausula c
),
legados AS (
  SELECT
    t.contrato_id,
    row_number() OVER (ORDER BY t.contrato_id) AS pos
  FROM (
    SELECT DISTINCT cc.contrato_id
    FROM contrato.clausula_contrato cc
    WHERE cc.contrato_id IS NOT NULL
  ) t
),
mapa AS (
  SELECT
    m.id AS clausula_id,
    l.contrato_id AS legado_contrato_id
  FROM modelos m
  JOIN legados l ON l.pos = m.pos
),
origem AS (
  SELECT
    mapa.clausula_id,
    cc.codigo,
    cc.referencia,
    cc.descricao
  FROM contrato.clausula_contrato cc
  JOIN mapa ON mapa.legado_contrato_id = cc.contrato_id
)
INSERT INTO contrato.clausula_item (
  clausula_id,
  codigo,
  referencia,
  descricao,
  created_on,
  updated_on
)
SELECT
  o.clausula_id,
  o.codigo,
  o.referencia,
  o.descricao,
  now(),
  now()
FROM origem o
WHERE NOT EXISTS (
  SELECT 1
  FROM contrato.clausula_item ci
  WHERE ci.clausula_id = o.clausula_id
    AND coalesce(ci.codigo, '') = coalesce(o.codigo, '')
    AND coalesce(ci.referencia, '') = coalesce(o.referencia, '')
    AND coalesce(ci.descricao, '') = coalesce(o.descricao, '')
);

COMMIT;

