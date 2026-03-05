import type { Pool } from "pg";
import { getPgPool } from "@/lib/db";
import type {
  FrotaViagemCreateInput,
  FrotaViagemListFilters,
  FrotaViagemRecord,
  FrotaViagemStatus,
  FrotaViagemUpdateInput,
} from "@/lib/types/frota-viagem";

const FROTA_VIAGEM_TABLE = "agro.frota_viagem_saida";
let frotaSchemaEnsured = false;

const validStatus = new Set<FrotaViagemStatus>(["rascunho", "aprovado", "encerrado", "cancelado"]);

type NormalizedPayload = {
  numero: string | null;
  status: FrotaViagemStatus;
  equipamentoId: string | null;
  equipamentoDescricao: string | null;
  reboque: string | null;
  rota: string | null;
  motorista: string | null;
  responsavel: string | null;
  contratoId: number | null;
  contratoReferencia: string | null;
  transportadorId: number | null;
  transportadorNome: string | null;
  dataSaida: string | null;
  dataRetorno: string | null;
  dataValidade: string | null;
  motivo: string | null;
  localOrigem: string | null;
  localDestino: string | null;
  condicaoPagamentoId: string | null;
  condicaoPagamento: string | null;
  excessos: string | null;
  kmPrevisto: number;
  kmReal: number;
  pesoPrevisto: number;
  pesoRealizado: number;
  cidadeOrigemCodigo: string | null;
  cidadeOrigemNome: string | null;
  cidadeDestinoCodigo: string | null;
  cidadeDestinoNome: string | null;
  odometroSaida: number;
  observacao: string | null;
  declaracaoResponsabilidade: string | null;
};

