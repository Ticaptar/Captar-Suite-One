import { getPgPool } from "@/lib/db";
import {
  createPurchaseOrderInSap,
  getBusinessPartnerProfileFromSap,
  type SapPurchaseOrderCreateResult,
} from "@/lib/sap-service-layer";

type JsonRow = Record<string, unknown>;

type ContratoSapSource = {
  contrato?: JsonRow | null;
  itens?: JsonRow[] | null;
  financeiro?: JsonRow[] | null;
  financeiros?: JsonRow[] | null;
};

export type SapPedidoExistente = {
  docEntry: number | null;
  docNum: number | null;
};

export type SapPedidoGerado = {
  docEntry: number | null;
  docNum: number | null;
  cardCode: string;
  lineCount: number;
  raw: Record<string, unknown>;
};

type ParsedItemLine = {
  itemCode: string;
  quantity: number;
  unitPrice: number | null;
  warehouseCode: string | null;
  costingCode: string | null;
  distributionRule: string | null;
  usage: string | null;
  taxCode: string | null;
  shipDate: string | null;
};

type ParsedFinanceInfo = {
  paymentGroupCode: number | null;
  paymentMethod: string | null;
  condicaoLabel: string | null;
  formaLabel: string | null;
};

const OBS_META_MARKER = "/*CS_META*/";

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = String(value).trim();
  return parsed.length > 0 ? parsed : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  const direct = Number(raw);
  if (!Number.isNaN(direct)) return direct;

  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function toInteger(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return Math.trunc(parsed);
}

function normalizeDate(value: unknown): string | null {
  const parsed = toNullableString(value);
  if (!parsed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null;
}

function normalizeDocument(value: unknown): string | null {
  const parsed = toNullableString(value);
  if (!parsed) return null;
  const digits = parsed.replace(/\D/g, "");
  return digits.length > 0 ? digits : parsed;
}

function splitCodeAndLabel(value: string | null): { code: string | null; label: string | null } {
  if (!value) return { code: null, label: null };
  const parsed = value.trim();
  if (!parsed) return { code: null, label: null };

  const separator = " - ";
  const index = parsed.indexOf(separator);
  if (index <= 0) return { code: null, label: parsed };

  const code = parsed.slice(0, index).trim() || null;
  const label = parsed.slice(index + separator.length).trim() || null;
  return { code, label };
}

function parseItemCode(value: unknown): string | null {
  const parsed = toNullableString(value);
  if (!parsed) return null;

  const sapMatch = parsed.match(/^sap:[^:]+:(.+)$/i);
  if (sapMatch?.[1]) {
    const fromSap = sapMatch[1].trim();
    return fromSap.length > 0 ? fromSap : null;
  }

  if (/^\d+$/.test(parsed)) return null;

  const split = splitCodeAndLabel(parsed);
  if (split.code) return split.code;
  return parsed;
}

function firstNonEmpty(values: unknown[]): string | null {
  for (const value of values) {
    const parsed = toNullableString(value);
    if (parsed) return parsed;
  }
  return null;
}

function parseMetadataFromObservation(observacao: unknown): JsonRow | null {
  const text = toNullableString(observacao);
  if (!text) return null;

  const index = text.lastIndexOf(OBS_META_MARKER);
  if (index < 0) return null;

  const jsonRaw = text.slice(index + OBS_META_MARKER.length).trim();
  if (!jsonRaw) return null;

  try {
    const parsed = JSON.parse(jsonRaw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonRow;
    }
  } catch {
    return null;
  }

  return null;
}

function readDadosGeraisMeta(metadata: JsonRow | null): JsonRow | null {
  if (!metadata?.dadosGerais || typeof metadata.dadosGerais !== "object" || Array.isArray(metadata.dadosGerais)) {
    return null;
  }
  return metadata.dadosGerais as JsonRow;
}

function uniqueStrings(values: Array<string | null>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const parsed = toNullableString(value);
    if (!parsed) continue;
    set.add(parsed);
  }
  return Array.from(set);
}

function looksLikeCardCode(value: string): boolean {
  if (!value) return false;
  if (value.length > 60) return false;
  if (/\s{2,}/.test(value)) return false;
  return /^[A-Za-z0-9_.\-\/ ]+$/.test(value);
}

