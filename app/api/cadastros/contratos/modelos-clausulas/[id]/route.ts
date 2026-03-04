import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";

export const runtime = "nodejs";

type ModeloClausulaDetalhe = {
  id: string;
  codigo: string;
  titulo: string;
  clausulas: Array<{
    codigo: string;
    referencia: string;
    descricao: string;
  }>;
};

type ClausulaRow = {
  codigo: string | null;
  referencia: string | null;
  descricao: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: idParam } = await context.params;
  const modeloId = Number.parseInt(String(idParam ?? ""), 10);
  if (Number.isNaN(modeloId) || modeloId <= 0) {
    return NextResponse.json({ error: "ID do modelo inválido." }, { status: 400 });
  }

  try {
    const pool = getPgPool();
    if (!(await tableExists("contrato.clausula", pool))) {
      return NextResponse.json({ error: "Tabela de modelos não encontrada." }, { status: 404 });
    }

    const hasLegacyModelId = await columnExists("contrato", "clausula", "id_clausula_modelo", pool);
    const modelo = await loadModelo(pool, modeloId, hasLegacyModelId);
    if (!modelo) {
      return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
    }

    const clausulasRows = await loadModeloClausulas(pool, modeloId, hasLegacyModelId);
    const payload: ModeloClausulaDetalhe = {
      id: String(modeloId),
      codigo: modelo.codigo,
      titulo: modelo.titulo,
      clausulas: clausulasRows.map((row) => ({
        codigo: String(row.codigo ?? "").trim(),
        referencia: String(row.referencia ?? "").trim(),
        descricao: String(row.descricao ?? "").trim(),
      })),
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar modelo de cláusulas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function loadModelo(
  pool: ReturnType<typeof getPgPool>,
  modeloId: number,
  hasLegacyModelId: boolean,
): Promise<{ codigo: string; titulo: string } | null> {
  const result = hasLegacyModelId
    ? await pool.query<{ codigo: string; titulo: string }>(
        `
        SELECT
          coalesce(c.codigo, concat('MODELO-', c.id_clausula_modelo::text)) AS codigo,
          coalesce(c.descricao, 'MODELO SEM TÍTULO') AS titulo
        FROM contrato.clausula c
        WHERE c.id_clausula_modelo = $1
        ORDER BY c.id ASC
        LIMIT 1
        `,
        [modeloId],
      )
    : await pool.query<{ codigo: string; titulo: string }>(
        `
        SELECT
          coalesce(c.codigo, concat('MODELO-', c.id::text)) AS codigo,
          coalesce(c.descricao, 'MODELO SEM TÍTULO') AS titulo
        FROM contrato.clausula c
        WHERE c.id = $1
        LIMIT 1
        `,
        [modeloId],
      );

  return result.rows[0] ?? null;
}

async function loadModeloClausulas(
  pool: ReturnType<typeof getPgPool>,
  modeloId: number,
  hasLegacyModelId: boolean,
): Promise<ClausulaRow[]> {
  if (await tableExists("contrato.clausula_item", pool)) {
    const rows = hasLegacyModelId
      ? await pool.query<ClausulaRow>(
          `
          WITH ranked AS (
            SELECT
              ci.codigo,
              ci.referencia,
              ci.descricao,
              row_number() OVER (
                PARTITION BY
                  coalesce(ci.codigo, ''),
                  coalesce(ci.referencia, ''),
                  coalesce(ci.descricao, '')
                ORDER BY
                  nullif(regexp_replace(coalesce(ci.codigo, ''), '\\D', '', 'g'), '')::int NULLS LAST,
                  ci.codigo ASC NULLS LAST,
                  ci.id ASC
              ) AS rn
            FROM contrato.clausula cl
            JOIN contrato.clausula_item ci
              ON ci.clausula_id = cl.id_clausula_modelo
            WHERE cl.id_clausula_modelo = $1
          )
          SELECT
            codigo,
            referencia,
            descricao
          FROM ranked
          WHERE rn = 1
          ORDER BY
            nullif(regexp_replace(coalesce(codigo, ''), '\\D', '', 'g'), '')::int NULLS LAST,
            codigo ASC NULLS LAST,
            referencia ASC NULLS LAST
          `,
          [modeloId],
        )
      : await pool.query<ClausulaRow>(
          `
          SELECT
            ci.codigo,
            ci.referencia,
            ci.descricao
          FROM contrato.clausula_item ci
          WHERE ci.clausula_id = $1
          ORDER BY
            nullif(regexp_replace(coalesce(ci.codigo, ''), '\\D', '', 'g'), '')::int NULLS LAST,
            ci.codigo ASC NULLS LAST,
            ci.id ASC
          `,
          [modeloId],
        );

    if ((rows.rowCount ?? 0) > 0) {
      return rows.rows;
    }
  }

  if (await tableExists("contrato.clausula_contrato", pool)) {
    const hasClausulaId = await columnExists("contrato", "clausula_contrato", "clausula_id", pool);
    if (hasClausulaId) {
      const byClausulaId = await pool.query<ClausulaRow>(
        `
        SELECT
          cc.codigo,
          cc.referencia,
          cc.descricao
        FROM contrato.clausula_contrato cc
        WHERE cc.clausula_id = $1
        ORDER BY
          nullif(regexp_replace(coalesce(cc.codigo, ''), '\\D', '', 'g'), '')::int NULLS LAST,
          cc.codigo ASC NULLS LAST,
          cc.id ASC
        `,
        [modeloId],
      );
      if ((byClausulaId.rowCount ?? 0) > 0) {
        return byClausulaId.rows;
      }
    }
  }

  return [];
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