export async function listFrotaViagens(filters: FrotaViagemListFilters) {
  const pool = getPgPool();
  await ensureFrotaSchema(pool);

  const status = filters.status ?? null;
  const search = filters.search?.trim() ? filters.search.trim() : null;
  const offset = (filters.page - 1) * filters.pageSize;

  const [countResult, rowsResult] = await Promise.all([
    pool.query<{ total: string }>(
      `
      SELECT count(*)::text AS total
      FROM ${FROTA_VIAGEM_TABLE} v
      WHERE ($1::text IS NULL OR v.status = $1)
        AND (
          $2::text IS NULL
          OR coalesce(v.numero, '') ILIKE '%' || $2 || '%'
          OR coalesce(v.motorista, '') ILIKE '%' || $2 || '%'
          OR coalesce(v.equipamento_descricao, '') ILIKE '%' || $2 || '%'
          OR coalesce(v.observacao, '') ILIKE '%' || $2 || '%'
          OR v.id::text ILIKE '%' || $2 || '%'
        )
      `,
      [status, search],
    ),
    pool.query(
      `
      SELECT
        v.id,
        v.numero,
        v.data_saida AS "dataSaida",
        v.status,
        v.motorista,
        v.equipamento_descricao AS equipamento,
        v.observacao
      FROM ${FROTA_VIAGEM_TABLE} v
      WHERE ($1::text IS NULL OR v.status = $1)
        AND (
          $2::text IS NULL
          OR coalesce(v.numero, '') ILIKE '%' || $2 || '%'
          OR coalesce(v.motorista, '') ILIKE '%' || $2 || '%'
          OR coalesce(v.equipamento_descricao, '') ILIKE '%' || $2 || '%'
          OR coalesce(v.observacao, '') ILIKE '%' || $2 || '%'
          OR v.id::text ILIKE '%' || $2 || '%'
        )
      ORDER BY v.id DESC
      LIMIT $3 OFFSET $4
      `,
      [status, search, filters.pageSize, offset],
    ),
  ]);

  return {
    items: rowsResult.rows.map((row) => ({
      id: toNumber(row.id),
      numero: toNullableString(row.numero),
      dataSaida: toDateOnlyString(row.dataSaida),
      status: normalizeStatus(row.status),
      motorista: toNullableString(row.motorista),
      equipamento: toNullableString(row.equipamento),
      observacao: toNullableString(row.observacao),
    })),
    total: Number.parseInt(countResult.rows[0]?.total ?? "0", 10),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getFrotaViagemById(id: number): Promise<FrotaViagemRecord | null> {
  const pool = getPgPool();
  await ensureFrotaSchema(pool);

  const result = await pool.query(`SELECT * FROM ${FROTA_VIAGEM_TABLE} WHERE id = $1`, [id]);
  if ((result.rowCount ?? 0) === 0) return null;
  return mapRowToRecord(result.rows[0] as Record<string, unknown>);
}

export async function createFrotaViagem(input: FrotaViagemCreateInput): Promise<FrotaViagemRecord | null> {
  const pool = getPgPool();
  await ensureFrotaSchema(pool);

  const normalized = normalizePayload(input);
  const inserted = await pool.query<{ id: number }>(
    `
    INSERT INTO ${FROTA_VIAGEM_TABLE} (
      created_on,
      updated_on,
      numero,
      status,
      equipamento_id,
      equipamento_descricao,
      reboque,
      rota,
      motorista,
      responsavel,
      contrato_id,
      contrato_referencia,
      transportador_id,
      transportador_nome,
      data_saida,
      data_retorno,
      data_validade,
      motivo,
      local_origem,
      local_destino,
      condicao_pagamento_id,
      condicao_pagamento,
      excessos,
      km_previsto,
      km_real,
      peso_previsto,
      peso_realizado,
      cidade_origem_codigo,
      cidade_origem_nome,
      cidade_destino_codigo,
      cidade_destino_nome,
      odometro_saida,
      observacao,
      declaracao_responsabilidade
    )
    VALUES (
      now(),
      now(),
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
    )
    RETURNING id
    `,
    [
      normalized.numero,
      normalized.status,
      normalized.equipamentoId,
      normalized.equipamentoDescricao,
      normalized.reboque,
      normalized.rota,
      normalized.motorista,
      normalized.responsavel,
      normalized.contratoId,
      normalized.contratoReferencia,
      normalized.transportadorId,
      normalized.transportadorNome,
      normalized.dataSaida,
      normalized.dataRetorno,
      normalized.dataValidade,
      normalized.motivo,
      normalized.localOrigem,
      normalized.localDestino,
      normalized.condicaoPagamentoId,
      normalized.condicaoPagamento,
      normalized.excessos,
      normalized.kmPrevisto,
      normalized.kmReal,
      normalized.pesoPrevisto,
      normalized.pesoRealizado,
      normalized.cidadeOrigemCodigo,
      normalized.cidadeOrigemNome,
      normalized.cidadeDestinoCodigo,
      normalized.cidadeDestinoNome,
      normalized.odometroSaida,
      normalized.observacao,
      normalized.declaracaoResponsabilidade,
    ],
  );

  return await getFrotaViagemById(inserted.rows[0].id);
}

export async function updateFrotaViagem(id: number, input: FrotaViagemUpdateInput): Promise<FrotaViagemRecord | null> {
  const pool = getPgPool();
  await ensureFrotaSchema(pool);

  const current = await getFrotaViagemById(id);
  if (!current) throw new Error("Viagem nao encontrada.");

  const merged = normalizePayload({
    ...recordToCreateInput(current),
    ...input,
  });

  await pool.query(
    `
    UPDATE ${FROTA_VIAGEM_TABLE}
    SET
      updated_on = now(),
      numero = $2,
      status = $3,
      equipamento_id = $4,
      equipamento_descricao = $5,
      reboque = $6,
      rota = $7,
      motorista = $8,
      responsavel = $9,
      contrato_id = $10,
      contrato_referencia = $11,
      transportador_id = $12,
      transportador_nome = $13,
      data_saida = $14,
      data_retorno = $15,
      data_validade = $16,
      motivo = $17,
      local_origem = $18,
      local_destino = $19,
      condicao_pagamento_id = $20,
      condicao_pagamento = $21,
      excessos = $22,
      km_previsto = $23,
      km_real = $24,
      peso_previsto = $25,
      peso_realizado = $26,
      cidade_origem_codigo = $27,
      cidade_origem_nome = $28,
      cidade_destino_codigo = $29,
      cidade_destino_nome = $30,
      odometro_saida = $31,
      observacao = $32,
      declaracao_responsabilidade = $33
    WHERE id = $1
    `,
    [
      id,
      merged.numero,
      merged.status,
      merged.equipamentoId,
      merged.equipamentoDescricao,
      merged.reboque,
      merged.rota,
      merged.motorista,
      merged.responsavel,
      merged.contratoId,
      merged.contratoReferencia,
      merged.transportadorId,
      merged.transportadorNome,
      merged.dataSaida,
      merged.dataRetorno,
      merged.dataValidade,
      merged.motivo,
      merged.localOrigem,
      merged.localDestino,
      merged.condicaoPagamentoId,
      merged.condicaoPagamento,
      merged.excessos,
      merged.kmPrevisto,
      merged.kmReal,
      merged.pesoPrevisto,
      merged.pesoRealizado,
      merged.cidadeOrigemCodigo,
      merged.cidadeOrigemNome,
      merged.cidadeDestinoCodigo,
      merged.cidadeDestinoNome,
      merged.odometroSaida,
      merged.observacao,
      merged.declaracaoResponsabilidade,
    ],
  );

  return await getFrotaViagemById(id);
}

export async function listFrotaContratoOptions(filters?: { search?: string | null; limit?: number | null }) {
  const pool = getPgPool();
  await ensureFrotaSchema(pool);

  const search = filters?.search?.trim() ? filters.search.trim() : null;
  const parsedLimit = Number(filters?.limit);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 20), 400) : 120;

  const result = await pool.query(
    `
    SELECT
      c.id,
      coalesce(c.numero::text, '') AS numero,
      coalesce(c.descricao, '') AS descricao
    FROM contrato.contrato c
    WHERE lower(trim(coalesce(c.status, ''))) = 'ativo'
      AND (
        $1::text IS NULL
        OR c.id::text ILIKE '%' || $1 || '%'
        OR coalesce(c.numero::text, '') ILIKE '%' || $1 || '%'
        OR coalesce(c.descricao, '') ILIKE '%' || $1 || '%'
      )
    ORDER BY c.id DESC
    LIMIT $2
    `,
    [search, limit],
  );

  return result.rows
    .map((row) => ({
      id: toNumber(row.id),
      numero: toNullableString(row.numero),
      descricao: toNullableString(row.descricao),
    }))
    .filter((row) => row.id > 0);
}