function extractCodeFromCatalogLabel(value: unknown): string | null {
  const parsed = toNullableString(value);
  if (!parsed) return null;

  const split = splitCodeAndLabel(parsed);
  if (split.code) return split.code;

  return parsed;
}

function extractLeadingInteger(value: unknown): number | null {
  const parsed = toNullableString(value);
  if (!parsed) return null;
  const match = parsed.match(/^\s*(\d{1,5})\b/);
  if (!match?.[1]) return null;
  const result = Number.parseInt(match[1], 10);
  return Number.isNaN(result) ? null : result;
}

function parseItems(rows: JsonRow[], prazoEntregaContrato: string | null, tipoContrato: string): ParsedItemLine[] {
  const lines: ParsedItemLine[] = [];
  const isEntradaAnimais = tipoContrato === "entrada_animais";
  const defaultUsage = isEntradaAnimais ? toNullableString(process.env.SAP_SL_DEFAULT_USAGE_ENTRADA_GADO) ?? "GADO COMPRA" : null;
  const defaultTaxCode = isEntradaAnimais ? toNullableString(process.env.SAP_SL_DEFAULT_TAX_CODE_ENTRADA_GADO) ?? "1102-001" : null;
  const defaultDistributionRule = isEntradaAnimais ? toNullableString(process.env.SAP_SL_DEFAULT_DISTR_RULE_ENTRADA_GADO) : null;

  for (const row of rows) {
    const itemCode =
      parseItemCode(row.itemCode) ??
      parseItemCode(row.itemId) ??
      parseItemCode(row.itemCodigoSnapshot) ??
      parseItemCode(row.item_codigo_snapshot) ??
      splitCodeAndLabel(toNullableString(row.item)).code;

    const quantity = toNumber(row.quantidade ?? row.qtd ?? row.qt);
    if (!itemCode || quantity === null || quantity <= 0) continue;

    const distributionRule =
      extractCodeFromCatalogLabel(
        row.regraDistribuicao ??
          row.distributionRule ??
          row.centroCusto ??
          row.centro_custo ??
          row.centroCustoLabel ??
          row.centro_custo_label_snapshot,
      ) ?? defaultDistributionRule;

    const usage =
      toNullableString(row.utilizacao) ??
      toNullableString(row.usage) ??
      toNullableString(row.usoPrincipal) ??
      toNullableString(row.uso_principal) ??
      defaultUsage;

    const taxCode =
      extractCodeFromCatalogLabel(
        row.taxCode ??
          row.codigoImposto ??
          row.codigo_imposto ??
          row.tipoImposto ??
          row.tipo_imposto ??
          row.imposto,
      ) ?? defaultTaxCode;

    lines.push({
      itemCode,
      quantity,
      unitPrice: toNumber(row.valorUnitario ?? row.vl_unitario),
      warehouseCode: extractCodeFromCatalogLabel(row.deposito ?? row.depositoLabel ?? row.deposito_label_snapshot),
      costingCode: distributionRule,
      distributionRule,
      usage,
      taxCode,
      shipDate: normalizeDate(row.prazoEntrega ?? row.prazo_entrega) ?? prazoEntregaContrato,
    });
  }

  return lines;
}

async function hasRelation(relationName: string): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query<{ exists: boolean }>("SELECT to_regclass($1) IS NOT NULL AS exists", [relationName]);
  return Boolean(result.rows[0]?.exists);
}

async function loadPartnerReferencesByLocalId(id: number): Promise<string[]> {
  const pool = getPgPool();
  const refs: string[] = [];

  if (await hasRelation("dbo.res_partner")) {
    const result = await pool.query<JsonRow>(
      `
      SELECT
        coalesce(to_jsonb(p)->>'codigo', to_jsonb(p)->>'ref') AS codigo,
        coalesce(to_jsonb(p)->>'nome', to_jsonb(p)->>'name') AS nome,
        coalesce(to_jsonb(p)->>'documento', to_jsonb(p)->>'cnpj_cpf', to_jsonb(p)->>'vat') AS documento
      FROM dbo.res_partner p
      WHERE p.id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];
    if (row) {
      refs.push(
        ...uniqueStrings([
          toNullableString(row.codigo),
          normalizeDocument(row.documento),
          toNullableString(row.nome),
        ]),
      );
    }
  }

  if (refs.length === 0 && (await hasRelation("contrato.cs_parceiro"))) {
    const result = await pool.query<JsonRow>(
      `
      SELECT codigo, nome, documento
      FROM contrato.cs_parceiro
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];
    if (row) {
      refs.push(
        ...uniqueStrings([
          toNullableString(row.codigo),
          normalizeDocument(row.documento),
          toNullableString(row.nome),
        ]),
      );
    }
  }

  return uniqueStrings(refs);
}

