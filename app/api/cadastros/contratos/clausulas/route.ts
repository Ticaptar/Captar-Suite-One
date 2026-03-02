import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";

export const runtime = "nodejs";

type ClausulaCatalogoItem = {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") ?? "").trim();
    const pool = getPgPool();

    const items = await listClausulasCatalogo(pool, search);
    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar catalogo de clausulas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const codigo = normalizeCode(body.codigo);
  const titulo = normalizeText(body.titulo);
  const descricao = normalizeText(body.descricao);

  if (!codigo) return NextResponse.json({ error: "Codigo da clausula e obrigatorio." }, { status: 400 });
  if (!titulo) return NextResponse.json({ error: "Titulo da clausula e obrigatorio." }, { status: 400 });
  if (!descricao) return NextResponse.json({ error: "Descricao da clausula e obrigatoria." }, { status: 400 });

  try {
    const pool = getPgPool();
    await ensureContratoClausulaTable(pool);

    const updateResult = await pool.query<ClausulaCatalogoItem>(
      `
      UPDATE contrato.clausula
      SET
        codigo = $1,
        descricao = $2,
        _descricao = $3,
        updated_on = now()
      WHERE upper(coalesce(codigo, '')) = upper($1)
         OR upper(descricao) = upper($2)
      RETURNING
        id::text AS id,
        coalesce(codigo, concat('CL', id::text)) AS codigo,
        descricao AS titulo,
        coalesce(_descricao, descricao) AS descricao
      `,
      [codigo, titulo, descricao],
    );

    if ((updateResult.rowCount ?? 0) > 0) {
      return NextResponse.json(updateResult.rows[0], { status: 201 });
    }

    const insertResult = await pool.query<ClausulaCatalogoItem>(
      `
      INSERT INTO contrato.clausula (
        codigo,
        descricao,
        _descricao,
        created_on,
        updated_on
      )
      VALUES ($1, $2, $3, now(), now())
      RETURNING
        id::text AS id,
        coalesce(codigo, concat('CL', id::text)) AS codigo,
        descricao AS titulo,
        coalesce(_descricao, descricao) AS descricao
      `,
      [codigo, titulo, descricao],
    );

    return NextResponse.json(insertResult.rows[0], { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar clausula.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function listClausulasCatalogo(
  pool: ReturnType<typeof getPgPool>,
  search: string,
): Promise<ClausulaCatalogoItem[]> {
  if (await tableExists("contrato.clausula", pool)) {
    const params: string[] = [];
    let where = "";
    const searchTerm = normalizeText(search);

    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      where = `
        WHERE
          upper(coalesce(c.codigo, '')) LIKE upper($1)
          OR upper(coalesce(c.descricao, '')) LIKE upper($1)
          OR upper(coalesce(c._descricao, '')) LIKE upper($1)
      `;
    }

    const result = await pool.query<ClausulaCatalogoItem>(
      `
      SELECT
        c.id::text AS id,
        coalesce(c.codigo, concat('CL', c.id::text)) AS codigo,
        c.descricao AS titulo,
        coalesce(c._descricao, c.descricao) AS descricao
      FROM contrato.clausula c
      ${where}
      ORDER BY coalesce(c.codigo, concat('CL', c.id::text)) ASC, c.descricao ASC
      LIMIT 1000
      `,
      params,
    );
    return result.rows;
  }

  if (await tableExists("contrato.clausula_item", pool)) {
    const params: string[] = [];
    let where = "";
    const searchTerm = normalizeText(search);
    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      where = `
        WHERE
          upper(coalesce(ci.codigo, '')) LIKE upper($1)
          OR upper(coalesce(ci.referencia, '')) LIKE upper($1)
          OR upper(coalesce(ci.descricao, '')) LIKE upper($1)
      `;
    }

    const result = await pool.query<ClausulaCatalogoItem>(
      `
      SELECT
        ci.id::text AS id,
        coalesce(ci.codigo, concat('CL', ci.id::text)) AS codigo,
        coalesce(ci.referencia, ci.codigo, 'Sem titulo') AS titulo,
        coalesce(ci.descricao, 'Sem descricao') AS descricao
      FROM contrato.clausula_item ci
      ${where}
      ORDER BY ci.codigo ASC NULLS LAST, ci.referencia ASC NULLS LAST, ci.id ASC
      LIMIT 1000
      `,
      params,
    );
    return result.rows;
  }

  return [];
}

async function ensureContratoClausulaTable(pool: ReturnType<typeof getPgPool>): Promise<void> {
  await pool.query("CREATE SCHEMA IF NOT EXISTS contrato");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contrato.clausula (
      id BIGSERIAL PRIMARY KEY,
      descricao VARCHAR(100) NOT NULL UNIQUE,
      created_by_id BIGINT NULL,
      created_on TIMESTAMP NULL,
      updated_by_id BIGINT NULL,
      updated_on TIMESTAMP NULL,
      codigo VARCHAR(100) NULL,
      _descricao VARCHAR(1024) NULL
    )
  `);
}

async function tableExists(
  relationName: string,
  pool: ReturnType<typeof getPgPool>,
): Promise<boolean> {
  const result = await pool.query<{ relation: string | null }>("SELECT to_regclass($1) AS relation", [relationName]);
  return result.rows[0]?.relation !== null;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeCode(value: unknown): string {
  return normalizeText(value);
}
