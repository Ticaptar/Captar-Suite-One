import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";
import { isSapServiceLayerConfigured, listBusinessPartnersFromSap } from "@/lib/sap-service-layer";

export const runtime = "nodejs";

type ParceiroOption = {
  id: number;
  codigo: string | null;
  nome: string;
  documento: string | null;
  ativo: boolean;
  sapOnly?: boolean;
  sapExternalId?: string | null;
};

type SapCachedParceiroRow = {
  id: number;
  sapExternalId: string;
  codigo: string | null;
  nome: string;
  documento: string | null;
  ativo: boolean;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const limitParam = (searchParams.get("limit") ?? "").trim().toLowerCase();
  const unlimited = limitParam === "0" || limitParam === "all" || limitParam === "*";
  const defaultLimit = search ? 5000 : 300;
  const parsedLimit = Number.parseInt(limitParam || String(defaultLimit), 10);
  const limit = unlimited ? null : Math.min(Math.max(parsedLimit || defaultLimit, 1), 20000);

  try {
    const fetchLimit = limit === null ? 100000 : Math.max(limit * 4, 300);
    const localParceiros = await listLocalParceiros(search, fetchLimit);
    const cacheSap = await listSapCachedParceiros();
    const shouldQuerySap = isSapServiceLayerConfigured() && search.trim().length > 0;

    if (shouldQuerySap) {
      const sapParceiros = await listBusinessPartnersFromSap(search, fetchLimit);
      const mapeados = mapParceirosSapToLocal(sapParceiros, localParceiros);
      const sapOnly = mapSapParceirosToSapOnlyOptions(sapParceiros, mapeados, cacheSap);
      const mappedLocalIds = new Set(mapeados.map((item) => item.id));
      const locaisNaoMapeados = localParceiros.filter((item) => !mappedLocalIds.has(item.id));
      const payload = [...locaisNaoMapeados, ...mapeados, ...sapOnly]
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .slice(0, limit ?? Number.MAX_SAFE_INTEGER);

      if (payload.length > 0) {
        return NextResponse.json(payload);
      }
    }

    if (localParceiros.length > 0) {
      return NextResponse.json(localParceiros.slice(0, limit ?? Number.MAX_SAFE_INTEGER));
    }

    const cacheAsOptions = cacheSap.map((item) => ({
      id: -item.id,
      codigo: item.codigo,
      nome: item.nome,
      documento: item.documento,
      ativo: item.ativo,
      sapOnly: true,
      sapExternalId: item.sapExternalId,
    }));
    return NextResponse.json(cacheAsOptions.slice(0, limit ?? Number.MAX_SAFE_INTEGER));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar parceiros.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const nome = normalizeText(body.nome);
  const codigo = normalizeText(body.codigo) || null;
  const documento = normalizeDocument(body.documento);
  const sapExternalIdRaw = normalizeText(body.sapExternalId);
  const sapExternalId = sapExternalIdRaw || normalizeSapExternalId(codigo, nome, documento);

  if (!nome) {
    return NextResponse.json({ error: "Nome do parceiro é obrigatório." }, { status: 400 });
  }

  try {
    const saved = await upsertSapCachedParceiro({
      sapExternalId,
      codigo,
      nome,
      documento,
    });

    return NextResponse.json({
      id: -saved.id,
      codigo: saved.codigo,
      nome: saved.nome,
      documento: saved.documento,
      ativo: saved.ativo,
      sapOnly: true,
      sapExternalId: saved.sapExternalId,
    } satisfies ParceiroOption);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar parceiro SAP.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function listLocalParceiros(search: string, limit: number): Promise<ParceiroOption[]> {
  const pool = getPgPool();
  const [hasLegacy, hasContratoCsParceiro, hasAuthUser] = await Promise.all([
    hasRelation("dbo.res_partner"),
    hasRelation("contrato.cs_parceiro"),
    hasRelation("dbo.auth_user"),
  ]);

  let result: { rows: ParceiroOption[] };
  if (hasLegacy) {
    const authUserUnion = hasAuthUser
      ? `
          UNION
          SELECT
            p.id,
            coalesce(to_jsonb(p)->>'codigo', to_jsonb(p)->>'ref') AS codigo,
            coalesce(to_jsonb(p)->>'nome', to_jsonb(p)->>'name') AS nome,
            coalesce(to_jsonb(p)->>'documento', to_jsonb(p)->>'cnpj_cpf', to_jsonb(p)->>'vat') AS documento,
            coalesce((to_jsonb(p)->>'active')::boolean, true) AS ativo
          FROM dbo.auth_user u
          JOIN dbo.res_partner p ON p.id = u.partner_ptr_id
        `
      : "";
    result = await pool.query<ParceiroOption>(
        `
        WITH parceiro_base AS (
          SELECT
            p.id,
            coalesce(to_jsonb(p)->>'codigo', to_jsonb(p)->>'ref') AS codigo,
            coalesce(to_jsonb(p)->>'nome', to_jsonb(p)->>'name') AS nome,
            coalesce(to_jsonb(p)->>'documento', to_jsonb(p)->>'cnpj_cpf', to_jsonb(p)->>'vat') AS documento,
            coalesce((to_jsonb(p)->>'active')::boolean, true) AS ativo
          FROM dbo.res_partner p
          ${authUserUnion}
        ),
        parceiro_distinct AS (
          SELECT DISTINCT ON (id)
            id,
            codigo,
            nome,
            documento,
            ativo
          FROM parceiro_base
          ORDER BY id, nome
        )
        SELECT
          id,
          codigo,
          nome,
          documento,
          ativo
        FROM parceiro_distinct
        WHERE (
            $1::text = ''
            OR coalesce(nome, '') ILIKE '%' || $1 || '%'
            OR coalesce(codigo, '') ILIKE '%' || $1 || '%'
            OR coalesce(documento, '') ILIKE '%' || $1 || '%'
          )
        ORDER BY nome ASC NULLS LAST
        LIMIT $2
        `,
        [search, limit],
      );
  } else if (hasContratoCsParceiro) {
    result = await pool.query<ParceiroOption>(
      `
      SELECT
        id,
        codigo,
        nome,
        documento,
        ativo
      FROM contrato.cs_parceiro
      WHERE (
          $1::text = ''
          OR nome ILIKE '%' || $1 || '%'
          OR coalesce(codigo, '') ILIKE '%' || $1 || '%'
          OR coalesce(documento, '') ILIKE '%' || $1 || '%'
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
    documento: normalizeDocument(item.documento),
    ativo: Boolean(item.ativo),
  }));
}

function mapParceirosSapToLocal(
  sapParceiros: Awaited<ReturnType<typeof listBusinessPartnersFromSap>>,
  localParceiros: ParceiroOption[],
): ParceiroOption[] {
  const usedIds = new Set<number>();
  const mapped: ParceiroOption[] = [];

  for (const sap of sapParceiros) {
    const byDoc = sap.document
      ? localParceiros.find((local) => normalizeDocument(local.documento) === normalizeDocument(sap.document))
      : null;
    const byCode = localParceiros.find((local) => codesMatch(local.codigo, sap.cardCode));
    const byName = localParceiros.find((local) => namesMatch(local.nome, sap.cardName));

    const match = byDoc ?? byCode ?? byName;
    if (!match || usedIds.has(match.id)) {
      continue;
    }

    usedIds.add(match.id);
    mapped.push({
      id: match.id,
      codigo: match.codigo ?? sap.cardCode,
      nome: sap.cardName || match.nome,
      documento: normalizeDocument(sap.document) ?? normalizeDocument(match.documento),
      ativo: true,
    });
  }

  return mapped.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function mapSapParceirosToSapOnlyOptions(
  sapParceiros: Awaited<ReturnType<typeof listBusinessPartnersFromSap>>,
  parceirosMapeados: ParceiroOption[],
  cacheSap: SapCachedParceiroRow[],
): ParceiroOption[] {
  const localById = new Set(parceirosMapeados.map((item) => item.id));
  const sapOnly: ParceiroOption[] = [];

  for (let index = 0; index < sapParceiros.length; index += 1) {
    const sap = sapParceiros[index];
    const mappedLocal = parceirosMapeados.find(
      (local) =>
        (sap.document && normalizeDocument(local.documento) === normalizeDocument(sap.document)) ||
        codesMatch(local.codigo, sap.cardCode) ||
        namesMatch(local.nome, sap.cardName),
    );
    if (mappedLocal && localById.has(mappedLocal.id)) {
      continue;
    }

    const cached = cacheSap.find((item) => cacheMatchesSap(item, sap));
    const cachedId = cached?.id ?? 100000 + index + 1;

    sapOnly.push({
      id: -cachedId,
      codigo: sap.cardCode || cached?.codigo || null,
      nome: sap.cardName || cached?.nome || "Parceiro SAP",
      documento: normalizeDocument(sap.document) ?? cached?.documento ?? null,
      ativo: true,
      sapOnly: true,
      sapExternalId: sap.cardCode || cached?.sapExternalId || null,
    });
  }

  return sapOnly.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

async function listSapCachedParceiros(): Promise<SapCachedParceiroRow[]> {
  const pool = getPgPool();
  await ensureSapCacheTable();
  const result = await pool.query<SapCachedParceiroRow>(
    `
    SELECT
      id,
      sap_external_id AS "sapExternalId",
      codigo,
      nome,
      documento,
      ativo
    FROM contrato.cs_parceiro_sap_cache
    WHERE ativo = true
    ORDER BY nome ASC
    `,
  );
  return result.rows.map((row) => ({
    ...row,
    sapExternalId: normalizeText(row.sapExternalId),
    codigo: row.codigo ? String(row.codigo).trim() : null,
    nome: String(row.nome ?? "").trim(),
    documento: normalizeDocument(row.documento),
    ativo: Boolean(row.ativo),
  }));
}

async function upsertSapCachedParceiro(input: {
  sapExternalId: string;
  codigo: string | null;
  nome: string;
  documento: string | null;
}): Promise<SapCachedParceiroRow> {
  const pool = getPgPool();
  await ensureSapCacheTable();

  const result = await pool.query<SapCachedParceiroRow>(
    `
    INSERT INTO contrato.cs_parceiro_sap_cache (
      sap_external_id,
      codigo,
      nome,
      documento,
      ativo,
      created_on,
      updated_on
    )
    VALUES ($1, $2, $3, $4, true, now(), now())
    ON CONFLICT (sap_external_id)
    DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nome = EXCLUDED.nome,
      documento = EXCLUDED.documento,
      ativo = true,
      updated_on = now()
    RETURNING
      id,
      sap_external_id AS "sapExternalId",
      codigo,
      nome,
      documento,
      ativo
    `,
    [input.sapExternalId, input.codigo, input.nome, input.documento],
  );

  return {
    ...result.rows[0],
    sapExternalId: normalizeText(result.rows[0]?.sapExternalId),
    codigo: result.rows[0]?.codigo ? String(result.rows[0].codigo).trim() : null,
    nome: String(result.rows[0]?.nome ?? "").trim(),
    documento: normalizeDocument(result.rows[0]?.documento),
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
    `,
  );
  ensuredSapCacheTable = true;
}

function cacheMatchesSap(
  cache: SapCachedParceiroRow,
  sap: { cardCode: string; cardName: string; document: string | null },
): boolean {
  if (cache.sapExternalId && sap.cardCode && normalizeText(cache.sapExternalId) === normalizeText(sap.cardCode)) return true;
  if (cache.documento && sap.document && normalizeDocument(cache.documento) === normalizeDocument(sap.document)) return true;
  if (cache.codigo && sap.cardCode && codesMatch(cache.codigo, sap.cardCode)) return true;
  return namesMatch(cache.nome, sap.cardName);
}

function normalizeDocument(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = String(value).replace(/\D/g, "");
  return parsed.length === 0 ? null : parsed;
}

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
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

function normalizeSapExternalId(codigo: string | null, nome: string, documento: string | null): string {
  const base = normalizeText(codigo) || normalizeDocument(documento) || normalizeName(nome).replace(/[^A-Z0-9]/g, "");
  return base || `SAP-PARCEIRO-${Date.now()}`;
}

async function hasRelation(relation: string): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query<{ relation: string | null }>("SELECT to_regclass($1) AS relation", [relation]);
  return result.rows[0]?.relation !== null;
}
