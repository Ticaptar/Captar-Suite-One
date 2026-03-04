type SapSession = {
  cookie: string;
  expiresAt: number;
};

type LoginResponse = {
  SessionId?: string;
  SessionTimeout?: number;
  RouteId?: string;
};

type ODataListResponse<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
  "odata.nextLink"?: string;
};

type TimedCache<T> = {
  value: T;
  expiresAt: number;
};

export type SapBusinessPartner = {
  cardCode: string;
  cardName: string;
  document: string | null;
  active: boolean;
};

export type SapBusinessPartnerProfile = {
  cardCode: string;
  cardName: string;
  document: string | null;
  rgIe: string | null;
  phone: string | null;
  email: string | null;
  legalRep: string | null;
  cpf: string | null;
  rg: string | null;
  profession: string | null;
  maritalStatus: string | null;
  bank: string | null;
  agency: string | null;
  account: string | null;
  digit: string | null;
  address: string | null;
  paymentTermCode: string | null;
  paymentMethodCode: string | null;
  paymentTerm: string | null;
  paymentMethod: string | null;
  paymentMethods: SapCatalogOption[];
};

export type SapBusinessPartnerFinanceDefaults = {
  condicaoPagamentoCode: string | null;
  condicaoPagamento: string | null;
  formaPagamentoCode: string | null;
  formaPagamento: string | null;
  formasPagamento: SapCatalogOption[];
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  digito: string | null;
};

export type SapBranch = {
  externalId: string;
  code: string | null;
  name: string;
  cnpj: string | null;
  active: boolean;
};

export type SapPurchaseOrderLineInput = {
  itemCode: string;
  quantity: number;
  unitPrice?: number | null;
  warehouseCode?: string | null;
  costingCode?: string | null;
  distributionRule?: string | null;
  usage?: string | number | null;
  taxCode?: string | null;
  shipDate?: string | null;
};

export type SapPurchaseOrderCreateInput = {
  cardCode: string;
  docDate?: string | null;
  docDueDate?: string | null;
  taxDate?: string | null;
  numAtCard?: string | null;
  comments?: string | null;
  bplId?: number | null;
  paymentGroupCode?: number | null;
  paymentMethod?: string | null;
  lines: SapPurchaseOrderLineInput[];
};

export type SapPurchaseOrderCreateResult = {
  docEntry: number | null;
  docNum: number | null;
  raw: Record<string, unknown>;
};

let sessionCache: SapSession | null = null;
let sessionPromise: Promise<SapSession> | null = null;

const CACHE_TTL_MS = {
  partners: 5 * 60 * 1000,
  branches: 10 * 60 * 1000,
  contratoCatalog: 10 * 60 * 1000,
} as const;

let partnersCache: TimedCache<SapBusinessPartner[]> | null = null;
let partnersPromise: Promise<SapBusinessPartner[]> | null = null;

let branchesCache: TimedCache<SapBranch[]> | null = null;
let branchesPromise: Promise<SapBranch[]> | null = null;

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  return value ?? "";
}

function getConfig() {
  const baseUrl = readEnv("SAP_SL_BASE_URL");
  const companyDb = readEnv("SAP_SL_COMPANY_DB");
  const username = readEnv("SAP_SL_USERNAME");
  const password = readEnv("SAP_SL_PASSWORD");

  return {
    baseUrl,
    companyDb,
    username,
    password,
    configured: Boolean(baseUrl && companyDb && username && password),
  };
}

function buildBaseUrl(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.replace(/\/+$/, "");
  const lower = trimmed.toLowerCase();

  if (lower.endsWith("/b1s/v1") || lower.endsWith("/b1s/v2")) {
    return trimmed;
  }

  if (lower.endsWith("/b1s")) {
    return `${trimmed}/v1`;
  }

  return `${trimmed}/b1s/v1`;
}