async function ensureFrotaSchema(pool: Pool) {
  if (frotaSchemaEnsured) return;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [48271, 1211]);

    if (frotaSchemaEnsured) {
      await client.query("COMMIT");
      return;
    }

    await client.query("CREATE SCHEMA IF NOT EXISTS agro");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${FROTA_VIAGEM_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        numero VARCHAR(64) NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'rascunho',
        equipamento_id VARCHAR(128) NULL,
        equipamento_descricao VARCHAR(255) NULL,
        reboque VARCHAR(255) NULL,
        rota VARCHAR(255) NULL,
        motorista VARCHAR(255) NULL,
        responsavel VARCHAR(255) NULL,
        contrato_id BIGINT NULL,
        contrato_referencia VARCHAR(255) NULL,
        transportador_id BIGINT NULL,
        transportador_nome VARCHAR(255) NULL,
        data_saida DATE NULL,
        data_retorno DATE NULL,
        data_validade DATE NULL,
        motivo VARCHAR(255) NULL,
        local_origem VARCHAR(255) NULL,
        local_destino VARCHAR(255) NULL,
        condicao_pagamento_id VARCHAR(128) NULL,
        condicao_pagamento VARCHAR(255) NULL,
        excessos VARCHAR(255) NULL,
        km_previsto NUMERIC(18, 6) NOT NULL DEFAULT 0,
        km_real NUMERIC(18, 6) NOT NULL DEFAULT 0,
        peso_previsto NUMERIC(18, 6) NOT NULL DEFAULT 0,
        peso_realizado NUMERIC(18, 6) NOT NULL DEFAULT 0,
        cidade_origem_codigo VARCHAR(24) NULL,
        cidade_origem_nome VARCHAR(120) NULL,
        cidade_destino_codigo VARCHAR(24) NULL,
        cidade_destino_nome VARCHAR(120) NULL,
        odometro_saida NUMERIC(18, 6) NOT NULL DEFAULT 0,
        observacao TEXT NULL,
        declaracao_responsabilidade TEXT NULL
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_frota_viagem_saida_status_id ON ${FROTA_VIAGEM_TABLE}(status, id DESC)`,
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_frota_viagem_saida_numero ON ${FROTA_VIAGEM_TABLE}(numero)`);
    await client.query("COMMIT");
    frotaSchemaEnsured = true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function mapRowToRecord(row: Record<string, unknown>): FrotaViagemRecord {
  return {
    id: toNumber(row.id),
    numero: toNullableString(row.numero),
    status: normalizeStatus(row.status),
    equipamentoId: toNullableString(row.equipamento_id),
    equipamentoDescricao: toNullableString(row.equipamento_descricao),
    reboque: toNullableString(row.reboque),
    rota: toNullableString(row.rota),
    motorista: toNullableString(row.motorista),
    responsavel: toNullableString(row.responsavel),
    contratoId: toNullableInteger(row.contrato_id),
    contratoReferencia: toNullableString(row.contrato_referencia),
    transportadorId: toNullableInteger(row.transportador_id),
    transportadorNome: toNullableString(row.transportador_nome),
    dataSaida: toDateOnlyString(row.data_saida),
    dataRetorno: toDateOnlyString(row.data_retorno),
    dataValidade: toDateOnlyString(row.data_validade),
    motivo: toNullableString(row.motivo),
    localOrigem: toNullableString(row.local_origem),
    localDestino: toNullableString(row.local_destino),
    condicaoPagamentoId: toNullableString(row.condicao_pagamento_id),
    condicaoPagamento: toNullableString(row.condicao_pagamento),
    excessos: toNullableString(row.excessos),
    kmPrevisto: toDecimal(row.km_previsto),
    kmReal: toDecimal(row.km_real),
    pesoPrevisto: toDecimal(row.peso_previsto),
    pesoRealizado: toDecimal(row.peso_realizado),
    cidadeOrigemCodigo: toNullableString(row.cidade_origem_codigo),
    cidadeOrigemNome: toNullableString(row.cidade_origem_nome),
    cidadeDestinoCodigo: toNullableString(row.cidade_destino_codigo),
    cidadeDestinoNome: toNullableString(row.cidade_destino_nome),
    odometroSaida: toDecimal(row.odometro_saida),
    observacao: toNullableString(row.observacao),
    declaracaoResponsabilidade: toNullableString(row.declaracao_responsabilidade),
    createdOn: toNullableString(row.created_on),
    updatedOn: toNullableString(row.updated_on),
  };
}

