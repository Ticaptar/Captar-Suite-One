import type { Pool } from "pg";
import { getPgPool } from "@/lib/db";
import type {
  GtaCreateInput,
  GtaEraRow,
  GtaListFilters,
  GtaRecord,
  GtaStatus,
  GtaTemporariaRow,
  GtaTipo,
  GtaUpdateInput,
} from "@/lib/types/gta";

const GTA_TABLE = "agro.gta_cadastro";
let gtaSchemaEnsured = false;

const validTipos = new Set<GtaTipo>(["entrada", "saida", "temporaria"]);
const validStatus = new Set<GtaStatus>(["ativo", "cancelado", "desembarcado", "encerrado"]);

type NormalizedPayload = {
  tipo: GtaTipo;
  status: GtaStatus;
  numero: string | null;
  serie: string | null;
  local: string | null;
  contrato: string | null;
  estado: string | null;
  especie: string | null;
  finalidade: string | null;
  transporte: string | null;
  dataEmissao: string | null;
  horaEmissao: string | null;
  dataValidade: string | null;
  quantidadeMachos: number;
  quantidadeFemeas: number;
  total: number;
  totalEntrada: number;
  totalIdentificados: number;
  totalPesagem: number;
  proprietario: string | null;
  produtor: string | null;
  propriedadeOrigem: string | null;
  vendaInterna: boolean;
  animaisRastreados: boolean;
  valorGta: number;
  eras: GtaEraRow[];
  gtaTemporariaRows: GtaTemporariaRow[];
};