function normalizeDocument(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = String(value).replace(/\D/g, "");
  return parsed.length === 0 ? null : parsed;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isSapServiceLayerConfigured(): boolean {
  return getConfig().configured;
}

async function login(): Promise<SapSession> {
  const config = getConfig();
  if (!config.configured) {
    throw new Error("Configuração SAP Service Layer ausente.");
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[DEBUG SAP SL RAW BASE]", config.baseUrl);
    console.info("[DEBUG SAP SL RAW PATH]", "/Login");
  }
  const url = `${buildBaseUrl(config.baseUrl)}/Login`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      CompanyDB: config.companyDb,
      UserName: config.username,
      Password: config.password,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha no login SAP Service Layer (${response.status}) em ${url}: ${body.slice(0, 200)}`);
  }

  const body = (await response.json().catch(() => ({}))) as LoginResponse;
  const cookieFromHeader = response.headers.get("set-cookie");

  let cookie = cookieFromHeader ?? "";
  if (!cookie && body.SessionId) {
    const route = body.RouteId ? `; ROUTEID=${body.RouteId}` : "";
    cookie = `B1SESSION=${body.SessionId}${route}`;
  }

  if (!cookie) {
    throw new Error("Login SAP Service Layer sem cookie de sessão.");
  }

  const timeoutMinutes = body.SessionTimeout && body.SessionTimeout > 0 ? body.SessionTimeout : 20;
  const expiresAt = Date.now() + (timeoutMinutes - 1) * 60 * 1000;

  return { cookie, expiresAt };
}

async function getSession(): Promise<SapSession> {
  if (sessionCache && sessionCache.expiresAt > Date.now()) {
    return sessionCache;
  }

  if (!sessionPromise) {
    sessionPromise = login()
      .then((session) => {
        sessionCache = session;
        return session;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }

  return sessionPromise;
}

async function requestJson<T>(pathAndQuery: string, retry = true): Promise<T> {
  const config = getConfig();
  if (!config.configured) {
    throw new Error("Configuração SAP Service Layer ausente.");
  }

  const session = await getSession();
  const url = `${buildBaseUrl(config.baseUrl)}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  if (process.env.NODE_ENV !== "production") {
    console.info("[DEBUG SAP SL RAW BASE]", config.baseUrl);
    console.info("[DEBUG SAP SL RAW PATH]", pathAndQuery);
    console.info("[DEBUG SAP SL] GET", url);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: session.cookie,
    },
    cache: "no-store",
  });

  if (response.status === 401 && retry) {
    sessionCache = null;
    sessionPromise = null;
    return requestJson<T>(pathAndQuery, false);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha na consulta SAP Service Layer (${response.status}) em ${url}: ${body.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

async function requestJsonPost<T>(pathAndQuery: string, body: Record<string, unknown>, retry = true): Promise<T> {
  const config = getConfig();
  if (!config.configured) {
    throw new Error("ConfiguraÃ§Ã£o SAP Service Layer ausente.");
  }

  const session = await getSession();
  const url = `${buildBaseUrl(config.baseUrl)}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  if (process.env.NODE_ENV !== "production") {
    console.info("[DEBUG SAP SL RAW BASE]", config.baseUrl);
    console.info("[DEBUG SAP SL RAW PATH]", pathAndQuery);
    console.info("[DEBUG SAP SL] POST", url);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: session.cookie,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (response.status === 401 && retry) {
    sessionCache = null;
    sessionPromise = null;
    return requestJsonPost<T>(pathAndQuery, body, false);
  }

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(`Falha na consulta SAP Service Layer (${response.status}) em ${url}: ${responseBody.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

function toSapDate(value: unknown): string | null {
  const parsed = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null;
}

function toSapNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function parseUsageValue(value: unknown): { numeric: number | null; text: string | null } {
  const raw = normalizeText(value);
  if (!raw) return { numeric: null, text: null };

  const numericDirect = toSapNumber(raw);
  if (numericDirect !== null) {
    return { numeric: numericDirect, text: null };
  }

  const prefix = raw.split(" - ")[0]?.trim() ?? "";
  const numericPrefix = toSapNumber(prefix);
  if (numericPrefix !== null) {
    return { numeric: numericPrefix, text: raw };
  }

  return { numeric: null, text: raw };
}

function isPostingDateRangeError(message: string): boolean {
  const normalized = normalizeText(message).toLowerCase();
  return normalized.includes("posting date deviates from the defined range");
}

export async function createPurchaseOrderInSap(input: SapPurchaseOrderCreateInput): Promise<SapPurchaseOrderCreateResult> {
  if (!isSapServiceLayerConfigured()) {
    throw new Error("ConfiguraÃ§Ã£o SAP Service Layer ausente.");
  }

  const cardCode = normalizeText(input.cardCode);
  if (!cardCode) {
    throw new Error("CardCode do parceiro nao informado para o pedido SAP.");
  }

  const lines = input.lines
    .map((line) => {
      const itemCode = normalizeText(line.itemCode);
      const quantity = toSapNumber(line.quantity);
      if (!itemCode || quantity === null || quantity <= 0) return null;

      const mapped: Record<string, unknown> = {
        ItemCode: itemCode,
        Quantity: quantity,
      };

      const unitPrice = toSapNumber(line.unitPrice);
      if (unitPrice !== null && unitPrice >= 0) mapped.UnitPrice = unitPrice;

      const warehouseCode = normalizeText(line.warehouseCode);
      if (warehouseCode) mapped.WarehouseCode = warehouseCode;

      const costingCode = normalizeText(line.distributionRule ?? line.costingCode);
      if (costingCode) mapped.CostingCode = costingCode;

      const usage = parseUsageValue(line.usage);
      if (usage.numeric !== null) mapped.Usage = usage.numeric;
      if (usage.text) mapped.U_Utilizacao = usage.text;

      const taxCode = normalizeText(line.taxCode);
      if (taxCode) mapped.TaxCode = taxCode;

      const shipDate = toSapDate(line.shipDate);
      if (shipDate) mapped.ShipDate = shipDate;

      return mapped;
    })
    .filter((line): line is Record<string, unknown> => line !== null);

  if (lines.length === 0) {
    throw new Error("Nenhum item valido encontrado para gerar o pedido de compra no SAP.");
  }

  const payload: Record<string, unknown> = {
    CardCode: cardCode,
    DocumentLines: lines,
  };

  const docDate = toSapDate(input.docDate);
  if (docDate) payload.DocDate = docDate;

  const docDueDate = toSapDate(input.docDueDate);
  if (docDueDate) payload.DocDueDate = docDueDate;

  const taxDate = toSapDate(input.taxDate);
  if (taxDate) payload.TaxDate = taxDate;

  const comments = normalizeText(input.comments);
  if (comments) payload.Comments = comments;

  const numAtCard = normalizeText(input.numAtCard);
  if (numAtCard) payload.NumAtCard = numAtCard;

  const bplId = toSapNumber(input.bplId);
  if (bplId !== null) payload.BPL_IDAssignedToInvoice = bplId;

  const paymentGroupCode = toSapNumber(input.paymentGroupCode);
  if (paymentGroupCode !== null) payload.PaymentGroupCode = paymentGroupCode;

  const paymentMethod = normalizeText(input.paymentMethod);
  if (paymentMethod) payload.PaymentMethod = paymentMethod;

  let response: Record<string, unknown>;
  try {
    response = await requestJsonPost<Record<string, unknown>>("/PurchaseOrders", payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!isPostingDateRangeError(message)) {
      throw error;
    }

    const today = new Date().toISOString().slice(0, 10);
    payload.DocDate = today;
    payload.DocDueDate = today;
    payload.TaxDate = today;
    response = await requestJsonPost<Record<string, unknown>>("/PurchaseOrders", payload);
  }
  const docEntry = toSapNumber(response.DocEntry);
  const docNum = toSapNumber(response.DocNum);

  return {
    docEntry: docEntry === null ? null : Math.trunc(docEntry),
    docNum: docNum === null ? null : Math.trunc(docNum),
    raw: response,
  };
}

async function tryReadCollection(pathAndQuery: string): Promise<Record<string, unknown>[] | null> {
  try {
    const json = await requestJson<ODataListResponse<Record<string, unknown>>>(pathAndQuery);
    if (!Array.isArray(json.value)) return [];
    return json.value;
  } catch {
    return null;
  }
}

async function tryReadEntity(pathAndQuery: string): Promise<Record<string, unknown> | null> {
  try {
    const json = await requestJson<Record<string, unknown>>(pathAndQuery);
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    return json;
  } catch {
    return null;
  }
}

async function tryReadCollectionPaged(
  pathAndQuery: string,
  maxPages: number,
): Promise<Record<string, unknown>[] | null> {
  try {
    const rows: Record<string, unknown>[] = [];
    let currentPath = pathAndQuery;
    let page = 0;

    while (currentPath && page < maxPages) {
      const json = await requestJson<ODataListResponse<Record<string, unknown>>>(currentPath);
      if (Array.isArray(json.value)) {
        rows.push(...json.value);
      }

      const nextLink = extractNextLink(json);
      if (!nextLink) {
        break;
      }

      currentPath = normalizeNextPath(nextLink);
      page += 1;
    }

    return rows;
  } catch {
    return null;
  }
}

function extractNextLink<T>(json: ODataListResponse<T>): string | null {
  const next = json["@odata.nextLink"] ?? json["odata.nextLink"];
  return typeof next === "string" && next.trim() ? next.trim() : null;
}

function normalizeNextPath(nextLink: string): string {
  if (nextLink.startsWith("http://") || nextLink.startsWith("https://")) {
    const parsed = new URL(nextLink);
    return `${parsed.pathname}${parsed.search}`;
  }
  if (nextLink.startsWith("/")) {
    return nextLink;
  }
  return `/${nextLink}`;
}

export async function listBusinessPartnersFromSap(search: string, limit: number): Promise<SapBusinessPartner[]> {
  if (!isSapServiceLayerConfigured()) {
    return [];
  }

  const maxItems = !Number.isFinite(limit) || limit <= 0 ? 20000 : Math.min(Math.max(limit, 1), 20000);
  const searchTerm = search.trim();
  if (searchTerm) {
    const [fromSearch, mapped] = await Promise.all([loadPartnersBySearch(searchTerm, maxItems), getCachedPartners()]);

    const searchNormalized = normalizeSearchText(searchTerm);
    const searchDoc = searchNormalized.replace(/\D/g, "");
    const fromCache = mapped.filter((item) =>
      normalizeSearchText(item.cardName).includes(searchNormalized) ||
      normalizeSearchText(item.cardCode).includes(searchNormalized) ||
      (searchDoc ? (item.document ?? "").includes(searchDoc) : false),
    );

    const merged = mergeBusinessPartners(fromSearch, fromCache).slice(0, maxItems);
    if (merged.length > 0) return merged;
  }

  const mapped = await getCachedPartners();

  const searchNormalized = normalizeSearchText(searchTerm);
  const searchDoc = searchNormalized.replace(/\D/g, "");

  const filtered = searchNormalized
    ? mapped.filter((item) =>
        normalizeSearchText(item.cardName).includes(searchNormalized) ||
        normalizeSearchText(item.cardCode).includes(searchNormalized) ||
        (searchDoc ? (item.document ?? "").includes(searchDoc) : false),
      )
    : mapped;

  if (!Number.isFinite(maxItems) || maxItems <= 0) {
    return filtered;
  }
  return filtered.slice(0, maxItems);
}

export async function getBusinessPartnerProfileFromSap(cardCode: string): Promise<SapBusinessPartnerProfile | null> {
  if (!isSapServiceLayerConfigured()) {
    return null;
  }

  const normalizedReference = normalizeText(cardCode);
  if (!normalizedReference) {
    return null;
  }

  const encodedReference = encodeURIComponent(escapeODataString(normalizedReference));
  const directEntityQueries = [
    `/BusinessPartners('${encodedReference}')?$expand=BPBankAccounts,BPAddresses,BPPaymentMethods`,
    `/BusinessPartners('${encodedReference}')?$select=CardCode,CardName,FederalTaxID,Phone1,Phone2,Cellular,E_Mail,AdditionalID,StateInscription,ContactPerson,LegalRepresentative,CPF,RG,Profession,MaritalStatus,Street,StreetNo,Block,City,County,State,ZipCode,Country,PayTermsGrpCode,PaymentTermsGroupCode,PymCode,PaymentMethodCode,PeymentMethodCode&$expand=BPBankAccounts,BPAddresses,BPPaymentMethods`,
    `/BusinessPartners('${encodedReference}')?$select=CardCode,CardName,FederalTaxID,Phone1,Phone2,Cellular,E_Mail,PayTermsGrpCode,PaymentTermsGroupCode,PymCode,PaymentMethodCode,PeymentMethodCode&$expand=BPBankAccounts,BPPaymentMethods`,
  ];
  for (const query of directEntityQueries) {
    const entity = await tryReadEntity(query);
    if (!entity) continue;
    return mapBusinessPartnerProfileFromRow(entity);
  }

  const escapedReference = escapeODataString(normalizedReference);
  const referenceDocumentDigits = normalizeDocument(normalizedReference);
  const filterCandidates = [
    `CardCode eq '${escapedReference}'`,
    `CardName eq '${escapedReference}'`,
    `contains(CardCode,'${escapedReference}') or contains(CardName,'${escapedReference}')`,
  ];
  if (referenceDocumentDigits && referenceDocumentDigits.length >= 8) {
    const escapedDoc = escapeODataString(referenceDocumentDigits);
    filterCandidates.push(`FederalTaxID eq '${escapedDoc}'`);
    filterCandidates.push(`TaxIdNum eq '${escapedDoc}'`);
    filterCandidates.push(`contains(FederalTaxID,'${escapedDoc}')`);
    filterCandidates.push(`contains(TaxIdNum,'${escapedDoc}')`);
  }

  for (const filter of filterCandidates) {
    const encodedFilter = encodeURIComponent(filter);
    const queryCandidates = [
      `/BusinessPartners?$filter=${encodedFilter}&$top=1&$expand=BPBankAccounts,BPAddresses,BPPaymentMethods`,
      `/BusinessPartners?$filter=${encodedFilter}&$top=1&$select=CardCode,CardName,FederalTaxID,Phone1,Phone2,Cellular,E_Mail,AdditionalID,StateInscription,ContactPerson,LegalRepresentative,CPF,RG,Profession,MaritalStatus,Street,StreetNo,Block,City,County,State,ZipCode,Country,PayTermsGrpCode,PaymentTermsGroupCode,PymCode,PaymentMethodCode,PeymentMethodCode&$expand=BPBankAccounts,BPAddresses,BPPaymentMethods`,
      `/BusinessPartners?$filter=${encodedFilter}&$top=1&$select=CardCode,CardName,FederalTaxID,Phone1,Phone2,Cellular,E_Mail,PayTermsGrpCode,PaymentTermsGroupCode,PymCode,PaymentMethodCode,PeymentMethodCode&$expand=BPBankAccounts,BPPaymentMethods`,
      `/BusinessPartners?$filter=${encodedFilter}&$top=1&$expand=BPBankAccounts,BPPaymentMethods`,
      `/BusinessPartners?$filter=${encodedFilter}&$top=1&$select=CardCode,CardName,FederalTaxID,Phone1,Phone2,Cellular,E_Mail`,
      `/BusinessPartners?$filter=${encodedFilter}&$top=1`,
    ];

    for (const query of queryCandidates) {
      const rows = await tryReadCollection(query);
      if (!rows || rows.length === 0) {
        continue;
      }
      return mapBusinessPartnerProfileFromRow(rows[0]);
    }
  }

  return null;
}

export async function getBusinessPartnerFinanceDefaultsFromSap(
  reference: string,
): Promise<SapBusinessPartnerFinanceDefaults | null> {
  const profile = await getBusinessPartnerProfileFromSap(reference);
  if (!profile) return null;

  const formasPagamento =
    profile.paymentMethods.length > 0
      ? profile.paymentMethods
      : profile.paymentMethodCode || profile.paymentMethod
      ? [
          {
            value: profile.paymentMethodCode ?? profile.paymentMethod ?? "",
            label: profile.paymentMethodCode && profile.paymentMethod
              ? `${profile.paymentMethodCode} - ${profile.paymentMethod}`
              : profile.paymentMethod ?? profile.paymentMethodCode ?? "",
          },
        ]
      : [];

  return {
    condicaoPagamentoCode: profile.paymentTermCode,
    condicaoPagamento: profile.paymentTerm ?? profile.paymentTermCode,
    formaPagamentoCode: profile.paymentMethodCode,
    formaPagamento: profile.paymentMethod ?? profile.paymentMethodCode,
    formasPagamento: dedupeOptions(formasPagamento),
    banco: profile.bank,
    agencia: profile.agency,
    conta: profile.account,
    digito: profile.digit,
  };
}

async function getCachedPartners(): Promise<SapBusinessPartner[]> {
  if (isCacheValid(partnersCache)) {
    return partnersCache.value;
  }

  if (!partnersPromise) {
    partnersPromise = loadPartners()
      .then((partners) => {
        partnersCache = {
          value: partners,
          expiresAt: Date.now() + CACHE_TTL_MS.partners,
        };
        return partners;
      })
      .finally(() => {
        partnersPromise = null;
      });
  }

  return partnersPromise;
}

async function loadPartners(): Promise<SapBusinessPartner[]> {
  const top = 1000;
  const partnersMaxPages = Math.max(Number.parseInt(readEnv("SAP_SL_PARTNERS_MAX_PAGES") || "200", 10) || 200, 1);
  const selectCandidates = [
    "CardCode,CardName,FederalTaxID,Frozen,ValidFor",
    "CardCode,CardName,FederalTaxID,Frozen",
    "CardCode,CardName,Frozen",
    "",
  ];

  let rows: ODataListResponse<Record<string, unknown>> | null = null;
  let lastError: Error | null = null;

  for (const selectClause of selectCandidates) {
    const query = selectClause
      ? `/BusinessPartners?$select=${selectClause}&$orderby=CardName&$top=${top}`
      : `/BusinessPartners?$orderby=CardName&$top=${top}`;
    try {
      const paged = await tryReadCollectionPaged(query, partnersMaxPages);
      if (paged) {
        rows = { value: paged };
        break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Falha ao consultar BusinessPartners.");
    }
  }

  if (!rows) {
    throw lastError ?? new Error("Falha ao consultar BusinessPartners.");
  }

  return mapBusinessPartnersFromRows(rows.value ?? []);
}

async function loadPartnersBySearch(search: string, limit: number): Promise<SapBusinessPartner[]> {
  const top = Math.min(Math.max(limit, 200), 1000);
  const maxPages = Math.max(Number.parseInt(readEnv("SAP_SL_PARTNERS_SEARCH_MAX_PAGES") || "20", 10) || 20, 1);
  const filters = buildBusinessPartnerSearchFilters(search);
  const selectCandidates = [
    "CardCode,CardName,FederalTaxID,Frozen,ValidFor",
    "CardCode,CardName,FederalTaxID,Frozen",
    "CardCode,CardName,Frozen",
    "",
  ];

  const foundRows: Record<string, unknown>[] = [];
  const seenCodes = new Set<string>();

  const appendRows = (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const code = normalizeText(row.CardCode).toUpperCase();
      if (!code || seenCodes.has(code)) continue;
      seenCodes.add(code);
      foundRows.push(row);
      if (foundRows.length >= limit) return;
    }
  };

  for (const filter of filters) {
    const encodedFilter = encodeURIComponent(filter);
    for (const selectClause of selectCandidates) {
      const query = selectClause
        ? `/BusinessPartners?$select=${selectClause}&$filter=${encodedFilter}&$orderby=CardName&$top=${top}`
        : `/BusinessPartners?$filter=${encodedFilter}&$orderby=CardName&$top=${top}`;
      const rows = await tryReadCollectionPaged(query, maxPages);
      if (!rows) {
        continue;
      }
      appendRows(rows);
      if (foundRows.length >= limit) {
        return mapBusinessPartnersFromRows(foundRows).slice(0, limit);
      }
    }
  }

  if (foundRows.length > 0) {
    return mapBusinessPartnersFromRows(foundRows).slice(0, limit);
  }

  return [];
}

function buildBusinessPartnerSearchFilters(search: string): string[] {
  const term = search.trim();
  if (!term) return [];

  const variants = Array.from(
    new Set(
      [term, term.toUpperCase(), term.toLowerCase(), toTitleCase(term)]
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
  const digits = term.replace(/\D/g, "");
  const filters: string[] = [];

  for (const variant of variants) {
    const escaped = escapeODataString(variant);
    const base = [`contains(CardName,'${escaped}')`, `contains(CardCode,'${escaped}')`];
    filters.push(base.join(" or "));
    if (digits.length >= 3) {
      const escapedDigits = escapeODataString(digits);
      filters.push(`${base.join(" or ")} or contains(FederalTaxID,'${escapedDigits}')`);
    }
  }

  if (digits.length >= 3) {
    const escapedDigits = escapeODataString(digits);
    filters.push(`contains(CardCode,'${escapedDigits}')`);
    filters.push(`contains(CardCode,'${escapedDigits}') or contains(FederalTaxID,'${escapedDigits}')`);
  }

  const escapedExact = escapeODataString(term);
  filters.push(`CardCode eq '${escapedExact}'`);
  filters.push(`CardName eq '${escapedExact}'`);

  return Array.from(new Set(filters));
}

function mergeBusinessPartners(...groups: SapBusinessPartner[][]): SapBusinessPartner[] {
  const byKey = new Map<string, SapBusinessPartner>();
  for (const group of groups) {
    for (const item of group) {
      const code = normalizeText(item.cardCode).toUpperCase();
      if (!code) continue;
      if (!byKey.has(code)) byKey.set(code, item);
    }
  }
  return Array.from(byKey.values());
}

function mapBusinessPartnersFromRows(rows: Record<string, unknown>[]): SapBusinessPartner[] {
  return rows
    .map((item) => {
      const cardCode = normalizeText(item.CardCode);
      const cardName = normalizeText(item.CardName);
      const document = normalizeDocument(
        item.FederalTaxID ??
          item.LicTradNum ??
          item.TaxIdNum ??
          item.CPF ??
          item.CNPJ,
      );
      const frozen = normalizeText(item.Frozen).toLowerCase();
      const validFor = normalizeText(item.ValidFor).toLowerCase();
      const active = frozen !== "tyes" && validFor !== "tno";

      return {
        cardCode,
        cardName,
        document,
        active,
      } satisfies SapBusinessPartner;
    })
    .filter((item) => item.cardCode && item.cardName);
}

async function mapBusinessPartnerProfileFromRow(row: Record<string, unknown>): Promise<SapBusinessPartnerProfile> {
  const address = composeBusinessPartnerAddress(row);
  const bankInfo = composeBusinessPartnerBank(row);
  const paymentTermCode = firstNonEmptyText([
    row.PayTermsGrpCode,
    row.PaymentTermsGroupCode,
    row.GroupNum,
  ]);
  const [paymentTerms, paymentMethods] = await Promise.all([listPaymentTermsFromSap(), listPaymentMethodsFromSap()]);
  const paymentMethodOptions = composeBusinessPartnerPaymentMethods(row, paymentMethods);
  const paymentMethodFromBp = composeBusinessPartnerPaymentMethod(row, paymentMethods);
  const paymentMethodCode = firstNonEmptyText([
    paymentMethodFromBp.code,
    row.PeymentMethodCode,
    row.PaymentMethodCode,
    row.PymCode,
    row.PeyMethod,
    row.PaymentMethod,
  ]);
  const paymentTerm = findOptionLabel(paymentTerms, paymentTermCode);
  const paymentMethod = paymentMethodFromBp.label || findOptionLabel(paymentMethods, paymentMethodCode);

  return {
    cardCode: normalizeText(row.CardCode),
    cardName: normalizeText(row.CardName),
    document: normalizeDocument(
      row.FederalTaxID ?? row.LicTradNum ?? row.TaxIdNum ?? row.CPF ?? row.CNPJ ?? row.VatNumber,
    ),
    rgIe: firstNonEmptyText([
      row.AdditionalID,
      row.StateInscription,
      row.StateTaxNumber,
      row.StateTaxId,
      row.StateTaxID,
      row.RGIE,
      row.RgIe,
      row.LicTradNum,
    ]),
    phone: firstNonEmptyText([row.Phone1, row.Phone2, row.Cellular]),
    email: firstNonEmptyText([row.E_Mail, row.EmailAddress]),
    legalRep: firstNonEmptyText([
      row.ContactPerson,
      row.LegalRepresentative,
      row.U_RepLegal,
      row.U_REP_LEGAL,
    ]),
    cpf: normalizeDocument(row.CPF),
    rg: firstNonEmptyText([row.RG, row.IdentNum]),
    profession: firstNonEmptyText([row.Profession, row.U_Profissao, row.U_PROFISSAO]),
    maritalStatus: firstNonEmptyText([row.MaritalStatus, row.U_EstadoCivil, row.U_ESTADO_CIVIL]),
    bank: firstNonEmptyText([bankInfo.bank, row.BankCode, row.HouseBank, row.U_Banco, row.U_BANCO]),
    agency: firstNonEmptyText([bankInfo.agency, row.BankBranch, row.HouseBankBranch, row.U_Agencia, row.U_AGENCIA]),
    account: firstNonEmptyText([bankInfo.account, row.BankAccount, row.HouseBankAccount, row.U_Conta, row.U_CONTA]),
    digit: firstNonEmptyText([bankInfo.digit, row.HouseBankAccountDigit, row.AccountDigit, row.U_Digito, row.U_DIGITO]),
    address,
    paymentTermCode,
    paymentMethodCode,
    paymentTerm,
    paymentMethod,
    paymentMethods: paymentMethodOptions,
  };
}

function composeBusinessPartnerPaymentMethod(
  row: Record<string, unknown>,
  paymentMethodCatalog: SapCatalogOption[],
): { code: string | null; label: string | null } {
  const options = composeBusinessPartnerPaymentMethods(row, paymentMethodCatalog);
  if (options.length > 0) {
    const preferredCodeFromRow = extractPreferredPaymentMethodCode(row);
    const preferred =
      (preferredCodeFromRow
        ? options.find((option) => normalizeText(option.value).toUpperCase() === preferredCodeFromRow.toUpperCase())
        : null) ?? options[0];
    if (preferred) {
      const preferredCode = normalizeText(preferred.value) || null;
      const preferredLabel = (findOptionLabel(paymentMethodCatalog, preferredCode) ?? normalizeText(preferred.label)) || null;
      return {
        code: preferredCode,
        label: preferredLabel ?? preferredCode,
      };
    }
  }

  const preferredCode = extractPreferredPaymentMethodCode(row);
  const preferredLabel = findOptionLabel(paymentMethodCatalog, preferredCode);
  if (!preferredCode && !preferredLabel) {
    return { code: null, label: null };
  }
  return {
    code: preferredCode,
    label: preferredLabel ?? preferredCode,
  };
}

function composeBusinessPartnerPaymentMethods(
  row: Record<string, unknown>,
  paymentMethodCatalog: SapCatalogOption[],
): SapCatalogOption[] {
  const methods = Array.isArray(row.BPPaymentMethods)
    ? (row.BPPaymentMethods.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<
        string,
        unknown
      >[])
    : [];

  if (methods.length === 0) {
    return [];
  }

  const fallbackMap = new Map<string, string>();
  for (const option of paymentMethodCatalog) {
    const key = normalizeText(option.value).toUpperCase();
    const label = findOptionLabel(paymentMethodCatalog, option.value) ?? normalizeText(option.label);
    if (key && label && !fallbackMap.has(key)) {
      fallbackMap.set(key, label);
    }
  }

  const options: SapCatalogOption[] = [];
  for (const method of methods) {
    const code = firstNonEmptyText([
      method.PaymentMethodCode,
      method.PymCode,
      method.PayMethCod,
      method.MethodCode,
      method.Code,
    ]);
    const name = firstNonEmptyText([
      method.PaymentMethodName,
      method.Description,
      method.Descript,
      method.Name,
    ]);
    const fallback = code ? fallbackMap.get(code.toUpperCase()) ?? null : null;
    const labelBody = firstNonEmptyText([name, fallback, code]);
    if (!labelBody) continue;
    const value = code ?? labelBody;
    const label = code && labelBody.toUpperCase() !== code.toUpperCase() ? `${code} - ${labelBody}` : labelBody;
    options.push({ value, label });
  }

  const deduped = dedupeOptions(options);
  if (deduped.length > 0) {
    return deduped;
  }

  const preferredCode = extractPreferredPaymentMethodCode(row);
  if (!preferredCode) {
    return [];
  }
  const fallbackLabel = findOptionLabel(paymentMethodCatalog, preferredCode);
  return [{ value: preferredCode, label: fallbackLabel ? `${preferredCode} - ${fallbackLabel}` : preferredCode }];
}

function pickPreferredPaymentMethod(methods: Record<string, unknown>[]): Record<string, unknown> | null {
  if (methods.length === 0) return null;

  const defaultMethod = methods.find((method) => {
    const defaultFlag = normalizeText(
      method.Default ?? method.IsDefault ?? method.DefaultMethod ?? method.MainMethod,
    ).toLowerCase();
    return defaultFlag === "t" || defaultFlag === "yes" || defaultFlag === "tyes" || defaultFlag === "true";
  });
  if (defaultMethod) return defaultMethod;

  const activeMethod = methods.find((method) => {
    const activeFlag = normalizeText(method.Active ?? method.ValidFor).toLowerCase();
    return (
      activeFlag === "" ||
      activeFlag === "t" ||
      activeFlag === "yes" ||
      activeFlag === "tyes" ||
      activeFlag === "true"
    );
  });
  if (activeMethod) return activeMethod;

  const withCode = methods.find((method) => firstNonEmptyText([method.PaymentMethodCode, method.PymCode, method.PayMethCod]));
  if (withCode) return withCode;

  return methods[0] ?? null;
}

function extractPreferredPaymentMethodCode(row: Record<string, unknown>): string | null {
  const methods = Array.isArray(row.BPPaymentMethods)
    ? (row.BPPaymentMethods.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<
        string,
        unknown
      >[])
    : [];

  if (methods.length > 0) {
    const preferred = pickPreferredPaymentMethod(methods);
    if (preferred) {
      const fromPreferred = firstNonEmptyText([
        preferred.PaymentMethodCode,
        preferred.PymCode,
        preferred.PayMethCod,
        preferred.MethodCode,
        preferred.Code,
      ]);
      if (fromPreferred) {
        return fromPreferred;
      }
    }
  }

  return firstNonEmptyText([
    row.PeymentMethodCode,
    row.PaymentMethodCode,
    row.PymCode,
    row.PeyMethod,
    row.PaymentMethod,
  ]);
}

function composeBusinessPartnerBank(
  row: Record<string, unknown>,
): { bank: string | null; agency: string | null; account: string | null; digit: string | null } {
  const bankAccounts = Array.isArray(row.BPBankAccounts)
    ? (row.BPBankAccounts.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<
        string,
        unknown
      >[])
    : [];

  if (bankAccounts.length === 0) {
    return { bank: null, agency: null, account: null, digit: null };
  }

  const preferred = pickPreferredBankAccount(bankAccounts);
  if (!preferred) {
    return { bank: null, agency: null, account: null, digit: null };
  }

  const accountNoRaw = normalizeText(preferred.AccountNo ?? preferred.Account ?? preferred.AccountNumber);
  const parsedAccount = splitAccountAndDigit(accountNoRaw);

  return {
    bank: firstNonEmptyText([preferred.BankName, preferred.BankCode, preferred.HouseBank]),
    agency: firstNonEmptyText([preferred.Branch, preferred.BranchNo, preferred.Agency]),
    account: firstNonEmptyText([parsedAccount.account, accountNoRaw]),
    digit: firstNonEmptyText([
      preferred.ControlKey,
      preferred.AccountDigit,
      preferred.HouseBankAccountDigit,
      parsedAccount.digit,
    ]),
  };
}

function pickPreferredBankAccount(accounts: Record<string, unknown>[]): Record<string, unknown> | null {
  if (accounts.length === 0) return null;

  const withMainBank = accounts.find((account) => normalizeText(account.BankCode).length > 0);
  if (withMainBank) return withMainBank;

  const withAccount = accounts.find((account) => normalizeText(account.AccountNo).length > 0);
  if (withAccount) return withAccount;

  return accounts[0] ?? null;
}

function splitAccountAndDigit(value: string): { account: string | null; digit: string | null } {
  const trimmed = normalizeText(value);
  if (!trimmed) return { account: null, digit: null };

  const dashed = trimmed.match(/^(.+)-([A-Za-z0-9]{1,4})$/);
  if (dashed) {
    return {
      account: normalizeText(dashed[1]),
      digit: normalizeText(dashed[2]),
    };
  }

  return { account: trimmed, digit: null };
}

function composeBusinessPartnerAddress(row: Record<string, unknown>): string | null {
  const addresses = Array.isArray(row.BPAddresses)
    ? (row.BPAddresses.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<
        string,
        unknown
      >[])
    : [];

  const preferred = pickPreferredAddress(addresses);
  if (preferred) {
    const parts = [
      normalizeText(preferred.Street),
      normalizeText(preferred.StreetNo),
      normalizeText(preferred.Block),
      normalizeText(preferred.City),
      normalizeText(preferred.County),
      normalizeText(preferred.State),
      normalizeText(preferred.ZipCode),
      normalizeText(preferred.Country),
    ].filter((item) => item.length > 0);
    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  const fallback = [
    normalizeText(row.Street),
    normalizeText(row.StreetNo),
    normalizeText(row.Block),
    normalizeText(row.City),
    normalizeText(row.County),
    normalizeText(row.State),
    normalizeText(row.ZipCode),
    normalizeText(row.Country),
  ].filter((item) => item.length > 0);

  if (fallback.length > 0) {
    return fallback.join(", ");
  }

  return null;
}

function pickPreferredAddress(addresses: Record<string, unknown>[]): Record<string, unknown> | null {
  if (addresses.length === 0) return null;

  const billTo = addresses.find((address) => normalizeText(address.AddressType).toLowerCase().includes("bill"));
  if (billTo) return billTo;

  const firstWithStreet = addresses.find((address) => normalizeText(address.Street).length > 0);
  if (firstWithStreet) return firstWithStreet;

  return addresses[0] ?? null;
}

function findOptionLabel(options: SapCatalogOption[], value: string | null): string | null {
  const code = normalizeText(value);
  if (!code) return null;

  const found = options.find((option) => normalizeText(option.value) === code);
  if (!found) return null;

  const label = normalizeText(found.label);
  if (!label) return null;

  const prefix = `${code} - `;
  if (label.startsWith(prefix)) {
    return label.slice(prefix.length).trim() || label;
  }

  return label;
}

function firstNonEmptyText(values: unknown[]): string | null {
  for (const value of values) {
    const parsed = normalizeText(value);
    if (!parsed) continue;
    if (parsed === "-1") continue;
    if (parsed.toLowerCase() === "null") continue;
    return parsed;
  }
  return null;
}

function escapeODataString(value: string): string {
  return String(value ?? "").replace(/'/g, "''");
}

export async function listItemsFromSap(search: string, limit?: number | null): Promise<SapCatalogOption[]> {
  if (!isSapServiceLayerConfigured()) {
    return [];
  }

  const term = search.trim();
  const unlimited = !Number.isFinite(limit ?? null) || Number(limit) <= 0;
  const top = unlimited ? 1000 : Math.min(Math.max(Number(limit) || 120, 20), 1000);
  const maxPages = unlimited
    ? Math.max(Number.parseInt(readEnv("SAP_SL_ITEMS_MAX_PAGES") || "200", 10) || 200, 1)
    : Math.max(Number.parseInt(readEnv("SAP_SL_ITEMS_SEARCH_MAX_PAGES") || "12", 10) || 12, 1);

  const caseVariants = Array.from(
    new Set(
      [term, term.toUpperCase(), term.toLowerCase(), toTitleCase(term)]
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
  const filterExpression = caseVariants
    .flatMap((item) => {
      const escaped = escapeODataString(item);
      return [`contains(ItemName,'${escaped}')`, `contains(ItemCode,'${escaped}')`];
    })
    .join(" or ");

  const encodedFilter = filterExpression
    ? encodeURIComponent(filterExpression)
    : "";

  const query = term
    ? `/Items?$select=ItemCode,ItemName,QuantityOnStock,InventoryUOM,SalesUnit&$filter=${encodedFilter}&$orderby=ItemName&$top=${top}`
    : `/Items?$select=ItemCode,ItemName,QuantityOnStock,InventoryUOM,SalesUnit&$orderby=ItemName&$top=${top}`;

  const rows = await tryReadCollectionPaged(query, maxPages);
  if (!rows) return [];

  const mapped = dedupeOptions(
    mapRowsToOptions(rows, [
      ["ItemCode", "ItemName"],
      ["Code", "Name"],
    ]),
  );

  return unlimited ? mapped : mapped.slice(0, Number(limit));
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(\p{L})/gu, (match) => match.toUpperCase());
}

export async function listBranchesFromSap(): Promise<SapBranch[]> {
  if (!isSapServiceLayerConfigured()) {
    return [];
  }

  if (isCacheValid(branchesCache)) {
    return branchesCache.value;
  }

  if (!branchesPromise) {
    branchesPromise = loadBranches()
      .then((branches) => {
        branchesCache = {
          value: branches,
          expiresAt: Date.now() + CACHE_TTL_MS.branches,
        };
        return branches;
      })
      .finally(() => {
        branchesPromise = null;
      });
  }

  return branchesPromise;
}

async function loadBranches(): Promise<SapBranch[]> {
  const branchRows =
    (await tryReadCollectionPaged("/Branches?$orderby=BPLName&$top=1000", 8)) ??
    (await tryReadCollectionPaged("/BusinessPlaces?$orderby=BPLName&$top=1000", 8)) ??
    [];

  return branchRows
    .map((item) => {
      const externalId =
        normalizeText(item.BPLId) ||
        normalizeText(item.BPLID) ||
        normalizeText(item.BranchId) ||
        normalizeText(item.Code);

      const code = normalizeText(item.BPLCode ?? item.Code ?? item.AliasName) || null;
      const name =
        normalizeText(item.BPLName) ||
        normalizeText(item.Name) ||
        normalizeText(item.BranchName) ||
        code ||
        externalId;
      const cnpj = normalizeDocument(item.TaxIdNum ?? item.TaxId0 ?? item.FederalTaxID);
      const disabled = normalizeText(item.Disabled).toLowerCase();
      const active = disabled !== "tyes";

      return {
        externalId: externalId || name,
        code,
        name,
        cnpj,
        active,
      } satisfies SapBranch;
    })
    .filter((item) => item.active && item.name)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export type SapCatalogOption = {
  value: string;
  label: string;
};

export type SapContratoItemCatalog = {
  itens: SapCatalogOption[];
  unidades: SapCatalogOption[];
  condicoesPagamento: SapCatalogOption[];
  formasPagamento: SapCatalogOption[];
  depositos: SapCatalogOption[];
  centrosCusto: SapCatalogOption[];
  utilizacoes: SapCatalogOption[];
  moedas: SapCatalogOption[];
};

const EMPTY_CONTRATO_ITEM_CATALOG: SapContratoItemCatalog = {
  itens: [],
  unidades: [],
  condicoesPagamento: [],
  formasPagamento: [],
  depositos: [],
  centrosCusto: [],
  utilizacoes: [],
  moedas: [],
};

let contratoCatalogCache: TimedCache<SapContratoItemCatalog> | null = null;
let contratoCatalogPromise: Promise<SapContratoItemCatalog> | null = null;
let paymentTermsCache: TimedCache<SapCatalogOption[]> | null = null;
let paymentTermsPromise: Promise<SapCatalogOption[]> | null = null;
let paymentMethodsCache: TimedCache<SapCatalogOption[]> | null = null;
let paymentMethodsPromise: Promise<SapCatalogOption[]> | null = null;

export async function listContratoItemCatalogFromSap(): Promise<SapContratoItemCatalog> {
  if (!isSapServiceLayerConfigured()) {
    return EMPTY_CONTRATO_ITEM_CATALOG;
  }

  if (isCacheValid(contratoCatalogCache)) {
    return contratoCatalogCache.value;
  }

  if (!contratoCatalogPromise) {
    contratoCatalogPromise = loadContratoItemCatalogFromSap()
      .then((catalog) => {
        contratoCatalogCache = {
          value: catalog,
          expiresAt: Date.now() + CACHE_TTL_MS.contratoCatalog,
        };
        return catalog;
      })
      .finally(() => {
        contratoCatalogPromise = null;
      });
  }

  return contratoCatalogPromise;
}

async function loadContratoItemCatalogFromSap(): Promise<SapContratoItemCatalog> {
  const [itensRows, depositosRows, centrosRows, moedasRows, unidadesRows, pedidosRows, condicoesPagamento, formasPagamento] = await Promise.all([
    tryReadCollectionPaged(
      "/Items?$select=ItemCode,ItemName,QuantityOnStock,InventoryUOM,SalesUnit&$orderby=ItemName&$top=1000",
      4,
    ),
    tryReadCollectionPaged("/Warehouses?$select=WarehouseCode,WarehouseName,Inactive&$orderby=WarehouseName&$top=1000", 4),
    tryReadCollection("/ProfitCenters?$select=CenterCode,CenterName,InWhichDimension,Active&$orderby=CenterName&$top=500"),
    tryReadCollection("/Currencies?$select=Code,Name&$orderby=Code&$top=120"),
    tryReadCollectionPaged("/UnitOfMeasurements?$select=UoMCode,Name&$orderby=Name&$top=1000", 3),
    tryReadCollectionPaged(
      "/PurchaseOrders?$select=DocEntry,DocNum&$expand=DocumentLines($select=Usage,ItemCode,ItemDescription,U_Utilizacao)&$top=300",
      4,
    ),
    listPaymentTermsFromSap(),
    listPaymentMethodsFromSap(),
  ]);

  const itens = mapRowsToOptions(
    itensRows ?? [],
    [
      ["ItemCode", "ItemName"],
      ["Code", "Name"],
    ],
  );

  const unidades = dedupeOptions([
    ...mapRowsToOptions(unidadesRows ?? [], [["UoMCode", "Name"]]),
    ...extractUnidadesFromItems(itensRows ?? []),
  ]);

  const depositos = mapRowsToOptions(
    (depositosRows ?? []).filter((item) => normalizeText(item.Inactive).toLowerCase() !== "tyes"),
    [
      ["WarehouseCode", "WarehouseName"],
      ["Code", "Name"],
    ],
  );

  const centrosCusto = mapRowsToOptions(
    (centrosRows ?? []).filter((item) => {
      const active = normalizeText(item.Active).toLowerCase();
      return active === "" || active === "t" || active === "yes" || active === "tyes";
    }),
    [
      ["CenterCode", "CenterName"],
      ["Code", "Name"],
    ],
  );

  const moedas = mapRowsToOptions(
    moedasRows ?? [],
    [
      ["Code", "Name"],
      ["CurrCode", "CurrName"],
    ],
  );

  const utilizacoes = extractUtilizacoesFromPedidos(pedidosRows ?? []).slice(0, 5000);

  return {
    itens: dedupeOptions(itens).slice(0, 500),
    unidades: unidades.slice(0, 300),
    condicoesPagamento: dedupeOptions(condicoesPagamento).slice(0, 300),
    formasPagamento: dedupeOptions(formasPagamento).slice(0, 300),
    depositos: dedupeOptions(depositos).slice(0, 300),
    centrosCusto: dedupeOptions(centrosCusto).slice(0, 300),
    utilizacoes,
    moedas: dedupeOptions(moedas).slice(0, 120),
  };
}

async function listPaymentTermsFromSap(): Promise<SapCatalogOption[]> {
  if (!isSapServiceLayerConfigured()) return [];
  if (isCacheValid(paymentTermsCache)) return paymentTermsCache.value;

  if (!paymentTermsPromise) {
    paymentTermsPromise = (async () => {
      const rows =
        (await tryReadCollection(
          "/PaymentTermsTypes?$select=GroupNumber,PaymentTermsGroupName&$orderby=PaymentTermsGroupName&$top=300",
        )) ??
        (await tryReadCollection("/PaymentTermsTypes?$orderby=PaymentTermsGroupName&$top=300")) ??
        [];

      const mapped = dedupeOptions(
        mapRowsToOptions(rows, [
          ["GroupNumber", "PaymentTermsGroupName"],
          ["PayTermsGrpCode", "PaymentTermsGroupName"],
          ["Code", "Name"],
        ]),
      ).slice(0, 300);

      paymentTermsCache = {
        value: mapped,
        expiresAt: Date.now() + CACHE_TTL_MS.contratoCatalog,
      };
      return mapped;
    })().finally(() => {
      paymentTermsPromise = null;
    });
  }

  return paymentTermsPromise;
}

async function listPaymentMethodsFromSap(): Promise<SapCatalogOption[]> {
  if (!isSapServiceLayerConfigured()) return [];
  if (isCacheValid(paymentMethodsCache)) return paymentMethodsCache.value;

  if (!paymentMethodsPromise) {
    paymentMethodsPromise = (async () => {
      const paymentMethodsRows =
        (await tryReadCollection(
          "/PaymentMethods?$select=PayMethCod,Descript,PaymentMethodCode,PaymentMethodName,Code,Name,Active&$orderby=Descript&$top=500",
        )) ??
        (await tryReadCollection("/PaymentMethods?$orderby=Descript&$top=500")) ??
        [];

      const wizardMethodsRows =
        (await tryReadCollection(
          "/WizardPaymentMethods?$select=PaymentMethodCode,Description,Code,Name,Active,ValidFor&$orderby=Description&$top=1000",
        )) ??
        (await tryReadCollection("/WizardPaymentMethods?$orderby=Description&$top=1000")) ??
        [];

      const rows = [...paymentMethodsRows, ...wizardMethodsRows];

      const onlyActive = rows.filter((row) => {
        const active = normalizeText(row.Active).toLowerCase();
        const validFor = normalizeText(row.ValidFor).toLowerCase();
        if (validFor === "tno" || active === "tno" || active === "false" || active === "no") {
          return false;
        }
        return active === "" || active === "t" || active === "yes" || active === "tyes";
      });

      const mapped = dedupeOptions(
        mapRowsToOptions(onlyActive, [
          ["PayMethCod", "Descript"],
          ["PaymentMethodCode", "PaymentMethodName"],
          ["PaymentMethodCode", "Description"],
          ["Code", "Description"],
          ["Code", "Name"],
        ]),
      ).slice(0, 300);

      paymentMethodsCache = {
        value: mapped,
        expiresAt: Date.now() + CACHE_TTL_MS.contratoCatalog,
      };
      return mapped;
    })().finally(() => {
      paymentMethodsPromise = null;
    });
  }

  return paymentMethodsPromise;
}

function isCacheValid<T>(cache: TimedCache<T> | null): cache is TimedCache<T> {
  return Boolean(cache && cache.expiresAt > Date.now());
}

function mapRowsToOptions(
  rows: Record<string, unknown>[],
  keyPairs: Array<[string, string]>,
): SapCatalogOption[] {
  return rows
    .map((row) => {
      for (const [valueKey, labelKey] of keyPairs) {
        const value = normalizeText(row[valueKey]);
        const label = normalizeText(row[labelKey]);
        if (value && label) {
          return {
            value,
            label: `${value} - ${label}`,
          } satisfies SapCatalogOption;
        }
      }
      return null;
    })
    .filter((item): item is SapCatalogOption => item !== null);
}

function extractUnidadesFromItems(rows: Record<string, unknown>[]): SapCatalogOption[] {
  const options: SapCatalogOption[] = [];
  for (const row of rows) {
    const unit = normalizeText(row.InventoryUOM ?? row.SalesUnit ?? row.UomCode);
    if (!unit) continue;
    options.push({ value: unit, label: unit });
  }
  return dedupeOptions(options);
}

function extractUtilizacoesFromPedidos(rows: Record<string, unknown>[]): SapCatalogOption[] {
  const byUso = new Map<string, SapCatalogOption>();

  for (const pedido of rows) {
    const lines = Array.isArray(pedido.DocumentLines) ? (pedido.DocumentLines as Record<string, unknown>[]) : [];
    for (const line of lines) {
      const uso = normalizeText(line.U_Utilizacao ?? line.Usage);
      if (!uso) continue;
      const itemCode = normalizeText(line.ItemCode);
      const itemDescription = normalizeText(line.ItemDescription);
      const complemento = itemDescription || itemCode ? ` - ${itemDescription || itemCode}` : "";
      const label = `${uso}${complemento}`;

      const existing = byUso.get(uso);
      if (!existing) {
        byUso.set(uso, { value: uso, label });
        continue;
      }

      // Atualiza apenas se o registro atual trouxer um label mais informativo.
      if (existing.label === uso && label !== uso) {
        byUso.set(uso, { value: uso, label });
      }
    }
  }

  return Array.from(byUso.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function dedupeOptions(options: SapCatalogOption[]): SapCatalogOption[] {
  const seen = new Set<string>();
  const deduped: SapCatalogOption[] = [];

  for (const option of options) {
    const value = normalizeText(option.value);
    const label = normalizeText(option.label);
    if (!value || !label) continue;
    const key = `${value.toUpperCase()}|${label.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ value, label });
  }

  return deduped;
}