function recordToCreateInput(record: FrotaViagemRecord): FrotaViagemCreateInput {
  return {
    numero: record.numero,
    status: record.status,
    equipamentoId: record.equipamentoId,
    equipamentoDescricao: record.equipamentoDescricao,
    reboque: record.reboque,
    rota: record.rota,
    motorista: record.motorista,
    responsavel: record.responsavel,
    contratoId: record.contratoId,
    contratoReferencia: record.contratoReferencia,
    transportadorId: record.transportadorId,
    transportadorNome: record.transportadorNome,
    dataSaida: record.dataSaida,
    dataRetorno: record.dataRetorno,
    dataValidade: record.dataValidade,
    motivo: record.motivo,
    localOrigem: record.localOrigem,
    localDestino: record.localDestino,
    condicaoPagamentoId: record.condicaoPagamentoId,
    condicaoPagamento: record.condicaoPagamento,
    excessos: record.excessos,
    kmPrevisto: record.kmPrevisto,
    kmReal: record.kmReal,
    pesoPrevisto: record.pesoPrevisto,
    pesoRealizado: record.pesoRealizado,
    cidadeOrigemCodigo: record.cidadeOrigemCodigo,
    cidadeOrigemNome: record.cidadeOrigemNome,
    cidadeDestinoCodigo: record.cidadeDestinoCodigo,
    cidadeDestinoNome: record.cidadeDestinoNome,
    odometroSaida: record.odometroSaida,
    observacao: record.observacao,
    declaracaoResponsabilidade: record.declaracaoResponsabilidade,
  };
}

function normalizePayload(input: FrotaViagemCreateInput): NormalizedPayload {
  return {
    numero: normalizeText(input.numero),
    status: normalizeStatus(input.status),
    equipamentoId: normalizeText(input.equipamentoId),
    equipamentoDescricao: normalizeText(input.equipamentoDescricao),
    reboque: normalizeText(input.reboque),
    rota: normalizeText(input.rota),
    motorista: normalizeText(input.motorista),
    responsavel: normalizeText(input.responsavel),
    contratoId: toNullableInteger(input.contratoId),
    contratoReferencia: normalizeText(input.contratoReferencia),
    transportadorId: toNullableInteger(input.transportadorId),
    transportadorNome: normalizeText(input.transportadorNome),
    dataSaida: normalizeDateInput(input.dataSaida),
    dataRetorno: normalizeDateInput(input.dataRetorno),
    dataValidade: normalizeDateInput(input.dataValidade),
    motivo: normalizeText(input.motivo),
    localOrigem: normalizeText(input.localOrigem),
    localDestino: normalizeText(input.localDestino),
    condicaoPagamentoId: normalizeText(input.condicaoPagamentoId),
    condicaoPagamento: normalizeText(input.condicaoPagamento),
    excessos: normalizeText(input.excessos),
    kmPrevisto: toDecimal(input.kmPrevisto),
    kmReal: toDecimal(input.kmReal),
    pesoPrevisto: toDecimal(input.pesoPrevisto),
    pesoRealizado: toDecimal(input.pesoRealizado),
    cidadeOrigemCodigo: normalizeText(input.cidadeOrigemCodigo),
    cidadeOrigemNome: normalizeText(input.cidadeOrigemNome),
    cidadeDestinoCodigo: normalizeText(input.cidadeDestinoCodigo),
    cidadeDestinoNome: normalizeText(input.cidadeDestinoNome),
    odometroSaida: toDecimal(input.odometroSaida),
    observacao: normalizeText(input.observacao),
    declaracaoResponsabilidade: normalizeText(input.declaracaoResponsabilidade),
  };
}

function normalizeStatus(value: unknown): FrotaViagemStatus {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (validStatus.has(normalized as FrotaViagemStatus)) return normalized as FrotaViagemStatus;
  return "rascunho";
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeDateInput(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
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

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function toNullableInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}
