import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CidadeOption = {
  codigo: string;
  nome: string;
  uf: string;
  label: string;
};

const IBGE_CIDADES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

let cidadesCache: { items: CidadeOption[]; expiresAt: number } | null = null;
let cidadesPromise: Promise<CidadeOption[]> | null = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const ufFilter = searchParams.get("uf") ?? "";
  const limitParam = searchParams.get("limit");
  const limit = Math.min(parsePositiveInt(limitParam, 120), 500);

  try {
    const allItems = await listBrazilCities();
    const term = normalizeTerm(search);
    const ufTerm = normalizeTerm(ufFilter);

    let filtered = allItems;
    if (ufTerm) {
      filtered = filtered.filter((item) => normalizeTerm(item.uf) === ufTerm);
    }

    if (term) {
      filtered = filtered.filter((item) => {
        const city = normalizeTerm(item.nome);
        const label = normalizeTerm(item.label);
        const codigo = normalizeTerm(item.codigo);
        return city.includes(term) || label.includes(term) || codigo.includes(term);
      });
    }

    return NextResponse.json({
      items: filtered.slice(0, limit),
      total: filtered.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar cidades.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function listBrazilCities(): Promise<CidadeOption[]> {
  if (cidadesCache && cidadesCache.expiresAt > Date.now()) {
    return cidadesCache.items;
  }

  if (!cidadesPromise) {
    cidadesPromise = loadBrazilCities().finally(() => {
      cidadesPromise = null;
    });
  }

  return cidadesPromise;
}

async function loadBrazilCities(): Promise<CidadeOption[]> {
  const response = await fetch(IBGE_CIDADES_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar API de cidades (${response.status}).`);
  }

  const payload = (await response.json().catch(() => [])) as unknown;
  const rows = Array.isArray(payload) ? payload : [];
  const mapped = rows.map(mapIbgeCity).filter((item): item is CidadeOption => item !== null);

  const deduped = dedupeCities(mapped).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  cidadesCache = {
    items: deduped,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return deduped;
}

function mapIbgeCity(value: unknown): CidadeOption | null {
  const row = toObject(value);
  if (!row) return null;

  const codigo = toText(row.id);
  const nome = toText(row.nome);
  const uf = resolveUfFromIbgeRow(row);
  if (!codigo || !nome || !uf) return null;

  return {
    codigo,
    nome,
    uf,
    label: `${nome} - ${uf}`,
  };
}

function resolveUfFromIbgeRow(row: Record<string, unknown>): string {
  const regiaoImediata = toObject(row["regiao-imediata"]);
  const regiaoIntermediaria = toObject(regiaoImediata?.["regiao-intermediaria"]);
  const ufFromImmediate = toObject(regiaoIntermediaria?.UF);
  const siglaImmediate = toText(ufFromImmediate?.sigla).toUpperCase();
  if (siglaImmediate) return siglaImmediate;

  const microrregiao = toObject(row.microrregiao);
  const mesorregiao = toObject(microrregiao?.mesorregiao);
  const ufFromMicro = toObject(mesorregiao?.UF);
  return toText(ufFromMicro?.sigla).toUpperCase();
}

function dedupeCities(items: CidadeOption[]): CidadeOption[] {
  const seen = new Set<string>();
  const unique: CidadeOption[] = [];

  for (const item of items) {
    const key = `${item.codigo}|${item.label}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeTerm(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}
