BEGIN;

CREATE SCHEMA IF NOT EXISTS contrato;

CREATE TABLE IF NOT EXISTS contrato.clausula_modelo_vinculo (
  modelo_id BIGINT PRIMARY KEY,
  origem_modelo_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Preenchimento inicial:
-- mapeia cada modelo "normal" (sem prefixo LEGADO-) para o modelo legado
-- correspondente pela ordem de ID.
WITH modelos_normais AS (
  SELECT
    c.id,
    row_number() OVER (ORDER BY c.id) AS pos
  FROM contrato.clausula c
  WHERE coalesce(c.codigo, '') !~* '^LEGADO-'
),
modelos_legado AS (
  SELECT
    c.id,
    row_number() OVER (ORDER BY c.id) AS pos
  FROM contrato.clausula c
  WHERE coalesce(c.codigo, '') ~* '^LEGADO-'
    AND EXISTS (
      SELECT 1
      FROM contrato.clausula_item ci
      WHERE ci.clausula_id = c.id
    )
)
INSERT INTO contrato.clausula_modelo_vinculo (modelo_id, origem_modelo_id)
SELECT
  n.id AS modelo_id,
  l.id AS origem_modelo_id
FROM modelos_normais n
JOIN modelos_legado l ON l.pos = n.pos
ON CONFLICT (modelo_id) DO UPDATE
SET
  origem_modelo_id = EXCLUDED.origem_modelo_id,
  updated_at = now();

COMMIT;

