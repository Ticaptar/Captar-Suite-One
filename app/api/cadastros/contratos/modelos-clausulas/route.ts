import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";

export const runtime = "nodejs";

type ModeloClausulaListItem = {
  id: string;
  codigo: string;
  titulo: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get("search") ?? "").trim();
    const pool = getPgPool();
    const items = await listModelos(pool, search);
    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar modelos de cláusulas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function listModelos(
  pool: ReturnType<typeof getPgPool>,
  search: string,
): Promise<ModeloClausulaListItem[]> {
  if (!(await tableExists("contrato.clausula", pool))) return [];

  const hasLegacyModelId = await columnExists("contrato", "clausula", "id_clausula_modelo", pool);
  const searchTerm = String(search ?? "").trim();
  const params: unknown[] = [];
  let where = `
    WHERE coalesce(c.codigo, '') !~* '^LEGADO-'
  `;
  if (searchTerm) {
    params.push(`%${searchTerm}%`);
    where = `
      WHERE
        coalesce(c.codigo, '') !~* '^LEGADO-'
        AND (
          upper(coalesce(c.codigo, '')) LIKE upper($1)
          OR upper(coalesce(c.descricao, '')) LIKE upper($1)
        )
    `;
  }

  const sql = hasLegacyModelId
    ? `
      WITH modelos AS (
        SELECT DISTINCT ON (c.id_clausula_modelo)
          c.id_clausula_modelo::text AS id,
          coalesce(c.codigo, concat('MODELO-', c.id_clausula_modelo::text)) AS codigo,
          coalesce(c.descricao, 'MODELO SEM TÍTULO') AS titulo,
          c.id AS ordem_local
        FROM contrato.clausula c
        ${where}
          AND c.id_clausula_modelo IS NOT NULL
          AND c.id_clausula_modelo > 0
        ORDER BY c.id_clausula_modelo, c.id
      )
      SELECT id, codigo, titulo
      FROM modelos
      ORDER BY titulo ASC NULLS LAST, ordem_local ASC
      LIMIT 2000
    `
    : `
      SELECT
        c.id::text AS id,
        coalesce(c.codigo, concat('MODELO-', c.id::text)) AS codigo,
        coalesce(c.descricao, 'MODELO SEM TÍTULO') AS titulo
      FROM contrato.clausula c
      ${where}
      ORDER BY c.descricao ASC NULLS LAST, c.id ASC
      LIMIT 2000
    `;

  const result = await pool.query<ModeloClausulaListItem>(sql, params);
  return result.rows;
}

async function tableExists(
  relationName: string,
  pool: ReturnType<typeof getPgPool>,
): Promise<boolean> {
  const result = await pool.query<{ relation: string | null }>(
    "SELECT to_regclass($1) AS relation",
    [relationName],
  );
  return result.rows[0]?.relation !== null;
}

async function columnExists(
  schemaName: string,
  tableName: string,
  columnName: string,
  pool: ReturnType<typeof getPgPool>,
): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_name = $3
    ) AS "exists"
    `,
    [schemaName, tableName, columnName],
  );
  return result.rows[0]?.exists === true;
}

