import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";
import { isSapServiceLayerConfigured, listBranchesFromSap } from "@/lib/sap-service-layer";

export const runtime = "nodejs";

type EmpresaOption = {
  id: number;
  codigo: string | null;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  sapOnly?: boolean;
  sapExternalId?: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get("limit") ?? "2000", 10) || 2000, 1),
    5000,
  );

  try {
    const localEmpresas = await listLocalEmpresas(search, Math.min(Math.max(limit * 2, 400), 5000));
    const cacheSap = await listSapCachedEmpresas();

    if (isSapServiceLayerConfigured()) {
      const filiaisSap = (await listBranchesFromSap()).filter((item) => matchesEmpresaSearch(item, search));
      const mapeadas = mapFiliaisSapToLocal(filiaisSap, localEmpresas);
      const sapNaoMapeadas = mapSapBranchesToSapOnlyOptions(filiaisSap, mapeadas, cacheSap);
      const payload = [...mapeadas, ...sapNaoMapeadas]
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .slice(0, limit);
      if (payload.length > 0) return NextResponse.json(payload);
    }

    if (localEmpresas.length > 0) return NextResponse.json(localEmpresas.slice(0, limit));

    const cacheAsOptions = cacheSap.map((item) => ({
      id: -item.id,
      codigo: item.codigo,
      nome: item.nome,
      cnpj: item.cnpj,
      ativo: item.ativo,
      sapOnly: true,
      sapExternalId: item.sapExternalId,
    })).filter((item) => matchesEmpresaSearch(item, search));

    return NextResponse.json(cacheAsOptions.slice(0, limit));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar empresas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  const codigo = normalizeText(body.codigo) || null;
  const cnpj = normalizeDocument(body.cnpj);
  const sapExternalIdRaw = normalizeText(body.sapExternalId);
  const sapExternalId = sapExternalIdRaw || normalizeSapExternalId(codigo, nome, cnpj);

  if (!nome) {
    return NextResponse.json({ error: "Nome da filial é obrigatório." }, { status: 400 });
  }

  try {
    const saved = await upsertSapCachedEmpresa({
      sapExternalId,
      codigo,
      nome,
      cnpj,
    });

    return NextResponse.json({
      id: -saved.id,
      codigo: saved.codigo,
      nome: saved.nome,
      cnpj: saved.cnpj,
      ativo: saved.ativo,
      sapOnly: true,
      sapExternalId: saved.sapExternalId,
    } satisfies EmpresaOption);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar filial SAP.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type SapCachedEmpresaRow = {
  id: number;
  sapExternalId: string;
  codigo: string | null;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
};

async function listSapCachedEmpresas(): Promise<SapCachedEmpresaRow[]> {
  const pool = getPgPool();
  await ensureSapCacheTable();
  const result = await pool.query<SapCachedEmpresaRow>(
    `
    SELECT
      id,
      sap_external_id AS "sapExternalId",
      codigo,
      nome,
      cnpj,
      ativo
    FROM contrato.cs_empresa_sap_cache
    WHERE ativo = true
    ORDER BY nome ASC
    `,
  );
  return result.rows.map((row) => ({
    ...row,
    sapExternalId: normalizeText(row.sapExternalId),
    codigo: row.codigo ? String(row.codigo).trim() : null,
    nome: String(row.nome ?? "").trim(),
    cnpj: normalizeDocument(row.cnpj),
    ativo: Boolean(row.ativo),
  }));
}

async function upsertSapCachedEmpresa(input: {
  sapExternalId: string;
  codigo: string | null;
  nome: string;
  cnpj: string | null;
}): Promise<SapCachedEmpresaRow> {
  const pool = getPgPool();
  await ensureSapCacheTable();

  const result = await pool.query<SapCachedEmpresaRow>(
    `
    INSERT INTO contrato.cs_empresa_sap_cache (
      sap_external_id,
      codigo,
      nome,
      cnpj,
      ativo,
      created_on,
      updated_on
    )
    VALUES ($1, $2, $3, $4, true, now(), now())
    ON CONFLICT (sap_external_id)
    DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nome = EXCLUDED.nome,
      cnpj = EXCLUDED.cnpj,
      ativo = true,
      updated_on = now()
    RETURNING
      id,
      sap_external_id AS "sapExternalId",
      codigo,
      nome,
      cnpj,
      ativo
    `,
    [input.sapExternalId, input.codigo, input.nome, input.cnpj],
  );

  return {
    ...result.rows[0],
    sapExternalId: normalizeText(result.rows[0]?.sapExternalId),
    codigo: result.rows[0]?.codigo ? String(result.rows[0].codigo).trim() : null,
    nome: String(result.rows[0]?.nome ?? "").trim(),
    cnpj: normalizeDocument(result.rows[0]?.cnpj),
    ativo: Boolean(result.rows[0]?.ativo),
  };
}

let ensuredSapCacheTable = false;
async function ensureSapCacheTable() {
  if (ensuredSapCacheTable) return;
  const pool = getPgPool();
  await pool.query("CREATE SCHEMA IF NOT EXISTS contrato;");
  await pool.query(
    `
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
    `,
  );
  ensuredSapCacheTable = true;
}

async function listLocalEmpresas(search: string, limit: number): Promise<EmpresaOption[]> {
  const pool = getPgPool();
  const [hasLegacy, hasContratoCsEmpresa] = await Promise.all([
    hasRelation("dbo.res_company"),
    hasRelation("contrato.cs_empresa"),
  ]);

  let result: { rows: EmpresaOption[] };
  if (hasLegacy) {
    result = await pool.query<EmpresaOption>(
        `
        SELECT
          c.partner_ptr_id AS id,
          coalesce(to_jsonb(c)->>'codigo', to_jsonb(c)->>'ref', c.partner_ptr_id::text) AS codigo,
          coalesce(to_jsonb(c)->>'nome', to_jsonb(c)->>'name', c.partner_ptr_id::text) AS nome,
          coalesce(to_jsonb(c)->>'cnpj', to_jsonb(c)->>'cnpj_cpf', to_jsonb(c)->>'vat') AS cnpj,
          coalesce((to_jsonb(c)->>'active')::boolean, true) AS ativo
        FROM dbo.res_company c
        WHERE coalesce((to_jsonb(c)->>'active')::boolean, true) = true
          AND (
            $1::text = ''
            OR coalesce(to_jsonb(c)->>'nome', to_jsonb(c)->>'name', '') ILIKE '%' || $1 || '%'
            OR coalesce(to_jsonb(c)->>'codigo', to_jsonb(c)->>'ref', '') ILIKE '%' || $1 || '%'
            OR coalesce(to_jsonb(c)->>'cnpj', to_jsonb(c)->>'cnpj_cpf', to_jsonb(c)->>'vat', '') ILIKE '%' || $1 || '%'
          )
        ORDER BY nome ASC
        LIMIT $2
        `,
        [search, limit],
      );
  } else if (hasContratoCsEmpresa) {
    result = await pool.query<EmpresaOption>(
      `
      SELECT
        id,
        codigo,
        nome,
        cnpj,
        ativo
      FROM contrato.cs_empresa
      WHERE ativo = true
        AND (
          $1::text = ''
          OR nome ILIKE '%' || $1 || '%'
          OR coalesce(codigo, '') ILIKE '%' || $1 || '%'
          OR coalesce(cnpj, '') ILIKE '%' || $1 || '%'
        )
      ORDER BY nome ASC
      LIMIT $2
      `,
      [search, limit],
    );
  } else {
    result = { rows: [] };
  }

  return result.rows.map((item) => ({
    ...item,
    codigo: item.codigo ? String(item.codigo) : null,
    nome: String(item.nome ?? "").trim(),
    cnpj: normalizeDocument(item.cnpj),
    ativo: Boolean(item.ativo),
  }));
}

function mapFiliaisSapToLocal(
  filiaisSap: Awaited<ReturnType<typeof listBranchesFromSap>>,
  localEmpresas: EmpresaOption[],
): EmpresaOption[] {
  const usedIds = new Set<number>();
  const mapped: EmpresaOption[] = [];

  for (const filial of filiaisSap) {
    const byCnpj = filial.cnpj
      ? localEmpresas.find((local) => normalizeDocument(local.cnpj) === normalizeDocument(filial.cnpj))
      : null;

    const byCode = filial.code
      ? localEmpresas.find((local) => codesMatch(local.codigo, filial.code))
      : null;

    const byName = localEmpresas.find((local) => namesMatch(local.nome, filial.name));

    const match = byCnpj ?? byCode ?? byName;
    if (!match || usedIds.has(match.id)) {
      continue;
    }

    usedIds.add(match.id);
    mapped.push({
      id: match.id,
      codigo: match.codigo ?? filial.code ?? null,
      nome: filial.name || match.nome,
      cnpj: normalizeDocument(filial.cnpj) ?? normalizeDocument(match.cnpj),
      ativo: true,
    });
  }

  return mapped.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function mapSapBranchesToSapOnlyOptions(
  filiaisSap: Awaited<ReturnType<typeof listBranchesFromSap>>,
  locaisMapeadas: EmpresaOption[],
  cacheSap: SapCachedEmpresaRow[],
): EmpresaOption[] {
  const localById = new Set(locaisMapeadas.map((item) => item.id));
  const sapOnly: EmpresaOption[] = [];

  for (let index = 0; index < filiaisSap.length; index += 1) {
    const filial = filiaisSap[index];
    const mappedLocal = locaisMapeadas.find(
      (local) =>
        (filial.cnpj && normalizeDocument(local.cnpj) === normalizeDocument(filial.cnpj)) ||
        (filial.code && codesMatch(local.codigo, filial.code)) ||
        namesMatch(local.nome, filial.name),
    );
    if (mappedLocal && localById.has(mappedLocal.id)) {
      continue;
    }

    const cached = cacheSap.find((item) => cacheMatchesSap(item, filial));
    const cachedId = cached?.id ?? 100000 + index + 1;

    sapOnly.push({
      id: -cachedId,
      codigo: filial.code ?? cached?.codigo ?? filial.externalId ?? null,
      nome: filial.name || cached?.nome || "Filial SAP",
      cnpj: normalizeDocument(filial.cnpj) ?? cached?.cnpj ?? null,
      ativo: true,
      sapOnly: true,
      sapExternalId: normalizeText(filial.externalId) || cached?.sapExternalId || null,
    });
  }

  return sapOnly.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function cacheMatchesSap(cache: SapCachedEmpresaRow, filial: { externalId: string; code: string | null; name: string; cnpj: string | null }): boolean {
  const cacheExternal = normalizeText(cache.sapExternalId);
  const filialExternal = normalizeText(filial.externalId);
  if (cacheExternal && filialExternal && cacheExternal === filialExternal) return true;

  const cacheCnpj = normalizeDocument(cache.cnpj);
  const filialCnpj = normalizeDocument(filial.cnpj);
  if (cacheCnpj && filialCnpj && cacheCnpj === filialCnpj) return true;

  if (cache.codigo && filial.code && codesMatch(cache.codigo, filial.code)) return true;
  return namesMatch(cache.nome, filial.name);
}

function normalizeDocument(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = String(value).replace(/\D/g, "");
  return parsed.length === 0 ? null : parsed;
}

async function hasRelation(relation: string): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query<{ relation: string | null }>("SELECT to_regclass($1) AS relation", [relation]);
  return result.rows[0]?.relation !== null;
}

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function matchesEmpresaSearch(
  empresa: { nome?: string | null; codigo?: string | null; cnpj?: string | null; externalId?: string | null },
  search: string,
): boolean {
  const term = normalizeSearch(search);
  if (!term) return true;

  const nome = normalizeSearch(empresa.nome);
  const codigo = normalizeSearch(empresa.codigo);
  const cnpj = normalizeDocument(empresa.cnpj) ?? "";
  const externalId = normalizeSearch(empresa.externalId);
  const termDigits = search.replace(/\D/g, "");

  return (
    nome.includes(term) ||
    codigo.includes(term) ||
    externalId.includes(term) ||
    (termDigits.length > 0 && cnpj.includes(termDigits))
  );
}

function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSapExternalId(codigo: string | null, nome: string, cnpj: string | null): string {
  const base = normalizeText(codigo) || normalizeDocument(cnpj) || normalizeName(nome).replace(/[^A-Z0-9]/g, "");
  return base || `SAP-${Date.now()}`;
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function codesMatch(localCode: unknown, sapCode: unknown): boolean {
  const a = normalizeCode(localCode);
  const b = normalizeCode(sapCode);
  if (!a || !b) return false;
  if (a === b) return true;

  const digitsA = a.replace(/\D/g, "");
  const digitsB = b.replace(/\D/g, "");
  if (digitsA && digitsB && (digitsA.endsWith(digitsB) || digitsB.endsWith(digitsA))) {
    return true;
  }

  return false;
}

function namesMatch(localName: unknown, sapName: unknown): boolean {
  const a = normalizeName(localName);
  const b = normalizeName(sapName);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}