async function resolveCardCodeByReferences(references: string[]): Promise<string | null> {
  for (const reference of references) {
    const profile = await getBusinessPartnerProfileFromSap(reference);
    if (!profile?.cardCode) continue;
    const cardCode = toNullableString(profile.cardCode);
    if (cardCode) return cardCode;
  }

  const fallback = references.find((value) => looksLikeCardCode(value));
  return fallback ?? null;
}

async function resolveOriginadorCardCode(contrato: JsonRow, metadata: JsonRow | null): Promise<string | null> {
  const dadosGerais = readDadosGeraisMeta(metadata);
  const originadorRaw = toNullableString(dadosGerais?.originador);
  if (!originadorRaw) return null;

  const split = splitCodeAndLabel(originadorRaw);
  const references = uniqueStrings([split.code, normalizeDocument(originadorRaw), split.label, originadorRaw]);
  const localId = toInteger(originadorRaw);

  if (localId !== null && localId > 0) {
    const localRefs = await loadPartnerReferencesByLocalId(localId);
    references.push(...localRefs);
  }

  const cardCode = await resolveCardCodeByReferences(uniqueStrings(references));
  if (cardCode) return cardCode;

  throw new Error("Nao foi possivel identificar o CardCode do originador para gerar o pedido no SAP.");
}

async function resolveParceiroCardCode(contrato: JsonRow, metadata: JsonRow | null): Promise<string> {
  const parceiroSap =
    metadata?.parceiroSap && typeof metadata.parceiroSap === "object" && !Array.isArray(metadata.parceiroSap)
      ? (metadata.parceiroSap as JsonRow)
      : null;

  const displayLabel = toNullableString(contrato.parceiro);
  const displaySplit = splitCodeAndLabel(displayLabel);
  const displayDocument = normalizeDocument(displayLabel);

  const references = uniqueStrings([
    toNullableString(parceiroSap?.sapExternalId),
    toNullableString(parceiroSap?.codigo),
    normalizeDocument(parceiroSap?.documento),
    toNullableString(parceiroSap?.nome),
    toNullableString(contrato.parceiro_codigo_base),
    toNullableString(contrato.parceiro_codigo_snapshot),
    normalizeDocument(contrato.parceiro_documento_base),
    normalizeDocument(contrato.parceiro_documento_snapshot),
    toNullableString(contrato.parceiro_nome_base),
    toNullableString(contrato.parceiro_nome_snapshot),
    displaySplit.code,
    displayDocument,
    displaySplit.label,
  ]);

  const cardCode = await resolveCardCodeByReferences(references);
  if (cardCode) return cardCode;

  throw new Error("Nao foi possivel identificar o CardCode do parceiro para gerar o pedido no SAP.");
}

async function resolvePedidoCardCode(contrato: JsonRow, metadata: JsonRow | null): Promise<string> {
  const tipoContrato = toNullableString(contrato.tp_contrato)?.toLowerCase() ?? "";
  if (tipoContrato === "entrada_animais") {
    const originadorCardCode = await resolveOriginadorCardCode(contrato, metadata);
    if (originadorCardCode) return originadorCardCode;
  }
  return resolveParceiroCardCode(contrato, metadata);
}

function parseFinanceInfo(data: ContratoSapSource): ParsedFinanceInfo {
  const rowsA = Array.isArray(data.financeiro) ? data.financeiro : [];
  const rowsB = Array.isArray(data.financeiros) ? data.financeiros : [];
  const rows = [...rowsA, ...rowsB];

  for (const row of rows) {
    const condicaoLabel = firstNonEmpty([row.condicaoPagamento, row.condicao, row.paymentTerm]);
    const formaLabel = firstNonEmpty([row.formaPagamento, row.paymentMethod]);
    const paymentGroupCode =
      extractLeadingInteger(extractCodeFromCatalogLabel(condicaoLabel) ?? condicaoLabel) ??
      extractLeadingInteger(row.condicaoPagamentoCode);
    const paymentMethod = extractCodeFromCatalogLabel(formaLabel);

    if (paymentGroupCode !== null || paymentMethod || condicaoLabel || formaLabel) {
      return {
        paymentGroupCode,
        paymentMethod,
        condicaoLabel: toNullableString(condicaoLabel),
        formaLabel: toNullableString(formaLabel),
      };
    }
  }

  return {
    paymentGroupCode: null,
    paymentMethod: null,
    condicaoLabel: null,
    formaLabel: null,
  };
}

