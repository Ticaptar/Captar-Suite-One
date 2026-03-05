import type { Pool, PoolClient } from "pg";
import { getPgPool } from "@/lib/db";
import type {
  PesagemCalendarioRow,
  PesagemClassificacaoRow,
  PesagemDocumentoFiscal,
  PesagemEntradaAnimaisCreateInput,
  PesagemEntradaAnimaisListFilters,
  PesagemEntradaAnimaisOptionsPayload,
  PesagemEntradaAnimaisRecord,
  PesagemFechamento,
  PesagemGtaRow,
  PesagemEntradaAnimaisUpdateInput,
  PesagemMotivoRow,
  PesagemStatus,
  PesagemTipo,
} from "@/lib/types/pesagem";

const PESAGEM_TABLE = "agro.pesagem_veiculo";
const DOC_TABLE = "agro.pesagem_veiculo_documento_fiscal";
const ATRASO_TABLE = "agro.pesagem_veiculo_motivo_atraso";
const ESPERA_TABLE = "agro.pesagem_veiculo_motivo_espera";
const CALENDARIO_TABLE = "agro.pesagem_veiculo_calendario";
const GTA_TABLE = "agro.pesagem_veiculo_gta";
const CLASSIFICACAO_TABLE = "agro.pesagem_veiculo_classificacao";
const FECHAMENTO_TABLE = "agro.pesagem_veiculo_fechamento";
const tableExistsCache = new Map<string, boolean>();
let pesagemSchemaEnsured = false;
const CONTRATO_TIPO_NORMALIZED_SQL = "replace(replace(lower(trim(coalesce(tp_contrato, ''))), '-', '_'), ' ', '_')";

const validStatuses = new Set<PesagemStatus>([
  "disponivel",
  "peso_finalizado",
  "fechado",
  "cancelado",
]);

