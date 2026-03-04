export type PnCatalogOption = {
  id: number;
  codigo: string | null;
  nome: string;
  documento: string | null;
  ativo?: boolean;
  sapOnly?: boolean;
  sapExternalId?: string | null;
};

type PersistedPnCatalog = {
  version: 1;
  updatedAt: number;
  items: PnCatalogOption[];
};

type QueryPnCatalogOptions = {
  emptyLimit?: number;
  searchLimit?: number;
};

const STORAGE_KEY = "captar-suite:pn-catalog:v1";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

let memoryPnCatalog: PnCatalogOption[] | null = null;
let inflightPreload: Promise<PnCatalogOption[]> | null = null;

function normalizePnItem(raw: unknown): PnCatalogOption | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = Number(row.id);
  const nome = String(row.nome ?? "").trim();
  if (!Number.isFinite(id) || nome.length === 0) return null;

  const codigoRaw = row.codigo;
  const documentoRaw = row.documento;
  const sapExternalIdRaw = row.sapExternalId;

  return {
    id,
    codigo: codigoRaw === null || codigoRaw === undefined ? null : String(codigoRaw).trim() || null,
    nome,
    documento: documentoRaw === null || documentoRaw === undefined ? null : String(documentoRaw).trim() || null,
    ativo: row.ativo === undefined ? undefined : Boolean(row.ativo),
    sapOnly: row.sapOnly === undefined ? undefined : Boolean(row.sapOnly),
    sapExternalId:
      sapExternalIdRaw === null || sapExternalIdRaw === undefined ? null : String(sapExternalIdRaw).trim() || null,
  };
}

function normalizeList(payload: unknown): PnCatalogOption[] {
  if (!Array.isArray(payload)) return [];
  const normalized = payload
    .map((item) => normalizePnItem(item))
    .filter((item): item is PnCatalogOption => item !== null);
  normalized.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return normalized;
}

function readPersistedCatalog(): PnCatalogOption[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedPnCatalog>;
    if (parsed.version !== 1 || !Array.isArray(parsed.items) || typeof parsed.updatedAt !== "number") return null;
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) return null;
    return normalizeList(parsed.items);
  } catch {
    return null;
  }
}

function persistCatalog(items: PnCatalogOption[]) {
  if (typeof window === "undefined") return;
  const payload: PersistedPnCatalog = {
    version: 1,
    updatedAt: Date.now(),
    items,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function filterBySearch(items: PnCatalogOption[], search: string): PnCatalogOption[] {
  const normalized = normalizeSearch(search);
  if (!normalized) return items;
  const normalizedDigits = normalized.replace(/\D/g, "");
  return items.filter((item) => {
    const nome = normalizeSearch(item.nome);
    const codigo = normalizeSearch(item.codigo ?? "");
    const documento = String(item.documento ?? "").replace(/\D/g, "");
    if (nome.includes(normalized) || codigo.includes(normalized)) return true;
    if (normalizedDigits && documento.includes(normalizedDigits)) return true;
    return false;
  });
}

async function fetchFullCatalogFromApi(): Promise<PnCatalogOption[]> {
  const response = await fetch("/api/cadastros/parceiros?limit=all", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Falha ao carregar catálogo de parceiros.");
  const payload = await response.json();
  const normalized = normalizeList(payload);
  memoryPnCatalog = normalized;
  persistCatalog(normalized);
  return normalized;
}

export function getPnCatalogSnapshot(): PnCatalogOption[] {
  if (memoryPnCatalog) return memoryPnCatalog;
  const persisted = readPersistedCatalog();
  if (persisted) {
    memoryPnCatalog = persisted;
    return persisted;
  }
  return [];
}

export async function preloadPnCatalog(force = false): Promise<PnCatalogOption[]> {
  if (typeof window === "undefined") return [];
  if (!force) {
    const snapshot = getPnCatalogSnapshot();
    if (snapshot.length > 0) return snapshot;
  }
  if (inflightPreload) return inflightPreload;
  inflightPreload = fetchFullCatalogFromApi().finally(() => {
    inflightPreload = null;
  });
  return inflightPreload;
}

export async function queryPnCatalog(search: string, options?: QueryPnCatalogOptions): Promise<PnCatalogOption[]> {
  const allItems = await preloadPnCatalog(false);
  const filtered = filterBySearch(allItems, search);
  const term = search.trim();
  const searchLimit = options?.searchLimit ?? 5000;
  const emptyLimit = options?.emptyLimit ?? 1500;
  return filtered.slice(0, term ? searchLimit : emptyLimit);
}

export function upsertPnCatalogItem(item: PnCatalogOption) {
  const normalized = normalizePnItem(item);
  if (!normalized) return;
  const current = getPnCatalogSnapshot();
  const index = current.findIndex((entry) => entry.id === normalized.id);
  let next: PnCatalogOption[];
  if (index < 0) {
    next = [normalized, ...current];
  } else {
    next = current.map((entry, i) => (i === index ? normalized : entry));
  }
  next.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  memoryPnCatalog = next;
  persistCatalog(next);
}
