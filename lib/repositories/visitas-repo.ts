import type { Pool, PoolClient } from "pg";
import { getPgPool } from "@/lib/db";
import type {
  VisitaAtividadePayload,
  VisitaCategoriaItemPayload,
  VisitaCreateInput,
  VisitaListItem,
  VisitaRecord,
  VisitaStatus,
  VisitaUpdateInput,
} from "@/lib/types/visita";

type ListFilters = {
  status?: VisitaStatus | null;
  search?: string | null;
  page: number;
  pageSize: number;
};

const VISITA_TABLE = "contrato.visita";
const VISITA_ATIVIDADE_TABLE = "contrato.visita_atividade";
const OBS_META_MARKER = "\n\n/*VISITA_META*/";
const OBS_META_MARKER_BARE = "/*VISITA_META*/";
let visitaExtraColumnsEnsured = false;

type VisitaMetaPayload = {
  categoriaItens?: VisitaCategoriaItemPayload[] | null;
  raca?: string | null;
};

const validStatus = new Set<VisitaStatus>([
  "oportunidade",
  "em_analise",
  "negociacao",
  "contrato_gerado",
  "perdida",
  "arquivada",
]);

export async function listVisitas(filters: ListFilters) {
  const pool = getPgPool();
  await assertVisitaTables(pool);

  const status = filters.status ?? null;
  const search = filters.search?.trim() ? filters.search.trim() : null;
  const offset = (filters.page - 1) * filters.pageSize;

  const [countResult, rowsResult] = await Promise.all([
    pool.query<{ total: string }>(
      `
      SELECT count(*)::text AS total
      FROM ${VISITA_TABLE} v
      WHERE ($1::text IS NULL OR v.status = $1)
        AND (
          $2::text IS NULL
          OR v.parceiro_nome ILIKE '%' || $2 || '%'
          OR v.responsavel_nome ILIKE '%' || $2 || '%'
          OR v.endereco ILIKE '%' || $2 || '%'
          OR v.cidade ILIKE '%' || $2 || '%'
          OR v.estado ILIKE '%' || $2 || '%'
          OR v.id::text ILIKE '%' || $2 || '%'
        )
      `,
      [status, search],
    ),
    pool.query(
      `
      SELECT
        v.id,
        v.status,
        v.data_visita AS "dataVisita",
        v.parceiro_nome AS parceiro,
        v.responsavel_nome AS responsavel,
        nullif(trim(concat_ws(' - ', v.endereco, concat_ws('/', v.cidade, v.estado))), '') AS endereco,
        coalesce(v.rebanho_atual, 0) AS "rebanhoAtual",
        v.contrato_gerado_id AS "contratoGeradoId"
      FROM ${VISITA_TABLE} v
      WHERE ($1::text IS NULL OR v.status = $1)
        AND (
          $2::text IS NULL
          OR v.parceiro_nome ILIKE '%' || $2 || '%'
          OR v.responsavel_nome ILIKE '%' || $2 || '%'
          OR v.endereco ILIKE '%' || $2 || '%'
          OR v.cidade ILIKE '%' || $2 || '%'
          OR v.estado ILIKE '%' || $2 || '%'
          OR v.id::text ILIKE '%' || $2 || '%'
        )
      ORDER BY v.data_visita DESC NULLS LAST, v.id DESC
      LIMIT $3 OFFSET $4
      `,
      [status, search, filters.pageSize, offset],
    ),
  ]);

  return {
    items: rowsResult.rows.map(mapListRow),
    total: Number.parseInt(countResult.rows[0]?.total ?? "0", 10),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getVisitaById(id: number) {
  const pool = getPgPool();
  await assertVisitaTables(pool);

  const [visitaResult, atividadesResult] = await Promise.all([
    pool.query(
      `
      SELECT
        v.id,
        v.empresa_id AS "empresaId",
        v.status,
        v.data_visita AS "dataVisita",
        v.parceiro_id AS "parceiroId",
        v.parceiro_codigo AS "parceiroCodigo",
        v.parceiro_nome AS "parceiroNome",
        v.responsavel_id AS "responsavelId",
        v.responsavel_codigo AS "responsavelCodigo",
        v.responsavel_nome AS "responsavelNome",
        v.cep,
        v.endereco,
        v.complemento,
        v.bairro,
        v.cidade,
        v.estado,
        v.telefone,
        v.email,
        coalesce(v.rebanho_atual, 0) AS "rebanhoAtual",
        v.informacoes_detalhadas AS "informacoesDetalhadas",
        v.categoria,
        v.raca,
        v.categoria_itens AS "categoriaItensData",
        v.observacoes,
        v.tipo_contrato_sugerido AS "tipoContratoSugerido",
        v.contrato_gerado_id AS "contratoGeradoId",
        v.created_on AS "criadoEm",
        v.updated_on AS "atualizadoEm"
      FROM ${VISITA_TABLE} v
      WHERE v.id = $1
      `,
      [id],
    ),
    pool.query(
      `
      SELECT
        a.id,
        a.tipo_atividade AS "tipoAtividade",
        a.data_vencimento AS "dataVencimento",
        a.resumo,
        a.responsavel,
        a.data_realizacao AS "dataRealizacao",
        a.descricao_atividade AS "descricaoAtividade"
      FROM ${VISITA_ATIVIDADE_TABLE} a
      WHERE a.visita_id = $1
      ORDER BY a.id ASC
      `,
      [id],
    ),
  ]);

  if ((visitaResult.rowCount ?? 0) === 0) return null;

  const visitaBase = visitaResult.rows[0] as Record<string, unknown>;
  const observacaoRaw = toNullableString(visitaBase.observacoes);
  const observacaoParsed = splitObservacoesAndMeta(observacaoRaw);
  visitaBase.observacoes = observacaoParsed.text;
  const categoriaItensCol = normalizeCategoriaItens(visitaBase.categoriaItensData);
  visitaBase.categoriaItens =
    categoriaItensCol.length > 0
      ? categoriaItensCol
      : readCategoriaItensFromMeta(observacaoParsed.meta);
  visitaBase.raca = toNullableString(visitaBase.raca) ?? readRacaFromMeta(observacaoParsed.meta);

  return {
    visita: mapVisitaRow(visitaBase),
    atividades: atividadesResult.rows.map(mapAtividadeRow),
  };
}

export async function createVisita(input: VisitaCreateInput) {
  const pool = getPgPool();
  await assertVisitaTables(pool);

  const status = ensureStatus(input.status);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const observacoes = normalizeText(input.observacoes);
    const categoriaItens = normalizeCategoriaItens(input.categoriaItens ?? []);

    const insertResult = await client.query<{ id: number }>(
      `
      INSERT INTO ${VISITA_TABLE} (
        created_on,
        updated_on,
        empresa_id,
        status,
        data_visita,
        parceiro_id,
        parceiro_codigo,
        parceiro_nome,
        responsavel_id,
        responsavel_codigo,
        responsavel_nome,
        cep,
        endereco,
        complemento,
        bairro,
        cidade,
        estado,
        telefone,
        email,
        rebanho_atual,
        informacoes_detalhadas,
        categoria,
        raca,
        categoria_itens,
        observacoes,
        tipo_contrato_sugerido
      )
      VALUES (
        now(),
        now(),
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )
      RETURNING id
      `,
      [
        input.empresaId,
        status,
        normalizeDateInput(input.dataVisita),
        input.parceiroId ?? null,
        normalizeText(input.parceiroCodigo),
        normalizeText(input.parceiroNome),
        input.responsavelId ?? null,
        normalizeText(input.responsavelCodigo),
        normalizeText(input.responsavelNome),
        normalizeText(input.cep),
        normalizeText(input.endereco),
        normalizeText(input.complemento),
        normalizeText(input.bairro),
        normalizeText(input.cidade),
        normalizeText(input.estado),
        normalizeText(input.telefone),
        normalizeText(input.email),
        input.rebanhoAtual ?? 0,
        normalizeText(input.informacoesDetalhadas),
        normalizeText(input.categoria),
        normalizeText(input.raca),
        serializeJsonArrayOrNull(categoriaItens),
        observacoes,
        input.tipoContratoSugerido ?? "entrada_animais",
      ],
    );

    const visitaId = insertResult.rows[0].id;
    await replaceAtividades(client, visitaId, input.atividades ?? []);

    await client.query("COMMIT");
    return await getVisitaById(visitaId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateVisita(id: number, input: VisitaUpdateInput) {
  const pool = getPgPool();
  await assertVisitaTables(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockResult = await client.query<{ id: number; status: string | null; contratoGeradoId: number | null }>(
      `
      SELECT
        id,
        status,
        contrato_gerado_id AS "contratoGeradoId"
      FROM ${VISITA_TABLE}
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if ((lockResult.rowCount ?? 0) === 0) {
      throw new Error("Visita nao encontrada.");
    }
    const locked = lockResult.rows[0];
    if (locked.contratoGeradoId || ensureStatus(toText(locked.status)) === "contrato_gerado") {
      throw new Error("Visita com contrato gerado nao pode ser editada.");
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    function pushSet(column: string, value: unknown) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }

    pushSet("updated_on", new Date());
    if (input.empresaId !== undefined) pushSet("empresa_id", input.empresaId);
    if (input.status !== undefined) pushSet("status", ensureStatus(input.status));
    if (input.dataVisita !== undefined) pushSet("data_visita", normalizeDateInput(input.dataVisita));
    if (input.parceiroId !== undefined) pushSet("parceiro_id", input.parceiroId ?? null);
    if (input.parceiroCodigo !== undefined) pushSet("parceiro_codigo", normalizeText(input.parceiroCodigo));
    if (input.parceiroNome !== undefined) pushSet("parceiro_nome", normalizeText(input.parceiroNome));
    if (input.responsavelId !== undefined) pushSet("responsavel_id", input.responsavelId ?? null);
    if (input.responsavelCodigo !== undefined) pushSet("responsavel_codigo", normalizeText(input.responsavelCodigo));
    if (input.responsavelNome !== undefined) pushSet("responsavel_nome", normalizeText(input.responsavelNome));
    if (input.cep !== undefined) pushSet("cep", normalizeText(input.cep));
    if (input.endereco !== undefined) pushSet("endereco", normalizeText(input.endereco));
    if (input.complemento !== undefined) pushSet("complemento", normalizeText(input.complemento));
    if (input.bairro !== undefined) pushSet("bairro", normalizeText(input.bairro));
    if (input.cidade !== undefined) pushSet("cidade", normalizeText(input.cidade));
    if (input.estado !== undefined) pushSet("estado", normalizeText(input.estado));
    if (input.telefone !== undefined) pushSet("telefone", normalizeText(input.telefone));
    if (input.email !== undefined) pushSet("email", normalizeText(input.email));
    if (input.rebanhoAtual !== undefined) pushSet("rebanho_atual", input.rebanhoAtual ?? 0);
    if (input.informacoesDetalhadas !== undefined) pushSet("informacoes_detalhadas", normalizeText(input.informacoesDetalhadas));
    if (input.categoria !== undefined) pushSet("categoria", normalizeText(input.categoria));
    if (input.raca !== undefined) pushSet("raca", normalizeText(input.raca));
    if (input.categoriaItens !== undefined) pushSet("categoria_itens", serializeJsonArrayOrNull(normalizeCategoriaItens(input.categoriaItens)));
    if (input.observacoes !== undefined) pushSet("observacoes", normalizeText(input.observacoes));
    if (input.tipoContratoSugerido !== undefined) pushSet("tipo_contrato_sugerido", input.tipoContratoSugerido);

    if (sets.length > 0) {
      values.push(id);
      await client.query(
        `
        UPDATE ${VISITA_TABLE}
        SET ${sets.join(", ")}
        WHERE id = $${values.length}
        `,
        values,
      );
    }

    if (input.atividades !== undefined) {
      await replaceAtividades(client, id, input.atividades);
    }

    await client.query("COMMIT");
    return await getVisitaById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markVisitaContratoGerado(visitaId: number, contratoId: number) {
  const pool = getPgPool();
  await assertVisitaTables(pool);

  const result = await pool.query(
    `
    UPDATE ${VISITA_TABLE}
    SET
      status = 'contrato_gerado',
      contrato_gerado_id = $2,
      updated_on = now()
    WHERE id = $1
    RETURNING id
    `,
    [visitaId, contratoId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("Visita nao encontrada.");
  }
}

async function replaceAtividades(client: PoolClient, visitaId: number, atividades: VisitaAtividadePayload[]) {
  await client.query(`DELETE FROM ${VISITA_ATIVIDADE_TABLE} WHERE visita_id = $1`, [visitaId]);
  if (atividades.length === 0) return;

  for (const atividade of atividades) {
    await client.query(
      `
      INSERT INTO ${VISITA_ATIVIDADE_TABLE} (
        visita_id,
        tipo_atividade,
        data_vencimento,
        resumo,
        responsavel,
        data_realizacao,
        descricao_atividade,
        created_on,
        updated_on
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
      `,
      [
        visitaId,
        normalizeText(atividade.tipoAtividade),
        normalizeDateInput(atividade.dataVencimento),
        normalizeText(atividade.resumo),
        normalizeText(atividade.responsavel),
        normalizeDateInput(atividade.dataRealizacao),
        normalizeText(atividade.descricaoAtividade),
      ],
    );
  }
}

function mapListRow(row: Record<string, unknown>): VisitaListItem {
  return {
    id: toNumber(row.id),
    status: ensureStatus(toText(row.status)),
    dataVisita: toDateOnlyString(row.dataVisita),
    parceiro: toNullableString(row.parceiro),
    responsavel: toNullableString(row.responsavel),
    endereco: toNullableString(row.endereco),
    rebanhoAtual: toDecimal(row.rebanhoAtual),
    contratoGeradoId: toNullableInteger(row.contratoGeradoId),
  };
}

function mapVisitaRow(row: Record<string, unknown>): VisitaRecord {
  return {
    id: toNumber(row.id),
    empresaId: toNumber(row.empresaId),
    status: ensureStatus(toText(row.status)),
    dataVisita: toDateOnlyString(row.dataVisita),
    parceiroId: toNullableInteger(row.parceiroId),
    parceiroCodigo: toNullableString(row.parceiroCodigo),
    parceiroNome: toNullableString(row.parceiroNome),
    responsavelId: toNullableInteger(row.responsavelId),
    responsavelCodigo: toNullableString(row.responsavelCodigo),
    responsavelNome: toNullableString(row.responsavelNome),
    cep: toNullableString(row.cep),
    endereco: toNullableString(row.endereco),
    complemento: toNullableString(row.complemento),
    bairro: toNullableString(row.bairro),
    cidade: toNullableString(row.cidade),
    estado: toNullableString(row.estado),
    telefone: toNullableString(row.telefone),
    email: toNullableString(row.email),
    rebanhoAtual: toDecimal(row.rebanhoAtual),
    informacoesDetalhadas: toNullableString(row.informacoesDetalhadas),
    categoria: toNullableString(row.categoria),
    raca: toNullableString(row.raca),
    observacoes: toNullableString(row.observacoes),
    categoriaItens: normalizeCategoriaItens(row.categoriaItens),
    tipoContratoSugerido: toText(row.tipoContratoSugerido) === "saida_insumos" ? "saida_insumos" : "entrada_animais",
    contratoGeradoId: toNullableInteger(row.contratoGeradoId),
    criadoEm: toNullableString(row.criadoEm),
    atualizadoEm: toNullableString(row.atualizadoEm),
  };
}

function mapAtividadeRow(row: Record<string, unknown>): VisitaAtividadePayload {
  return {
    tipoAtividade: toText(row.tipoAtividade),
    dataVencimento: toDateOnlyString(row.dataVencimento) ?? "",
    resumo: toText(row.resumo),
    responsavel: toText(row.responsavel),
    dataRealizacao: toDateOnlyString(row.dataRealizacao) ?? "",
    descricaoAtividade: toText(row.descricaoAtividade),
  };
}

function normalizeCategoriaItens(value: unknown): VisitaCategoriaItemPayload[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        categoria: toText(readCaseInsensitive(row, ["categoria"])),
        raca: toText(readCaseInsensitive(row, ["raca"])),
        qualidade: toText(readCaseInsensitive(row, ["qualidade"])),
        condicaoPagto: toText(readCaseInsensitive(row, ["condicaoPagto", "condicaoPagamento", "condicao"])),
        pesoAproxArroba: toText(readCaseInsensitive(row, ["pesoAproxArroba", "pesoAprox", "pesoArroba"])),
        rcPercentual: toText(readCaseInsensitive(row, ["rcPercentual", "rc"])),
        valorArroba: toText(readCaseInsensitive(row, ["valorArroba", "valor"])),
        valorTabelaArroba: toText(readCaseInsensitive(row, ["valorTabelaArroba", "valorTabela"])),
        freteArroba: toText(readCaseInsensitive(row, ["freteArroba", "frete"])),
        valorIcmsArroba: toText(readCaseInsensitive(row, ["valorIcmsArroba", "valorIcms"])),
        cabecas: toText(readCaseInsensitive(row, ["cabecas", "quantidadeCabecas"])),
      };
    });
}

async function assertVisitaTables(pool: Pool) {
  const result = await pool.query<{ visita_relation: string | null; atividade_relation: string | null }>(
    `
    SELECT
      to_regclass($1) AS visita_relation,
      to_regclass($2) AS atividade_relation
    `,
    [VISITA_TABLE, VISITA_ATIVIDADE_TABLE],
  );

  if (!result.rows[0]?.visita_relation || !result.rows[0]?.atividade_relation) {
    throw new Error(
      "Tabelas contrato.visita/contrato.visita_atividade nao encontradas. Execute docs/sql/005_visitas_schema.sql.",
    );
  }

  await ensureVisitaExtraColumns(pool);
}

async function ensureVisitaExtraColumns(pool: Pool) {
  if (visitaExtraColumnsEnsured) return;
  await pool.query(
    `
    ALTER TABLE ${VISITA_TABLE}
      ADD COLUMN IF NOT EXISTS raca VARCHAR(120) NULL,
      ADD COLUMN IF NOT EXISTS categoria_itens JSONB NULL;
    `,
  );
  visitaExtraColumnsEnsured = true;
}

function ensureStatus(value: unknown): VisitaStatus {
  const text = String(value ?? "").trim().toLowerCase();
  if (validStatus.has(text as VisitaStatus)) return text as VisitaStatus;
  return "oportunidade";
}

function splitObservacoesAndMeta(observacoes: string | null): { text: string | null; meta: Record<string, unknown> | null } {
  if (!observacoes) return { text: null, meta: null };
  const markerIndexWithPrefix = observacoes.lastIndexOf(OBS_META_MARKER);
  const markerIndexBare = observacoes.lastIndexOf(OBS_META_MARKER_BARE);
  const markerIndex = markerIndexWithPrefix >= 0 ? markerIndexWithPrefix : markerIndexBare;
  if (markerIndex < 0) return { text: observacoes, meta: null };

  const markerLength = markerIndexWithPrefix >= 0 ? OBS_META_MARKER.length : OBS_META_MARKER_BARE.length;
  const text = observacoes.slice(0, markerIndex).trim() || null;
  const metaRaw = observacoes.slice(markerIndex + markerLength).trim();
  const meta = parseJsonObject(metaRaw);
  return { text, meta };
}

function composeObservacoesWithMeta(observacoes: string | null, meta: VisitaMetaPayload | null): string | null {
  const text = normalizeText(observacoes);
  const serialized = serializeJsonOrNull(meta);
  if (!serialized) return text;
  if (!text) return `${OBS_META_MARKER}${serialized}`;
  return `${text}${OBS_META_MARKER}${serialized}`;
}

function readCategoriaItensFromMeta(meta: Record<string, unknown> | null): VisitaCategoriaItemPayload[] {
  const categoriaItensRaw = readCaseInsensitive(meta, ["categoriaItens", "categoriaitens"]);
  if (!Array.isArray(categoriaItensRaw)) return [];
  return normalizeCategoriaItens(categoriaItensRaw);
}

function readRacaFromMeta(meta: Record<string, unknown> | null): string | null {
  return normalizeText(readCaseInsensitive(meta, ["raca"]));
}

function mergeMeta(currentMeta: Record<string, unknown> | null, patch: VisitaMetaPayload): VisitaMetaPayload | null {
  const current = currentMeta ?? {};
  const categoriaItens =
    patch.categoriaItens !== undefined
      ? patch.categoriaItens
      : readCaseInsensitive(current, ["categoriaItens", "categoriaitens"]) &&
          Array.isArray(readCaseInsensitive(current, ["categoriaItens", "categoriaitens"]))
        ? normalizeCategoriaItens(readCaseInsensitive(current, ["categoriaItens", "categoriaitens"]))
        : [];
  const raca = patch.raca !== undefined ? patch.raca : normalizeText(readCaseInsensitive(current, ["raca"]));

  if ((!categoriaItens || categoriaItens.length === 0) && !raca) return null;
  return { categoriaItens, raca };
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeJsonOrNull(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length === 0) return null;
  return JSON.stringify(obj);
}

function serializeJsonArrayOrNull(value: unknown[]): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return JSON.stringify(value);
}

function normalizeDateInput(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNullableString(value: unknown): string | null {
  const text = toText(value);
  return text.length === 0 ? null : text;
}

function toDateOnlyString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) return null;

  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];

  const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDecimal(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readCaseInsensitive(
  row: Record<string, unknown> | null | undefined,
  keys: string[],
): unknown {
  if (!row || typeof row !== "object") return undefined;

  for (const key of keys) {
    if (key in row) return row[key];
  }

  const normalizedEntries = Object.entries(row).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const key of keys) {
    const found = normalizedEntries.find(([entryKey]) => entryKey === key.toLowerCase());
    if (found) return found[1];
  }

  return undefined;
}