export async function listPesagensEntradaInsumos(filters: PesagemEntradaAnimaisListFilters) {
  const pool = getPgPool();
  await ensurePesagemSchema(pool);

  const status = filters.status ?? null;
  const search = filters.search?.trim() ? filters.search.trim() : null;
  const offset = (filters.page - 1) * filters.pageSize;

  const [countResult, rowsResult] = await Promise.all([
    pool.query<{ total: string }>(
      `
      SELECT count(*)::text AS total
      FROM ${PESAGEM_TABLE} p
      WHERE lower(coalesce(p.tipo, '')) = 'entrada_insumos'
        AND ($1::text IS NULL OR lower(coalesce(p.status, '')) = $1)
        AND (
          $2::text IS NULL
          OR coalesce(p.numero, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.contrato_referencia, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.motorista_nome, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.transportador_nome, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.contratante_nome, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.item_descricao, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.placa, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.equipamento_nome, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.operacao, '') ILIKE '%' || $2 || '%'
          OR p.id::text ILIKE '%' || $2 || '%'
        )
      `,
      [status, search],
    ),
    pool.query(
      `
      SELECT
        p.id,
        p.status,
        p.numero AS "numeroTicket",
        p.contrato_id AS "contratoId",
        p.contrato_referencia AS contrato,
        p.motorista_nome AS motorista,
        p.transportador_nome AS transportador,
        p.contratante_nome AS contratante,
        p.item_descricao AS item,
        p.dt_chegada AS "dataChegada",
        p.dt_saida AS "dataSaida",
        p.placa,
        p.equipamento_nome AS equipamento,
        p.operacao,
        coalesce(p.peso_bruto, 0) AS "pesoBruto",
        coalesce(p.peso_liquido, 0) AS "pesoLiquido"
      FROM ${PESAGEM_TABLE} p
      WHERE lower(coalesce(p.tipo, '')) = 'entrada_insumos'
        AND ($1::text IS NULL OR lower(coalesce(p.status, '')) = $1)
        AND (
          $2::text IS NULL
          OR coalesce(p.numero, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.contrato_referencia, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.motorista_nome, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.transportador_nome, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.contratante_nome, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.item_descricao, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.placa, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.equipamento_nome, '') ILIKE '%' || $2 || '%'
          OR coalesce(p.operacao, '') ILIKE '%' || $2 || '%'
          OR p.id::text ILIKE '%' || $2 || '%'
        )
      ORDER BY p.id DESC
      LIMIT $3 OFFSET $4
      `,
      [status, search, filters.pageSize, offset],
    ),
  ]);

  return {
    items: rowsResult.rows.map((row) => ({
      id: toNumber(row.id),
      status: normalizeStatus(row.status),
      numeroTicket: toNullableString(row.numeroTicket),
      contratoId: toNullableInteger(row.contratoId),
      contrato: toNullableString(row.contrato),
      motorista: toNullableString(row.motorista),
      transportador: toNullableString(row.transportador),
      contratante: toNullableString(row.contratante),
      item: toNullableString(row.item),
      dataChegada: toDateOnlyString(row.dataChegada),
      dataSaida: toDateOnlyString(row.dataSaida),
      placa: toNullableString(row.placa),
      equipamento: toNullableString(row.equipamento),
      operacao: toNullableString(row.operacao),
      pesoBruto: toDecimal(row.pesoBruto),
      pesoLiquido: toDecimal(row.pesoLiquido),
    })),
    total: Number.parseInt(countResult.rows[0]?.total ?? "0", 10),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getPesagemEntradaInsumosById(id: number): Promise<PesagemEntradaAnimaisRecord | null> {
  const pool = getPgPool();
  await ensurePesagemSchema(pool);

  const [baseResult, docsResult, atrasoResult, esperaResult, calendarioResult, gtaResult, classificacaoResult, fechamentoResult] = await Promise.all([
    pool.query(
      `
      SELECT *
      FROM ${PESAGEM_TABLE} p
      WHERE p.id = $1
        AND lower(coalesce(p.tipo, '')) = 'entrada_insumos'
      `,
      [id],
    ),
    pool.query(`SELECT id, documento FROM ${DOC_TABLE} WHERE pesagem_id = $1 ORDER BY id ASC`, [id]),
    pool.query(`SELECT id, motivo, coalesce(tempo_minutos, 0) AS "tempoMinutos" FROM ${ATRASO_TABLE} WHERE pesagem_id = $1 ORDER BY id ASC`, [id]),
    pool.query(`SELECT id, motivo, coalesce(tempo_minutos, 0) AS "tempoMinutos" FROM ${ESPERA_TABLE} WHERE pesagem_id = $1 ORDER BY id ASC`, [id]),
    pool.query(`SELECT id, dt AS data, dia, coalesce(feriado, false) AS feriado, coalesce(pago, false) AS pago, coalesce(vl, 0) AS valor FROM ${CALENDARIO_TABLE} WHERE pesagem_id = $1 ORDER BY dt ASC, id ASC`, [id]),
    pool.query(`SELECT id, gta, coalesce(qtd_machos, 0) AS "quantidadeMachos", coalesce(qtd_femeas, 0) AS "quantidadeFemeas", coalesce(qtd_total, 0) AS "quantidadeTotal" FROM ${GTA_TABLE} WHERE pesagem_id = $1 ORDER BY id ASC`, [id]),
    pool.query(`SELECT id, tipo_analise AS "tipoAnalise", coalesce(vl_encontrado, 0) AS "valorEncontrado", coalesce(peso_desconto, 0) AS "pesoDesconto", unidade FROM ${CLASSIFICACAO_TABLE} WHERE pesagem_id = $1 ORDER BY id ASC`, [id]),
    pool.query(`SELECT * FROM ${FECHAMENTO_TABLE} WHERE pesagem_id = $1 LIMIT 1`, [id]),
  ]);

  if ((baseResult.rowCount ?? 0) === 0) return null;
  const row = baseResult.rows[0] as Record<string, unknown>;

  return {
    id: toNumber(row.id),
    status: normalizeStatus(row.status),
    tipo: normalizeTipo(row.tipo),
    numeroTicket: toNullableString(row.numero),
    contratoId: toNullableInteger(row.contrato_id),
    contratoReferencia: toNullableString(row.contrato_referencia),
    itemId: toNullableInteger(row.item_id),
    itemDescricao: toNullableString(row.item_descricao),
    fazendaId: toNullableInteger(row.fazenda_id),
    fazendaNome: toNullableString(row.fazenda_nome),
    tipoFrete: toNullableString(row.tp_frete),
    responsavelFrete: toNullableString(row.responsavel_frete),
    transportadorId: toNullableInteger(row.transportador_id),
    transportadorNome: toNullableString(row.transportador_nome),
    contratanteId: toNullableInteger(row.contratante_id),
    contratanteNome: toNullableString(row.contratante_nome),
    motoristaId: toNullableInteger(row.motorista_id),
    motoristaNome: toNullableString(row.motorista_nome),
    dataChegada: toDateOnlyString(row.dt_chegada),
    horaChegada: toTimeOnlyString(row.hr_chegada),
    dataSaida: toDateOnlyString(row.dt_saida),
    horaSaida: toTimeOnlyString(row.hr_saida),
    placa: toNullableString(row.placa),
    equipamentoId: toNullableInteger(row.equipamento_id),
    equipamentoNome: toNullableString(row.equipamento_nome),
    viagem: toNullableString(row.viagem),
    dataInicio: toDateOnlyString(row.dt_inicio),
    dataFim: toDateOnlyString(row.dt_fim),
    kmInicial: toDecimal(row.km_inicial),
    kmFinal: toDecimal(row.km_final),
    kmTotal: toDecimal(row.km_total),
    observacao: toNullableString(row.observacao),
    pesoBruto: toDecimal(row.peso_bruto),
    pesoTara: toDecimal(row.peso_tara),
    pesoLiquido: toDecimal(row.peso_liquido),
    operacao: toNullableString(row.operacao),
    createdOn: toNullableString(row.created_on),
    updatedOn: toNullableString(row.updated_on),
    documentosFiscais: docsResult.rows.map((item) => ({ id: toNumber(item.id), documento: toText(item.documento) })),
    motivosAtraso: atrasoResult.rows.map((item) => ({ id: toNumber(item.id), motivo: toText(item.motivo), tempoMinutos: toNumber(item.tempoMinutos) })),
    motivosEspera: esperaResult.rows.map((item) => ({ id: toNumber(item.id), motivo: toText(item.motivo), tempoMinutos: toNumber(item.tempoMinutos) })),
    calendario: calendarioResult.rows.map((item) => ({
      id: toNumber(item.id),
      data: toDateOnlyString(item.data) ?? "",
      dia: toText(item.dia),
      feriado: toBoolean(item.feriado),
      pago: toBoolean(item.pago),
      valor: toDecimal(item.valor),
    })),
    gtaRows: gtaResult.rows.map((item) => ({
      id: toNumber(item.id),
      gta: toText(item.gta),
      quantidadeMachos: toInteger(item.quantidadeMachos),
      quantidadeFemeas: toInteger(item.quantidadeFemeas),
      quantidadeTotal: toInteger(item.quantidadeTotal),
    })),
    classificacaoRows: classificacaoResult.rows.map((item) => ({
      id: toNumber(item.id),
      tipoAnalise: toText(item.tipoAnalise),
      valorEncontrado: toDecimal(item.valorEncontrado),
      pesoDesconto: toDecimal(item.pesoDesconto),
      unidade: toNullableString(item.unidade),
    })),
    fechamento: mapFechamentoRow(fechamentoResult.rows[0] as Record<string, unknown> | undefined),
  };
}

export async function createPesagemEntradaInsumos(input: PesagemEntradaAnimaisCreateInput) {
  const pool = getPgPool();
  await ensurePesagemSchema(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number }>(
      `
      INSERT INTO ${PESAGEM_TABLE} (
        created_on, updated_on, status, tipo, numero, contrato_id, contrato_referencia, item_id, item_descricao,
        fazenda_id, fazenda_nome, tp_frete, responsavel_frete, transportador_id, transportador_nome, contratante_id, contratante_nome,
        motorista_id, motorista_nome, dt_chegada, hr_chegada, dt_saida, hr_saida, placa, equipamento_id, equipamento_nome, viagem,
        dt_inicio, dt_fim, km_inicial, km_final, km_total, observacao, peso_bruto, peso_tara, peso_liquido, operacao
      )
      VALUES (
        now(), now(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
      )
      RETURNING id
      `,
      [
        normalizeStatus(input.status),
        normalizeTipo(input.tipo),
        normalizeText(input.numeroTicket),
        input.contratoId ?? null,
        normalizeText(input.contratoReferencia),
        input.itemId ?? null,
        normalizeText(input.itemDescricao),
        input.fazendaId ?? null,
        normalizeText(input.fazendaNome),
        normalizeText(input.tipoFrete),
        normalizeText(input.responsavelFrete),
        input.transportadorId ?? null,
        normalizeText(input.transportadorNome),
        input.contratanteId ?? null,
        normalizeText(input.contratanteNome),
        input.motoristaId ?? null,
        normalizeText(input.motoristaNome),
        normalizeDateInput(input.dataChegada),
        normalizeTimeInput(input.horaChegada),
        normalizeDateInput(input.dataSaida),
        normalizeTimeInput(input.horaSaida),
        normalizeText(input.placa),
        input.equipamentoId ?? null,
        normalizeText(input.equipamentoNome),
        normalizeText(input.viagem),
        normalizeDateInput(input.dataInicio),
        normalizeDateInput(input.dataFim),
        input.kmInicial ?? 0,
        input.kmFinal ?? 0,
        input.kmTotal ?? 0,
        normalizeText(input.observacao),
        input.pesoBruto ?? 0,
        input.pesoTara ?? 0,
        input.pesoLiquido ?? 0,
        normalizeText(input.operacao),
      ],
    );

    const id = inserted.rows[0].id;
    await replaceDocumentosFiscais(client, id, input.documentosFiscais ?? []);
    await replaceMotivos(client, ATRASO_TABLE, id, input.motivosAtraso ?? []);
    await replaceMotivos(client, ESPERA_TABLE, id, input.motivosEspera ?? []);
    await replaceCalendario(client, id, input.calendario ?? []);
    await replaceGtaRows(client, id, input.gtaRows ?? []);
    await replaceClassificacaoRows(client, id, input.classificacaoRows ?? []);
    await upsertFechamento(client, id, input.fechamento ?? null);

    await client.query("COMMIT");
    return await getPesagemEntradaInsumosById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePesagemEntradaInsumos(id: number, input: PesagemEntradaAnimaisUpdateInput) {
  const pool = getPgPool();
  await ensurePesagemSchema(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query<{ id: number }>(`SELECT id FROM ${PESAGEM_TABLE} WHERE id = $1 FOR UPDATE`, [id]);
    if ((lock.rowCount ?? 0) === 0) throw new Error("Pesagem nao encontrada.");

    const sets: string[] = [];
    const values: unknown[] = [];
    function pushSet(column: string, value: unknown) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }

    pushSet("updated_on", new Date());
    if (input.status !== undefined) pushSet("status", normalizeStatus(input.status));
    if (input.tipo !== undefined) pushSet("tipo", normalizeTipo(input.tipo));
    if (input.numeroTicket !== undefined) pushSet("numero", normalizeText(input.numeroTicket));
    if (input.contratoId !== undefined) pushSet("contrato_id", input.contratoId ?? null);
    if (input.contratoReferencia !== undefined) pushSet("contrato_referencia", normalizeText(input.contratoReferencia));
    if (input.itemId !== undefined) pushSet("item_id", input.itemId ?? null);
    if (input.itemDescricao !== undefined) pushSet("item_descricao", normalizeText(input.itemDescricao));
    if (input.fazendaId !== undefined) pushSet("fazenda_id", input.fazendaId ?? null);
    if (input.fazendaNome !== undefined) pushSet("fazenda_nome", normalizeText(input.fazendaNome));
    if (input.tipoFrete !== undefined) pushSet("tp_frete", normalizeText(input.tipoFrete));
    if (input.responsavelFrete !== undefined) pushSet("responsavel_frete", normalizeText(input.responsavelFrete));
    if (input.transportadorId !== undefined) pushSet("transportador_id", input.transportadorId ?? null);
    if (input.transportadorNome !== undefined) pushSet("transportador_nome", normalizeText(input.transportadorNome));
    if (input.contratanteId !== undefined) pushSet("contratante_id", input.contratanteId ?? null);
    if (input.contratanteNome !== undefined) pushSet("contratante_nome", normalizeText(input.contratanteNome));
    if (input.motoristaId !== undefined) pushSet("motorista_id", input.motoristaId ?? null);
    if (input.motoristaNome !== undefined) pushSet("motorista_nome", normalizeText(input.motoristaNome));
    if (input.dataChegada !== undefined) pushSet("dt_chegada", normalizeDateInput(input.dataChegada));
    if (input.horaChegada !== undefined) pushSet("hr_chegada", normalizeTimeInput(input.horaChegada));
    if (input.dataSaida !== undefined) pushSet("dt_saida", normalizeDateInput(input.dataSaida));
    if (input.horaSaida !== undefined) pushSet("hr_saida", normalizeTimeInput(input.horaSaida));
    if (input.placa !== undefined) pushSet("placa", normalizeText(input.placa));
    if (input.equipamentoId !== undefined) pushSet("equipamento_id", input.equipamentoId ?? null);
    if (input.equipamentoNome !== undefined) pushSet("equipamento_nome", normalizeText(input.equipamentoNome));
    if (input.viagem !== undefined) pushSet("viagem", normalizeText(input.viagem));
    if (input.dataInicio !== undefined) pushSet("dt_inicio", normalizeDateInput(input.dataInicio));
    if (input.dataFim !== undefined) pushSet("dt_fim", normalizeDateInput(input.dataFim));
    if (input.kmInicial !== undefined) pushSet("km_inicial", input.kmInicial ?? 0);
    if (input.kmFinal !== undefined) pushSet("km_final", input.kmFinal ?? 0);
    if (input.kmTotal !== undefined) pushSet("km_total", input.kmTotal ?? 0);
    if (input.observacao !== undefined) pushSet("observacao", normalizeText(input.observacao));
    if (input.pesoBruto !== undefined) pushSet("peso_bruto", input.pesoBruto ?? 0);
    if (input.pesoTara !== undefined) pushSet("peso_tara", input.pesoTara ?? 0);
    if (input.pesoLiquido !== undefined) pushSet("peso_liquido", input.pesoLiquido ?? 0);
    if (input.operacao !== undefined) pushSet("operacao", normalizeText(input.operacao));

    if (sets.length > 0) {
      values.push(id);
      await client.query(`UPDATE ${PESAGEM_TABLE} SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    }
    if (input.documentosFiscais !== undefined) await replaceDocumentosFiscais(client, id, input.documentosFiscais);
    if (input.motivosAtraso !== undefined) await replaceMotivos(client, ATRASO_TABLE, id, input.motivosAtraso);
    if (input.motivosEspera !== undefined) await replaceMotivos(client, ESPERA_TABLE, id, input.motivosEspera);
    if (input.calendario !== undefined) await replaceCalendario(client, id, input.calendario);
    if (input.gtaRows !== undefined) await replaceGtaRows(client, id, input.gtaRows);
    if (input.classificacaoRows !== undefined) await replaceClassificacaoRows(client, id, input.classificacaoRows);
    if (input.fechamento !== undefined) await upsertFechamento(client, id, input.fechamento ?? null);

    await client.query("COMMIT");
    return await getPesagemEntradaInsumosById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPesagemEntradaInsumosOptions(filters?: {
  contratoSearch?: string | null;
  contratoLimit?: number | null;
}): Promise<PesagemEntradaAnimaisOptionsPayload> {
  const pool = getPgPool();
  await ensurePesagemSchema(pool);
  const contratos = await loadContratosOptions(pool, {
    search: filters?.contratoSearch ?? null,
    limit: filters?.contratoLimit ?? null,
  });
  return {
    contratos,
    itens: [],
    fazendas: [],
    parceiros: [],
    motoristas: [],
    equipamentos: [],
    viagens: [],
  };
}

async function loadContratosOptions(
  pool: Pool,
  filters: { search?: string | null; limit?: number | null } = {},
) {
  if (!(await hasTable(pool, "contrato.contrato"))) return [];
  const search = filters.search?.trim() ? filters.search.trim() : null;
  const parsedLimit = Number(filters.limit);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 20), 300) : 120;
  const result = await pool.query(
    `
    SELECT id, coalesce(numero::text, '') AS numero, coalesce(descricao, '') AS descricao
    FROM contrato.contrato
    WHERE lower(trim(coalesce(status, ''))) = 'ativo'
      AND ${CONTRATO_TIPO_NORMALIZED_SQL} IN ('entrada_insumos', 'saida_insumos', 'insumos')
      AND (
        $1::text IS NULL
        OR id::text ILIKE '%' || $1 || '%'
        OR coalesce(numero::text, '') ILIKE '%' || $1 || '%'
        OR coalesce(descricao, '') ILIKE '%' || $1 || '%'
      )
    ORDER BY id DESC
    LIMIT $2
    `,
    [search, limit],
  );
  return result.rows.map((row) => ({
    id: toNumber(row.id),
    numero: toNullableString(row.numero),
    descricao: toNullableString(row.descricao),
  }));
}

async function replaceDocumentosFiscais(client: PoolClient, pesagemId: number, rows: PesagemDocumentoFiscal[]) {
  await client.query(`DELETE FROM ${DOC_TABLE} WHERE pesagem_id = $1`, [pesagemId]);
  for (const row of rows) {
    const documento = normalizeText(row.documento);
    if (!documento) continue;
    await client.query(`INSERT INTO ${DOC_TABLE} (pesagem_id, documento, created_on, updated_on) VALUES ($1,$2,now(),now())`, [pesagemId, documento]);
  }
}

async function replaceMotivos(client: PoolClient, table: string, pesagemId: number, rows: PesagemMotivoRow[]) {
  await client.query(`DELETE FROM ${table} WHERE pesagem_id = $1`, [pesagemId]);
  for (const row of rows) {
    const motivo = normalizeText(row.motivo);
    if (!motivo) continue;
    await client.query(`INSERT INTO ${table} (pesagem_id, motivo, tempo_minutos, created_on, updated_on) VALUES ($1,$2,$3,now(),now())`, [pesagemId, motivo, Math.max(0, Math.trunc(row.tempoMinutos ?? 0))]);
  }
}

async function replaceCalendario(client: PoolClient, pesagemId: number, rows: PesagemCalendarioRow[]) {
  await client.query(`DELETE FROM ${CALENDARIO_TABLE} WHERE pesagem_id = $1`, [pesagemId]);
  for (const row of rows) {
    const data = normalizeDateInput(row.data);
    if (!data) continue;
    await client.query(`INSERT INTO ${CALENDARIO_TABLE} (pesagem_id, dt, dia, feriado, pago, vl, created_on, updated_on) VALUES ($1,$2,$3,$4,$5,$6,now(),now())`, [pesagemId, data, normalizeText(row.dia), Boolean(row.feriado), Boolean(row.pago), Number.isFinite(row.valor) ? row.valor : 0]);
  }
}

async function replaceGtaRows(client: PoolClient, pesagemId: number, rows: PesagemGtaRow[]) {
  await client.query(`DELETE FROM ${GTA_TABLE} WHERE pesagem_id = $1`, [pesagemId]);
  for (const row of rows) {
    const gta = normalizeText(row.gta);
    const quantidadeMachos = Math.max(0, Math.trunc(row.quantidadeMachos ?? 0));
    const quantidadeFemeas = Math.max(0, Math.trunc(row.quantidadeFemeas ?? 0));
    const quantidadeTotalRaw = Math.max(0, Math.trunc(row.quantidadeTotal ?? 0));
    const quantidadeTotal = quantidadeTotalRaw > 0 ? quantidadeTotalRaw : quantidadeMachos + quantidadeFemeas;
    if (!gta && quantidadeMachos === 0 && quantidadeFemeas === 0 && quantidadeTotal === 0) continue;
    await client.query(
      `INSERT INTO ${GTA_TABLE} (pesagem_id, gta, qtd_machos, qtd_femeas, qtd_total, created_on, updated_on) VALUES ($1,$2,$3,$4,$5,now(),now())`,
      [pesagemId, gta, quantidadeMachos, quantidadeFemeas, quantidadeTotal],
    );
  }
}

async function replaceClassificacaoRows(client: PoolClient, pesagemId: number, rows: PesagemClassificacaoRow[]) {
  await client.query(`DELETE FROM ${CLASSIFICACAO_TABLE} WHERE pesagem_id = $1`, [pesagemId]);
  for (const row of rows) {
    const tipoAnalise = normalizeText(row.tipoAnalise);
    const valorEncontrado = toDecimal(row.valorEncontrado);
    const pesoDesconto = toDecimal(row.pesoDesconto);
    const unidade = normalizeText(row.unidade);
    if (!tipoAnalise && valorEncontrado === 0 && pesoDesconto === 0 && !unidade) continue;
    await client.query(
      `INSERT INTO ${CLASSIFICACAO_TABLE} (pesagem_id, tipo_analise, vl_encontrado, peso_desconto, unidade, created_on, updated_on)
       VALUES ($1,$2,$3,$4,$5,now(),now())`,
      [pesagemId, tipoAnalise, valorEncontrado, pesoDesconto, unidade],
    );
  }
}

async function upsertFechamento(client: PoolClient, pesagemId: number, fechamento: Partial<PesagemFechamento> | null) {
  if (fechamento === null) {
    await client.query(`DELETE FROM ${FECHAMENTO_TABLE} WHERE pesagem_id = $1`, [pesagemId]);
    return;
  }

  await client.query(
    `
    INSERT INTO ${FECHAMENTO_TABLE} (
      pesagem_id,
      tabela_frete,
      calculo_frete,
      periodo_producao_agricola,
      talhao,
      peso_secador,
      peso_desconto_classificado,
      peso_liquido_desconto,
      peso_nota_fiscal,
      peso_origem,
      numero_laudo,
      armazenagem_silo,
      unidade_medida_frete,
      vl_unitario_frete,
      vl_combustivel,
      vl_pedagio,
      outras_despesas,
      litragem,
      vl_comb_litro,
      vl_diaria,
      vl_comissao,
      vl_frete,
      pesagem_origem,
      dt_vencimento,
      qtd_animais,
      qtd_animais_origem,
      mapa_pesagem,
      cte,
      nf_externa,
      created_on,
      updated_on
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,now(),now()
    )
    ON CONFLICT (pesagem_id) DO UPDATE SET
      tabela_frete = EXCLUDED.tabela_frete,
      calculo_frete = EXCLUDED.calculo_frete,
      periodo_producao_agricola = EXCLUDED.periodo_producao_agricola,
      talhao = EXCLUDED.talhao,
      peso_secador = EXCLUDED.peso_secador,
      peso_desconto_classificado = EXCLUDED.peso_desconto_classificado,
      peso_liquido_desconto = EXCLUDED.peso_liquido_desconto,
      peso_nota_fiscal = EXCLUDED.peso_nota_fiscal,
      peso_origem = EXCLUDED.peso_origem,
      numero_laudo = EXCLUDED.numero_laudo,
      armazenagem_silo = EXCLUDED.armazenagem_silo,
      unidade_medida_frete = EXCLUDED.unidade_medida_frete,
      vl_unitario_frete = EXCLUDED.vl_unitario_frete,
      vl_combustivel = EXCLUDED.vl_combustivel,
      vl_pedagio = EXCLUDED.vl_pedagio,
      outras_despesas = EXCLUDED.outras_despesas,
      litragem = EXCLUDED.litragem,
      vl_comb_litro = EXCLUDED.vl_comb_litro,
      vl_diaria = EXCLUDED.vl_diaria,
      vl_comissao = EXCLUDED.vl_comissao,
      vl_frete = EXCLUDED.vl_frete,
      pesagem_origem = EXCLUDED.pesagem_origem,
      dt_vencimento = EXCLUDED.dt_vencimento,
      qtd_animais = EXCLUDED.qtd_animais,
      qtd_animais_origem = EXCLUDED.qtd_animais_origem,
      mapa_pesagem = EXCLUDED.mapa_pesagem,
      cte = EXCLUDED.cte,
      nf_externa = EXCLUDED.nf_externa,
      updated_on = now()
    `,
    [
      pesagemId,
      normalizeText(fechamento.tabelaFrete),
      normalizeText(fechamento.calculoFrete),
      normalizeText(fechamento.periodoProducaoAgricola),
      normalizeText(fechamento.talhao),
      toDecimal(fechamento.pesoSecador),
      toDecimal(fechamento.pesoDescontoClassificado),
      toDecimal(fechamento.pesoLiquidoDesconto),
      toDecimal(fechamento.pesoNotaFiscal),
      toDecimal(fechamento.pesoOrigem),
      normalizeText(fechamento.numeroLaudo),
      normalizeText(fechamento.armazenagemSilo),
      normalizeText(fechamento.unidadeMedidaFrete),
      toDecimal(fechamento.valorUnitarioFrete),
      toDecimal(fechamento.valorCombustivel),
      toDecimal(fechamento.valorPedagio),
      toDecimal(fechamento.outrasDespesas),
      toDecimal(fechamento.litragem),
      toDecimal(fechamento.valorCombLitro),
      toDecimal(fechamento.valorDiaria),
      toDecimal(fechamento.valorComissao),
      toDecimal(fechamento.valorFrete),
      normalizeText(fechamento.pesagemOrigem),
      normalizeDateInput(fechamento.dataVencimento),
      toInteger(fechamento.qtdAnimais),
      toInteger(fechamento.qtdAnimaisOrigem),
      normalizeText(fechamento.mapaPesagem),
      normalizeText(fechamento.cte),
      normalizeText(fechamento.nfExterna),
    ],
  );
}

async function ensurePesagemSchema(pool: Pool) {
  if (pesagemSchemaEnsured) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock global por transacao para evitar corrida de DDL entre requisicoes/processos.
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [48271, 1209]);

    if (pesagemSchemaEnsured) {
      await client.query("COMMIT");
      return;
    }

    await client.query(`CREATE SCHEMA IF NOT EXISTS agro`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${PESAGEM_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        status VARCHAR(32) NOT NULL DEFAULT 'disponivel',
        tipo VARCHAR(32) NOT NULL DEFAULT 'entrada_insumos',
        numero VARCHAR(30) NULL,
        contrato_id BIGINT NULL,
        contrato_referencia VARCHAR(255) NULL,
        item_id BIGINT NULL,
        item_descricao VARCHAR(255) NULL,
        fazenda_id BIGINT NULL,
        fazenda_nome VARCHAR(255) NULL,
        tp_frete VARCHAR(32) NULL,
        responsavel_frete VARCHAR(32) NULL,
        transportador_id BIGINT NULL,
        transportador_nome VARCHAR(255) NULL,
        contratante_id BIGINT NULL,
        contratante_nome VARCHAR(255) NULL,
        motorista_id BIGINT NULL,
        motorista_nome VARCHAR(255) NULL,
        dt_chegada DATE NULL,
        hr_chegada TIME NULL,
        dt_saida DATE NULL,
        hr_saida TIME NULL,
        placa VARCHAR(10) NULL,
        equipamento_id BIGINT NULL,
        equipamento_nome VARCHAR(255) NULL,
        viagem VARCHAR(255) NULL,
        dt_inicio DATE NULL,
        dt_fim DATE NULL,
        km_inicial NUMERIC(29, 6) NOT NULL DEFAULT 0,
        km_final NUMERIC(29, 6) NOT NULL DEFAULT 0,
        km_total NUMERIC(29, 6) NOT NULL DEFAULT 0,
        observacao TEXT NULL,
        peso_bruto NUMERIC(29, 6) NOT NULL DEFAULT 0,
        peso_tara NUMERIC(29, 6) NOT NULL DEFAULT 0,
        peso_liquido NUMERIC(29, 6) NOT NULL DEFAULT 0,
        operacao VARCHAR(128) NULL
      )
    `);
    await client.query(`CREATE TABLE IF NOT EXISTS ${DOC_TABLE} (id BIGSERIAL PRIMARY KEY, pesagem_id BIGINT NOT NULL REFERENCES ${PESAGEM_TABLE}(id) ON DELETE CASCADE, documento VARCHAR(128) NOT NULL, created_on TIMESTAMPTZ NOT NULL DEFAULT now(), updated_on TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${ATRASO_TABLE} (id BIGSERIAL PRIMARY KEY, pesagem_id BIGINT NOT NULL REFERENCES ${PESAGEM_TABLE}(id) ON DELETE CASCADE, motivo VARCHAR(4000) NOT NULL, tempo_minutos INTEGER NOT NULL DEFAULT 0, created_on TIMESTAMPTZ NOT NULL DEFAULT now(), updated_on TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${ESPERA_TABLE} (id BIGSERIAL PRIMARY KEY, pesagem_id BIGINT NOT NULL REFERENCES ${PESAGEM_TABLE}(id) ON DELETE CASCADE, motivo VARCHAR(4000) NOT NULL, tempo_minutos INTEGER NOT NULL DEFAULT 0, created_on TIMESTAMPTZ NOT NULL DEFAULT now(), updated_on TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${CALENDARIO_TABLE} (id BIGSERIAL PRIMARY KEY, pesagem_id BIGINT NOT NULL REFERENCES ${PESAGEM_TABLE}(id) ON DELETE CASCADE, dt DATE NOT NULL, dia VARCHAR(32) NULL, feriado BOOLEAN NOT NULL DEFAULT false, pago BOOLEAN NOT NULL DEFAULT false, vl NUMERIC(28, 6) NOT NULL DEFAULT 0, created_on TIMESTAMPTZ NOT NULL DEFAULT now(), updated_on TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${GTA_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        pesagem_id BIGINT NOT NULL REFERENCES ${PESAGEM_TABLE}(id) ON DELETE CASCADE,
        gta VARCHAR(128) NULL,
        qtd_machos INTEGER NOT NULL DEFAULT 0,
        qtd_femeas INTEGER NOT NULL DEFAULT 0,
        qtd_total INTEGER NOT NULL DEFAULT 0,
        created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_on TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${CLASSIFICACAO_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        pesagem_id BIGINT NOT NULL REFERENCES ${PESAGEM_TABLE}(id) ON DELETE CASCADE,
        tipo_analise VARCHAR(255) NULL,
        vl_encontrado NUMERIC(29, 6) NOT NULL DEFAULT 0,
        peso_desconto NUMERIC(29, 6) NOT NULL DEFAULT 0,
        unidade VARCHAR(64) NULL,
        created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_on TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${FECHAMENTO_TABLE} (
        pesagem_id BIGINT PRIMARY KEY REFERENCES ${PESAGEM_TABLE}(id) ON DELETE CASCADE,
        tabela_frete VARCHAR(64) NULL,
        calculo_frete VARCHAR(64) NULL,
        periodo_producao_agricola VARCHAR(128) NULL,
        talhao VARCHAR(128) NULL,
        peso_secador NUMERIC(29, 6) NOT NULL DEFAULT 0,
        peso_desconto_classificado NUMERIC(29, 6) NOT NULL DEFAULT 0,
        peso_liquido_desconto NUMERIC(29, 6) NOT NULL DEFAULT 0,
        peso_nota_fiscal NUMERIC(29, 6) NOT NULL DEFAULT 0,
        peso_origem NUMERIC(29, 6) NOT NULL DEFAULT 0,
        numero_laudo VARCHAR(128) NULL,
        armazenagem_silo VARCHAR(255) NULL,
        unidade_medida_frete VARCHAR(64) NULL,
        vl_unitario_frete NUMERIC(29, 6) NOT NULL DEFAULT 0,
        vl_combustivel NUMERIC(29, 6) NOT NULL DEFAULT 0,
        vl_pedagio NUMERIC(29, 6) NOT NULL DEFAULT 0,
        outras_despesas NUMERIC(29, 6) NOT NULL DEFAULT 0,
        litragem NUMERIC(29, 6) NOT NULL DEFAULT 0,
        vl_comb_litro NUMERIC(29, 6) NOT NULL DEFAULT 0,
        vl_diaria NUMERIC(29, 6) NOT NULL DEFAULT 0,
        vl_comissao NUMERIC(29, 6) NOT NULL DEFAULT 0,
        vl_frete NUMERIC(29, 6) NOT NULL DEFAULT 0,
        pesagem_origem VARCHAR(64) NULL,
        dt_vencimento DATE NULL,
        qtd_animais INTEGER NOT NULL DEFAULT 0,
        qtd_animais_origem INTEGER NOT NULL DEFAULT 0,
        mapa_pesagem VARCHAR(128) NULL,
        cte VARCHAR(64) NULL,
        nf_externa VARCHAR(64) NULL,
        created_on TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_on TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS periodo_producao_agricola VARCHAR(128) NULL`);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS talhao VARCHAR(128) NULL`);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS peso_secador NUMERIC(29, 6) NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS peso_desconto_classificado NUMERIC(29, 6) NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS peso_liquido_desconto NUMERIC(29, 6) NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS peso_nota_fiscal NUMERIC(29, 6) NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS peso_origem NUMERIC(29, 6) NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS numero_laudo VARCHAR(128) NULL`);
    await client.query(`ALTER TABLE ${FECHAMENTO_TABLE} ADD COLUMN IF NOT EXISTS armazenagem_silo VARCHAR(255) NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pesagem_veiculo_tipo_status_id ON ${PESAGEM_TABLE}(tipo, status, id DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pesagem_veiculo_numero ON ${PESAGEM_TABLE}(numero)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pesagem_veiculo_classificacao_pesagem_id ON ${CLASSIFICACAO_TABLE}(pesagem_id, id DESC)`);
    await client.query("COMMIT");
    pesagemSchemaEnsured = true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function mapFechamentoRow(row: Record<string, unknown> | undefined): PesagemFechamento {
  if (!row) {
    return {
      tabelaFrete: null,
      calculoFrete: null,
      periodoProducaoAgricola: null,
      talhao: null,
      pesoSecador: 0,
      pesoDescontoClassificado: 0,
      pesoLiquidoDesconto: 0,
      pesoNotaFiscal: 0,
      pesoOrigem: 0,
      numeroLaudo: null,
      armazenagemSilo: null,
      unidadeMedidaFrete: null,
      valorUnitarioFrete: 0,
      valorCombustivel: 0,
      valorPedagio: 0,
      outrasDespesas: 0,
      litragem: 0,
      valorCombLitro: 0,
      valorDiaria: 0,
      valorComissao: 0,
      valorFrete: 0,
      pesagemOrigem: null,
      dataVencimento: null,
      qtdAnimais: 0,
      qtdAnimaisOrigem: 0,
      mapaPesagem: null,
      cte: null,
      nfExterna: null,
    };
  }

  return {
    tabelaFrete: toNullableString(row.tabela_frete),
    calculoFrete: toNullableString(row.calculo_frete),
    periodoProducaoAgricola: toNullableString(row.periodo_producao_agricola),
    talhao: toNullableString(row.talhao),
    pesoSecador: toDecimal(row.peso_secador),
    pesoDescontoClassificado: toDecimal(row.peso_desconto_classificado),
    pesoLiquidoDesconto: toDecimal(row.peso_liquido_desconto),
    pesoNotaFiscal: toDecimal(row.peso_nota_fiscal),
    pesoOrigem: toDecimal(row.peso_origem),
    numeroLaudo: toNullableString(row.numero_laudo),
    armazenagemSilo: toNullableString(row.armazenagem_silo),
    unidadeMedidaFrete: toNullableString(row.unidade_medida_frete),
    valorUnitarioFrete: toDecimal(row.vl_unitario_frete),
    valorCombustivel: toDecimal(row.vl_combustivel),
    valorPedagio: toDecimal(row.vl_pedagio),
    outrasDespesas: toDecimal(row.outras_despesas),
    litragem: toDecimal(row.litragem),
    valorCombLitro: toDecimal(row.vl_comb_litro),
    valorDiaria: toDecimal(row.vl_diaria),
    valorComissao: toDecimal(row.vl_comissao),
    valorFrete: toDecimal(row.vl_frete),
    pesagemOrigem: toNullableString(row.pesagem_origem),
    dataVencimento: toDateOnlyString(row.dt_vencimento),
    qtdAnimais: toInteger(row.qtd_animais),
    qtdAnimaisOrigem: toInteger(row.qtd_animais_origem),
    mapaPesagem: toNullableString(row.mapa_pesagem),
    cte: toNullableString(row.cte),
    nfExterna: toNullableString(row.nf_externa),
  };
}

async function hasTable(pool: Pool, relation: string): Promise<boolean> {
  if (tableExistsCache.has(relation)) return tableExistsCache.get(relation) ?? false;
  const result = await pool.query<{ relation: string | null }>("SELECT to_regclass($1) AS relation", [relation]);
  const exists = result.rows[0]?.relation !== null;
  tableExistsCache.set(relation, exists);
  return exists;
}

function normalizeStatus(value: unknown): PesagemStatus {
  const normalized = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "_");
  if (normalized === "peso_finalizado") return "peso_finalizado";
  if (normalized === "fechado") return "fechado";
  if (normalized === "cancelado") return "cancelado";
  if (validStatuses.has(normalized as PesagemStatus)) return normalized as PesagemStatus;
  return "disponivel";
}

function normalizeTipo(value: unknown): PesagemTipo {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (normalized === "entrada_insumos") return "entrada_insumos";
  return "entrada_insumos";
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

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
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
  if (/^\d{2}:\d{2}$/.test(text)) return `${text}:00`;
  const match = text.match(/^(\d{2}:\d{2}:\d{2})/);
  return match?.[1] ?? null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").toLowerCase().trim();
  return normalized === "1" || normalized === "true" || normalized === "t" || normalized === "sim";
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNullableString(value: unknown): string | null {
  const text = toText(value);
  return text.length === 0 ? null : text;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDecimal(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}