export function getPedidoExistenteFromContrato(data: ContratoSapSource): SapPedidoExistente | null {
  const contrato = data.contrato ?? null;
  if (!contrato) return null;

  const docEntry = toNumber(contrato.b1_codigo);
  const docNum = toNumber(contrato.b1_codigo_pedido);
  const hasAny = docEntry !== null || docNum !== null;
  if (!hasAny) return null;

  return {
    docEntry: docEntry === null ? null : Math.trunc(docEntry),
    docNum: docNum === null ? null : Math.trunc(docNum),
  };
}

export async function gerarPedidoCompraSapPorContrato(data: ContratoSapSource): Promise<SapPedidoGerado> {
  const contrato = data.contrato ?? null;
  if (!contrato) {
    throw new Error("Contrato nao encontrado para gerar pedido SAP.");
  }

  const items = Array.isArray(data.itens) ? data.itens : [];
  if (items.length === 0) {
    throw new Error("Contrato sem itens. Inclua itens antes de gerar o pedido no SAP.");
  }

  const metadata = parseMetadataFromObservation(contrato.observacao);
  const cardCode = await resolvePedidoCardCode(contrato, metadata);

  const docDate = normalizeDate(contrato.dt_assinatura) ?? normalizeDate(contrato.dt_inicio) ?? new Date().toISOString().slice(0, 10);
  const docDueDate = normalizeDate(contrato.prazo_entrega) ?? normalizeDate(contrato.dt_vencimento) ?? docDate;
  const taxDate = docDate;
  const prazoEntregaContrato = docDueDate;
  const tipoContrato = toNullableString(contrato.tp_contrato)?.toLowerCase() ?? "";

  const lines = parseItems(items, prazoEntregaContrato, tipoContrato);
  if (lines.length === 0) {
    throw new Error("Nenhum item valido (codigo SAP + quantidade) encontrado no contrato para gerar pedido.");
  }

  const financeFromContract = parseFinanceInfo(data);
  let paymentGroupCode = financeFromContract.paymentGroupCode;
  let paymentMethod = financeFromContract.paymentMethod;

  if (paymentGroupCode === null || !paymentMethod) {
    const partnerProfile = await getBusinessPartnerProfileFromSap(cardCode);
    if (paymentGroupCode === null) {
      paymentGroupCode = extractLeadingInteger(partnerProfile?.paymentTermCode) ?? null;
    }
    if (!paymentMethod) {
      paymentMethod = toNullableString(partnerProfile?.paymentMethodCode);
    }
  }

  const numero = toNullableString(contrato.numero);
  const exercicio = toNullableString(contrato.ano);
  const referencia = firstNonEmpty([contrato.descricao, contrato.referenciaContrato]);
  const tipoContratoLabel = toNullableString(contrato.tp_contrato)?.replace(/_/g, " ").toUpperCase() ?? "CONTRATO";
  const contratoId = toNullableString(contrato.id);
  const usoPrincipal = lines[0]?.usage ?? null;

  const numAtCard = uniqueStrings([numero && exercicio ? `${numero}.${exercicio}` : null, referencia])[0] ?? null;

  const comments = [
    contratoId ? `Contrato #${contratoId}` : null,
    tipoContratoLabel,
    referencia ? `Ref: ${referencia}` : null,
    usoPrincipal ? `Uso principal: ${usoPrincipal}` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" | ");

  const result: SapPurchaseOrderCreateResult = await createPurchaseOrderInSap({
    cardCode,
    docDate,
    docDueDate,
    taxDate,
    numAtCard,
    comments,
    paymentGroupCode,
    paymentMethod,
    lines,
  });

  return {
    docEntry: result.docEntry,
    docNum: result.docNum,
    cardCode,
    lineCount: lines.length,
    raw: result.raw,
  };
}