export async function listGtas(filters: GtaListFilters) {
  const pool = getPgPool();
  await ensureGtaSchema(pool);

  const tipo = filters.tipo ?? null;
  const status = filters.status ?? null;
  const search = filters.search?.trim() ? filters.search.trim() : null;
  const offset = (filters.page - 1) * filters.pageSize;

  const [countResult, rowsResult] = await Promise.all([
    pool.query<{ total: string }>(
      `
      SELECT count(*)::text AS total
      FROM ${GTA_TABLE} g
      WHERE ($1::text IS NULL OR g.tipo = $1)
        AND ($2::text IS NULL OR g.status = $2)
        AND (
          $3::text IS NULL
          OR coalesce(g.numero, '') ILIKE '%' || $3 || '%'
          OR coalesce(g.contrato, '') ILIKE '%' || $3 || '%'
          OR coalesce(g.local, '') ILIKE '%' || $3 || '%'
          OR g.id::text ILIKE '%' || $3 || '%'
        )
      `,
      [tipo, status, search],
    ),
    pool.query(
      `
      SELECT
        g.id,
        g.numero,
        g.data_emissao AS "dataEmissao",
        g.contrato,
        g.local,
        g.tipo,
        g.status,
        coalesce(g.total, 0) AS total,
        coalesce(g.quantidade_machos, 0) AS "quantidadeMachos",
        coalesce(g.quantidade_femeas, 0) AS "quantidadeFemeas"
      FROM ${GTA_TABLE} g
      WHERE ($1::text IS NULL OR g.tipo = $1)
        AND ($2::text IS NULL OR g.status = $2)
        AND (
          $3::text IS NULL
          OR coalesce(g.numero, '') ILIKE '%' || $3 || '%'
          OR coalesce(g.contrato, '') ILIKE '%' || $3 || '%'
          OR coalesce(g.local, '') ILIKE '%' || $3 || '%'
          OR g.id::text ILIKE '%' || $3 || '%'
        )
      ORDER BY g.id DESC
      LIMIT $4 OFFSET $5
      `,
      [tipo, status, search, filters.pageSize, offset],
    ),
  ]);

  return {
    items: rowsResult.rows.map((row) => ({
      id: toNumber(row.id),
      numero: toNullableString(row.numero),
      dataEmissao: toDateOnlyString(row.dataEmissao),
      contrato: toNullableString(row.contrato),
      local: toNullableString(row.local),
      tipo: normalizeTipo(row.tipo),
      status: normalizeStatus(row.status),
      total: toInteger(row.total),
      quantidadeMachos: toInteger(row.quantidadeMachos),
      quantidadeFemeas: toInteger(row.quantidadeFemeas),
    })),
    total: Number.parseInt(countResult.rows[0]?.total ?? "0", 10),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getGtaById(id: number): Promise<GtaRecord | null> {
  const pool = getPgPool();
  await ensureGtaSchema(pool);

  const result = await pool.query(`SELECT * FROM ${GTA_TABLE} WHERE id = $1`, [id]);
  if ((result.rowCount ?? 0) === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return mapRowToRecord(row);
}

export async function createGta(input: GtaCreateInput): Promise<GtaRecord | null> {
  const pool = getPgPool();
  await ensureGtaSchema(pool);

  const normalized = normalizePayload(input);
  const inserted = await pool.query<{ id: number }>(
    `
    INSERT INTO ${GTA_TABLE} (
      created_on,
      updated_on,
      tipo,
      status,
      numero,
      serie,
      local,
      contrato,
      estado,
      especie,
      finalidade,
      transporte,
      data_emissao,
      hora_emissao,
      data_validade,
      quantidade_machos,
      quantidade_femeas,
      total,
      total_entrada,
      total_identificados,
      total_pesagem,
      proprietario,
      produtor,
      propriedade_origem,
      venda_interna,
      animais_rastreados,
      valor_gta,
      eras_json,
      gta_temporaria_json
    )
    VALUES (
      now(),
      now(),
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27::jsonb
    )
    RETURNING id
    `,
    [
      normalized.tipo,
      normalized.status,
      normalized.numero,
      normalized.serie,
      normalized.local,
      normalized.contrato,
      normalized.estado,
      normalized.especie,
      normalized.finalidade,
      normalized.transporte,
      normalized.dataEmissao,
      normalized.horaEmissao,
      normalized.dataValidade,
      normalized.quantidadeMachos,
      normalized.quantidadeFemeas,
      normalized.total,
      normalized.totalEntrada,
      normalized.totalIdentificados,
      normalized.totalPesagem,
      normalized.proprietario,
      normalized.produtor,
      normalized.propriedadeOrigem,
      normalized.vendaInterna,
      normalized.animaisRastreados,
      normalized.valorGta,
      JSON.stringify(normalized.eras),
      JSON.stringify(normalized.gtaTemporariaRows),
    ],
  );

  return await getGtaById(inserted.rows[0].id);
}

export async function updateGta(id: number, input: GtaUpdateInput): Promise<GtaRecord | null> {
  const pool = getPgPool();
  await ensureGtaSchema(pool);

  const current = await getGtaById(id);
  if (!current) {
    throw new Error("GTA nao encontrada.");
  }

  const merged = normalizePayload({
    ...recordToCreateInput(current),
    ...input,
  });

  await pool.query(
    `
    UPDATE ${GTA_TABLE}
    SET
      updated_on = now(),
      tipo = $2,
      status = $3,
      numero = $4,
      serie = $5,
      local = $6,
      contrato = $7,
      estado = $8,
      especie = $9,
      finalidade = $10,
      transporte = $11,
      data_emissao = $12,
      hora_emissao = $13,
      data_validade = $14,
      quantidade_machos = $15,
      quantidade_femeas = $16,
      total = $17,
      total_entrada = $18,
      total_identificados = $19,
      total_pesagem = $20,
      proprietario = $21,
      produtor = $22,
      propriedade_origem = $23,
      venda_interna = $24,
      animais_rastreados = $25,
      valor_gta = $26,
      eras_json = $27::jsonb,
      gta_temporaria_json = $28::jsonb
    WHERE id = $1
    `,
    [
      id,
      merged.tipo,
      merged.status,
      merged.numero,
      merged.serie,
      merged.local,
      merged.contrato,
      merged.estado,
      merged.especie,
      merged.finalidade,
      merged.transporte,
      merged.dataEmissao,
      merged.horaEmissao,
      merged.dataValidade,
      merged.quantidadeMachos,
      merged.quantidadeFemeas,
      merged.total,
      merged.totalEntrada,
      merged.totalIdentificados,
      merged.totalPesagem,
      merged.proprietario,
      merged.produtor,
      merged.propriedadeOrigem,
      merged.vendaInterna,
      merged.animaisRastreados,
      merged.valorGta,
      JSON.stringify(merged.eras),
      JSON.stringify(merged.gtaTemporariaRows),
    ],
  );

  return await getGtaById(id);
}

async function ensureGtaSchema(pool: Pool) {
  if (gtaSchemaEnsured) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [48271, 1210]);

    if (gtaSchemaEnsured) {
      await client.query("COMMIT");
      return;
    }

    await client.query("CREATE SCHEMA IF NOT EXISTS agro");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${GTA_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        tipo VARCHAR(24) NOT NULL DEFAULT 'entrada',
        status VARCHAR(24) NOT NULL DEFAULT 'ativo',
        numero VARCHAR(64) NULL,
        serie VARCHAR(32) NULL,
        local VARCHAR(255) NULL,
        contrato VARCHAR(255) NULL,
        estado VARCHAR(120) NULL,
        especie VARCHAR(120) NULL,
        finalidade VARCHAR(120) NULL,
        transporte VARCHAR(120) NULL,
        data_emissao DATE NULL,
        hora_emissao TIME NULL,
        data_validade DATE NULL,
        quantidade_machos INTEGER NOT NULL DEFAULT 0,
        quantidade_femeas INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 0,
        total_entrada INTEGER NOT NULL DEFAULT 0,
        total_identificados INTEGER NOT NULL DEFAULT 0,
        total_pesagem INTEGER NOT NULL DEFAULT 0,
        proprietario VARCHAR(255) NULL,
        produtor VARCHAR(255) NULL,
        propriedade_origem VARCHAR(255) NULL,
        venda_interna BOOLEAN NOT NULL DEFAULT false,
        animais_rastreados BOOLEAN NOT NULL DEFAULT false,
        valor_gta NUMERIC(18, 2) NOT NULL DEFAULT 0,
        eras_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        gta_temporaria_json JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gta_tipo_status_id ON ${GTA_TABLE}(tipo, status, id DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gta_numero ON ${GTA_TABLE}(numero)`);
    await client.query("COMMIT");
    gtaSchemaEnsured = true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function mapRowToRecord(row: Record<string, unknown>): GtaRecord {
  return {
    id: toNumber(row.id),
    tipo: normalizeTipo(row.tipo),
    status: normalizeStatus(row.status),
    numero: toNullableString(row.numero),
    serie: toNullableString(row.serie),
    local: toNullableString(row.local),
    contrato: toNullableString(row.contrato),
    estado: toNullableString(row.estado),
    especie: toNullableString(row.especie),
    finalidade: toNullableString(row.finalidade),
    transporte: toNullableString(row.transporte),
    dataEmissao: toDateOnlyString(row.data_emissao),
    horaEmissao: toTimeOnlyString(row.hora_emissao),
    dataValidade: toDateOnlyString(row.data_validade),
    quantidadeMachos: toInteger(row.quantidade_machos),
    quantidadeFemeas: toInteger(row.quantidade_femeas),
    total: toInteger(row.total),
    totalEntrada: toInteger(row.total_entrada),
    totalIdentificados: toInteger(row.total_identificados),
    totalPesagem: toInteger(row.total_pesagem),
    proprietario: toNullableString(row.proprietario),
    produtor: toNullableString(row.produtor),
    propriedadeOrigem: toNullableString(row.propriedade_origem),
    vendaInterna: toBoolean(row.venda_interna),
    animaisRastreados: toBoolean(row.animais_rastreados),
    valorGta: toDecimal(row.valor_gta),
    eras: normalizeErasRows(row.eras_json),
    gtaTemporariaRows: normalizeTemporariaRows(row.gta_temporaria_json),
    createdOn: toNullableString(row.created_on),
    updatedOn: toNullableString(row.updated_on),
  };
}

function recordToCreateInput(record: GtaRecord): GtaCreateInput {
  return {
    tipo: record.tipo,
    status: record.status,
    numero: record.numero,
    serie: record.serie,
    local: record.local,
    contrato: record.contrato,
    estado: record.estado,
    especie: record.especie,
    finalidade: record.finalidade,
    transporte: record.transporte,
    dataEmissao: record.dataEmissao,
    horaEmissao: record.horaEmissao,
    dataValidade: record.dataValidade,
    quantidadeMachos: record.quantidadeMachos,
    quantidadeFemeas: record.quantidadeFemeas,
    total: record.total,
    totalEntrada: record.totalEntrada,
    totalIdentificados: record.totalIdentificados,
    totalPesagem: record.totalPesagem,
    proprietario: record.proprietario,
    produtor: record.produtor,
    propriedadeOrigem: record.propriedadeOrigem,
    vendaInterna: record.vendaInterna,
    animaisRastreados: record.animaisRastreados,
    valorGta: record.valorGta,
    eras: record.eras,
    gtaTemporariaRows: record.gtaTemporariaRows,
  };
}

function normalizePayload(input: GtaCreateInput): NormalizedPayload {
  const quantidadeMachos = toInteger(input.quantidadeMachos);
  const quantidadeFemeas = toInteger(input.quantidadeFemeas);
  const totalInformado = toInteger(input.total);
  const totalCalculado = quantidadeMachos + quantidadeFemeas;

  return {
    tipo: normalizeTipo(input.tipo),
    status: normalizeStatus(input.status),
    numero: normalizeText(input.numero),
    serie: normalizeText(input.serie),
    local: normalizeText(input.local),
    contrato: normalizeText(input.contrato),
    estado: normalizeText(input.estado),
    especie: normalizeText(input.especie),
    finalidade: normalizeText(input.finalidade),
    transporte: normalizeText(input.transporte),
    dataEmissao: normalizeDateInput(input.dataEmissao),
    horaEmissao: normalizeTimeInput(input.horaEmissao),
    dataValidade: normalizeDateInput(input.dataValidade),
    quantidadeMachos,
    quantidadeFemeas,
    total: totalInformado > 0 ? totalInformado : totalCalculado,
    totalEntrada: toInteger(input.totalEntrada),
    totalIdentificados: toInteger(input.totalIdentificados),
    totalPesagem: toInteger(input.totalPesagem),
    proprietario: normalizeText(input.proprietario),
    produtor: normalizeText(input.produtor),
    propriedadeOrigem: normalizeText(input.propriedadeOrigem),
    vendaInterna: Boolean(input.vendaInterna),
    animaisRastreados: Boolean(input.animaisRastreados),
    valorGta: toDecimal(input.valorGta),
    eras: normalizeErasRows(input.eras),
    gtaTemporariaRows: normalizeTemporariaRows(input.gtaTemporariaRows),
  };
}

function normalizeErasRows(value: unknown): GtaEraRow[] {
  if (!Array.isArray(value)) return [];
  const rows: GtaEraRow[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const era = normalizeText(row.era) ?? "";
    const quantidade = toInteger(row.quantidade);
    const quantidadeEntrada = toInteger(row.quantidadeEntrada);
    const quantidadeIdentificado = toInteger(row.quantidadeIdentificado);
    if (!era && quantidade === 0 && quantidadeEntrada === 0 && quantidadeIdentificado === 0) continue;
    rows.push({ era, quantidade, quantidadeEntrada, quantidadeIdentificado });
  }

  return rows;
}

function normalizeTemporariaRows(value: unknown): GtaTemporariaRow[] {
  if (!Array.isArray(value)) return [];
  const rows: GtaTemporariaRow[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const descricao = normalizeText(row.descricao ?? row.gtaTemporaria) ?? "";
    const quantidade = toInteger(row.quantidade);
    const quantidadeEntrada = toInteger(row.quantidadeEntrada);
    if (!descricao && quantidade === 0 && quantidadeEntrada === 0) continue;
    rows.push({ descricao, quantidade, quantidadeEntrada });
  }

  return rows;
}

function normalizeTipo(value: unknown): GtaTipo {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (validTipos.has(normalized as GtaTipo)) return normalized as GtaTipo;
  return "entrada";
}

function normalizeStatus(value: unknown): GtaStatus {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (validStatus.has(normalized as GtaStatus)) return normalized as GtaStatus;
  return "ativo";
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function normalizeDateInput(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeTimeInput(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{2}:\d{2}$/.test(text)) return `${text}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(text)) return text;
  return null;
}

function toDateOnlyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toTimeOnlyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const short = text.match(/^(\d{2}:\d{2})/);
  return short?.[1] ?? null;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function toDecimal(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").toLowerCase().trim();
  return normalized === "1" || normalized === "true" || normalized === "sim" || normalized === "s";
}
