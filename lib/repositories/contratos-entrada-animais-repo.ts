import type { Pool, PoolClient } from "pg";
import { getPgPool } from "@/lib/db";
import type {
  ContratoCustosResumoInput,
  ContratoDadosGeraisInput,
  ContratoEmpresaSapInput,
  ContratoEntradaAnimaisCreateInput,
  ContratoEntradaAnimaisStatusChangeInput,
  ContratoEntradaAnimaisUpdateInput,
  ContratoLinhaPayload,
  ContratoOutrosInput,
  ContratoParceiroSapInput,
  ContratoStatus,
} from "@/lib/types/contrato";

type ListFilters = {
  status?: ContratoStatus | null;
  exercicio?: number | null;
  search?: string | null;
  page: number;
  pageSize: number;
};

type Queryable = Pool | PoolClient;
type JsonObject = Record<string, unknown>;
type MetadataPayload = {
  dadosGerais?: ContratoDadosGeraisInput | null;
  outros?: ContratoOutrosInput | null;
  mapas?: ContratoLinhaPayload[] | null;
  custosCategorias?: ContratoLinhaPayload[] | null;
  comissionadoId?: number | null;
  comissionadoSap?: ContratoParceiroSapInput | null;
  emissorNotaId?: number | null;
  clausulaModeloId?: number | null;
  clausulaTitulo?: string | null;
  empresaSap?: ContratoEmpresaSapInput | null;
  parceiroSap?: ContratoParceiroSapInput | null;
};

const tableExistsCache = new Map<string, boolean>();
let snapshotColumnsEnsured = false;
let itemSnapshotColumnsEnsured = false;
let custosColumnsEnsured = false;
const ENTRADA_ANIMAIS_WHERE = "lower(coalesce(c.tp_contrato, '')) = 'entrada_animais'";
const OBS_META_MARKER = "\n\n/*CS_META*/";

const NORMALIZED_STATUS_SQL = `
  CASE
    WHEN lower(coalesce(c.status, '')) IN ('aguardando_aprovacao', 'aguardando aprovacao', 'aguardando aprovação') THEN 'aguardando_aprovacao'
    WHEN lower(coalesce(c.status, '')) IN ('ativo') THEN 'ativo'
    WHEN lower(coalesce(c.status, '')) IN ('contendo_parc', 'contendo parc', 'contendo parc.', 'conferido parc', 'conferido parc.', 'conferido parcialmente') THEN 'contendo_parc'
    WHEN lower(coalesce(c.status, '')) IN ('encerrado') THEN 'encerrado'
    WHEN lower(coalesce(c.status, '')) IN ('inativo_cancelado', 'inativo/cancelado', 'inativo cancelado') THEN 'inativo_cancelado'
    ELSE 'aguardando_aprovacao'
  END
`;

export async function listContratosEntradaAnimais(filters: ListFilters) {
  const pool = getPgPool();
  await assertContratoTable(pool);

  const status = filters.status ?? null;
  const exercicio = filters.exercicio ?? null;
  const search = filters.search?.trim() ? filters.search.trim() : null;
  const offset = (filters.page - 1) * filters.pageSize;

  const withParceiro = await hasTable(pool, "dbo.res_partner");
  const withContratoItem = await hasTable(pool, "contrato.contrato_item");
  const withContratoPrevisao = await hasTable(pool, "contrato.contrato_previsao");
  const parceiroJoin = withParceiro ? "LEFT JOIN dbo.res_partner p ON p.id = c.parceiro_id" : "";
  const parceiroSelect = withParceiro
    ? "trim(BOTH ' - ' FROM concat_ws(' - ', coalesce(to_jsonb(p)->>'codigo', to_jsonb(p)->>'ref', c.parceiro_codigo_snapshot), coalesce(to_jsonb(p)->>'nome', to_jsonb(p)->>'name', c.parceiro_nome_snapshot), coalesce(to_jsonb(p)->>'documento', to_jsonb(p)->>'cnpj_cpf', to_jsonb(p)->>'vat', c.parceiro_documento_snapshot))) AS parceiro"
    : "trim(BOTH ' - ' FROM concat_ws(' - ', c.parceiro_codigo_snapshot, c.parceiro_nome_snapshot, c.parceiro_documento_snapshot)) AS parceiro";
  const valorTotalItensSelect = withContratoItem
    ? "coalesce((SELECT sum(coalesce(ci.vl_total, 0)) FROM contrato.contrato_item ci WHERE ci.contrato_id = c.id), 0) AS \"valorTotalItens\""
    : "0::numeric AS \"valorTotalItens\"";
  const temMapaSelect = withContratoPrevisao
    ? "EXISTS(SELECT 1 FROM contrato.contrato_previsao cp WHERE cp.contrato_id = c.id) AS \"temMapa\""
    : "false AS \"temMapa\"";
  const parceiroSearch = withParceiro
    ? "OR coalesce(to_jsonb(p)->>'nome', to_jsonb(p)->>'name', '') ILIKE '%' || $3 || '%' OR coalesce(to_jsonb(p)->>'codigo', to_jsonb(p)->>'ref', '') ILIKE '%' || $3 || '%' OR coalesce(to_jsonb(p)->>'documento', to_jsonb(p)->>'cnpj_cpf', to_jsonb(p)->>'vat', '') ILIKE '%' || $3 || '%'"
    : "";

  const [countResult, rowsResult] = await Promise.all([
    pool.query<{ total: string }>(
      `
      SELECT count(*)::text AS total
      FROM contrato.contrato c
      ${parceiroJoin}
      WHERE ${ENTRADA_ANIMAIS_WHERE}
        AND ($1::text IS NULL OR ${NORMALIZED_STATUS_SQL} = $1)
        AND ($2::integer IS NULL OR c.ano = $2)
        AND (
          $3::text IS NULL
          OR coalesce(c.descricao, '') ILIKE '%' || $3 || '%'
          OR coalesce(c.numero::text, '') ILIKE '%' || $3 || '%'
          OR coalesce(c.observacao, '') ILIKE '%' || $3 || '%'
          ${parceiroSearch}
        )
      `,
      [status, exercicio, search],
    ),
    pool.query(
      `
      SELECT
        c.ano AS exercicio,
        c.id,
        coalesce(c.descricao, '') AS "referenciaContrato",
        coalesce(c.numero::text, '') AS "numero",
        c.ref_object_id AS "refObjectId",
        ${parceiroSelect},
        ${NORMALIZED_STATUS_SQL} AS status,
        coalesce(c.tp_contrato, 'entrada_animais') AS "tipoContrato",
        c.dt_inicio AS "inicioEm",
        ${valorTotalItensSelect},
        ${temMapaSelect},
        c.observacao AS "_observacao"
      FROM contrato.contrato c
      ${parceiroJoin}
      WHERE ${ENTRADA_ANIMAIS_WHERE}
        AND ($1::text IS NULL OR ${NORMALIZED_STATUS_SQL} = $1)
        AND ($2::integer IS NULL OR c.ano = $2)
        AND (
          $3::text IS NULL
          OR coalesce(c.descricao, '') ILIKE '%' || $3 || '%'
          OR coalesce(c.numero::text, '') ILIKE '%' || $3 || '%'
          OR coalesce(c.observacao, '') ILIKE '%' || $3 || '%'
          ${parceiroSearch}
        )
      ORDER BY c.ano DESC, c.id DESC
      LIMIT $4 OFFSET $5
      `,
      [status, exercicio, search, filters.pageSize, offset],
    ),
  ]);

  return {
    items: rowsResult.rows.map((row) => {
      const observacao = toNullableString(row._observacao);
      const parceiroFallback = readParceiroDisplayFromMeta(observacao);
      return {
        ...row,
        parceiro: toNullableString(row.parceiro) ?? parceiroFallback ?? null,
        status: normalizeStatus(row.status),
        valorTotalItens: toNumber(row.valorTotalItens),
        temMapa: Boolean(row.temMapa),
      };
    }),
    total: Number.parseInt(countResult.rows[0]?.total ?? "0", 10),
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getContratoEntradaAnimaisById(id: number) {
  const pool = getPgPool();
  await assertContratoTable(pool);

  const withEmpresa = await hasTable(pool, "dbo.res_company");
  const withParceiro = await hasTable(pool, "dbo.res_partner");

  const empresaSelect = withEmpresa
    ? "coalesce(to_jsonb(e)->>'codigo', to_jsonb(e)->>'ref', c.empresa_codigo_snapshot) AS empresa_codigo, coalesce(to_jsonb(e)->>'nome', to_jsonb(e)->>'name', c.empresa_nome_snapshot) AS empresa_nome, coalesce(to_jsonb(e)->>'cnpj', to_jsonb(e)->>'cnpj_cpf', to_jsonb(e)->>'vat', c.empresa_cnpj_snapshot) AS empresa_cnpj,"
    : "";
  const empresaJoin = withEmpresa ? "LEFT JOIN dbo.res_company e ON e.partner_ptr_id = c.empresa_id" : "";
  const parceiroSelect = withParceiro
    ? "coalesce(to_jsonb(p)->>'codigo', to_jsonb(p)->>'ref', c.parceiro_codigo_snapshot) AS parceiro_codigo_base, coalesce(to_jsonb(p)->>'nome', to_jsonb(p)->>'name', c.parceiro_nome_snapshot) AS parceiro_nome_base, coalesce(to_jsonb(p)->>'documento', to_jsonb(p)->>'cnpj_cpf', to_jsonb(p)->>'vat', c.parceiro_documento_snapshot) AS parceiro_documento_base,"
    : "";
  const parceiroJoin = withParceiro ? "LEFT JOIN dbo.res_partner p ON p.id = c.parceiro_id" : "";

  const contratoResult = await pool.query<JsonObject>(
    `
    SELECT
      c.*,
      ${empresaSelect}
      ${parceiroSelect}
      1 AS _keep_select_valid
    FROM contrato.contrato c
    ${empresaJoin}
    ${parceiroJoin}
    WHERE c.id = $1
      AND ${ENTRADA_ANIMAIS_WHERE}
    `,
    [id],
  );

  if ((contratoResult.rowCount ?? 0) === 0) return null;

  const contrato = { ...contratoResult.rows[0] };
  delete contrato._keep_select_valid;

  const observacaoParsed = splitObservacoesAndMeta(toNullableString(contrato.observacao));
  const metadata = observacaoParsed.meta;
  contrato.observacao = observacaoParsed.text;
  const empresaSap = readEmpresaSapFromMeta(metadata);
  const parceiroSap = readParceiroSapFromMeta(metadata);
  if (empresaSap?.nome) {
    contrato.empresa_nome = toNullableString(contrato.empresa_nome) ?? toNullableString(contrato.empresa_nome_snapshot) ?? empresaSap.nome;
    contrato.empresa_codigo = toNullableString(contrato.empresa_codigo) ?? toNullableString(contrato.empresa_codigo_snapshot) ?? empresaSap.codigo;
    (contrato as Record<string, unknown>).empresa_cnpj =
      toNullableString((contrato as Record<string, unknown>).empresa_cnpj) ?? toNullableString((contrato as Record<string, unknown>).empresa_cnpj_snapshot) ?? empresaSap.cnpj;
    (contrato as Record<string, unknown>).empresa_ie = toNullableString((contrato as Record<string, unknown>).empresa_ie) ?? empresaSap.rgIe ?? null;
    (contrato as Record<string, unknown>).empresa_telefone = toNullableString((contrato as Record<string, unknown>).empresa_telefone) ?? empresaSap.telefone ?? null;
    (contrato as Record<string, unknown>).empresa_email = toNullableString((contrato as Record<string, unknown>).empresa_email) ?? empresaSap.email ?? null;
    (contrato as Record<string, unknown>).empresa_endereco = toNullableString((contrato as Record<string, unknown>).empresa_endereco) ?? empresaSap.endereco ?? null;
  }
  if (parceiroSap?.nome) {
    contrato.parceiro_nome_base = toNullableString(contrato.parceiro_nome_base) ?? toNullableString(contrato.parceiro_nome_snapshot) ?? parceiroSap.nome;
    contrato.parceiro_codigo_base = toNullableString(contrato.parceiro_codigo_base) ?? toNullableString(contrato.parceiro_codigo_snapshot) ?? parceiroSap.codigo;
    contrato.parceiro_documento_base = toNullableString(contrato.parceiro_documento_base) ?? toNullableString(contrato.parceiro_documento_snapshot) ?? parceiroSap.documento;
    (contrato as Record<string, unknown>).parceiro_ie = toNullableString((contrato as Record<string, unknown>).parceiro_ie) ?? parceiroSap.rgIe ?? null;
    (contrato as Record<string, unknown>).parceiro_telefone = toNullableString((contrato as Record<string, unknown>).parceiro_telefone) ?? parceiroSap.telefone ?? null;
    (contrato as Record<string, unknown>).parceiro_email = toNullableString((contrato as Record<string, unknown>).parceiro_email) ?? parceiroSap.email ?? null;
    (contrato as Record<string, unknown>).parceiro_endereco = toNullableString((contrato as Record<string, unknown>).parceiro_endereco) ?? parceiroSap.endereco ?? null;
  }

  const [itensRows, fretesRows, financeiroRows, notasRows, clausulasRows, previsoesRows] = await Promise.all([
    selectRowsIfTableExists(pool, "contrato.contrato_item", "SELECT * FROM contrato.contrato_item WHERE contrato_id = $1 ORDER BY id ASC", [id]),
    selectRowsIfTableExists(pool, "contrato.transportador", "SELECT * FROM contrato.transportador WHERE contrato_id = $1 ORDER BY id ASC", [id]),
    selectRowsIfTableExists(pool, "contrato.financeiro", "SELECT * FROM contrato.financeiro WHERE contrato_id = $1 ORDER BY dt ASC, id ASC", [id]),
    selectRowsIfTableExists(pool, "contrato.contrato_nf", "SELECT * FROM contrato.contrato_nf WHERE contrato_id = $1 ORDER BY id DESC", [id]),
    selectRowsIfTableExists(pool, "contrato.clausula_contrato", "SELECT * FROM contrato.clausula_contrato WHERE contrato_id = $1 ORDER BY id ASC", [id]),
    selectRowsIfTableExists(pool, "contrato.contrato_previsao", "SELECT * FROM contrato.contrato_previsao WHERE contrato_id = $1 ORDER BY dt_inicio ASC, id ASC", [id]),
  ]);

  const splitPrevisoes = splitPrevisoesAndMapas(previsoesRows);

  return {
    contrato: {
      ...contrato,
      status: normalizeStatus(contrato.status),
      dadosGerais: readDadosGeraisFromMeta(metadata),
      outros: readOutrosFromMeta(metadata),
      custosResumo: readCustosResumoFromContrato(contrato),
      comissionadoId: toNullableInteger(metadata?.comissionadoId),
      comissionadoSap: readComissionadoSapFromMeta(metadata),
      emissorNotaId: toNullableInteger(metadata?.emissorNotaId),
      clausulaModeloId: toNullableInteger(contrato.clausula_id) ?? toNullableInteger(metadata?.clausulaModeloId),
      clausulaTitulo: toNullableString(contrato.titulo_clausula) ?? toNullableString(metadata?.clausulaTitulo),
    },
    itens: itensRows.map(mapItemRowToPayload),
    fretes: fretesRows.map(mapFreteRowToPayload),
    financeiro: financeiroRows.map(mapFinanceiroRowToPayload),
    notas: notasRows.map(mapNotaRowToPayload),
    clausulas: clausulasRows.map(mapClausulaRowToPayload),
    previsoes: splitPrevisoes.previsoes,
    movimentos: [],
    sapLogs: [],
    pedidos: [],
    statusHistorico: [],
    mapas: readMapasFromMeta(metadata) ?? splitPrevisoes.mapas,
    custos: readCustosCategoriasFromMeta(metadata) ?? [],
  };
}
export async function createContratoEntradaAnimais(input: ContratoEntradaAnimaisCreateInput) {
  const pool = getPgPool();
  await assertContratoTable(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exercicio = input.exercicio ?? new Date().getFullYear();
    const numero = input.numero ?? (await getNextNumeroContrato(client, input.empresaId ?? null, exercicio));
    await resolveParceiroSnapshot(client, input.parceiroId);
    const empresaSnapshot = normalizeEmpresaSnapshot(input.empresaSap ?? null);
    const parceiroSnapshot = normalizeParceiroSnapshot(input.parceiroSap ?? null);

    const metadata: MetadataPayload = {
      dadosGerais: input.dadosGerais ?? null,
      outros: input.outros ?? null,
      mapas: input.mapas ?? null,
      custosCategorias: input.custosCategorias ?? null,
      comissionadoId: input.comissionadoId ?? null,
      comissionadoSap: input.comissionadoSap ?? null,
      emissorNotaId: input.emissorNotaId ?? null,
      clausulaModeloId: input.clausulaModeloId ?? null,
      clausulaTitulo: toNullableString(input.clausulaTitulo),
      empresaSap: input.empresaSap ?? null,
      parceiroSap: input.parceiroSap ?? null,
    };

    const observacoes = composeObservacoesWithMeta(input.observacoes ?? null, metadata);

    const insertResult = await client.query<{ id: number }>(
      `
      INSERT INTO contrato.contrato (
        created_on,
        updated_on,
        ano,
        numero,
        descricao,
        ref_object_id,
        status,
        empresa_id,
        parceiro_id,
        empresa_codigo_snapshot,
        empresa_nome_snapshot,
        empresa_cnpj_snapshot,
        parceiro_codigo_snapshot,
        parceiro_nome_snapshot,
        parceiro_documento_snapshot,
        tp_contrato,
        dt_assinatura,
        prazo_entrega,
        dt_inicio,
        dt_vencimento,
        contrato_cedente_id,
        contrato_anterior_id,
        vl,
        vl_mao_obra,
        frete,
        calculo_frete,
        vl_unit_frete,
        emissor_nota,
        assinatura_parceiro,
        assinatura_empresa,
        comissionado_id,
        vl_comissao,
        responsavel_juridico,
        testemunha,
        cpf_testemunha,
        testemunha2,
        cpf_testemunha2,
        objeto,
        execucao,
        observacao,
        permuta,
        aditivo,
        b1_vl_pago
      )
      VALUES (
        now(), now(),
        $1, $2, $3, $4, 'aguardando_aprovacao',
        $5, $6, $7, $8, $9, $10, $11, $12, 'entrada_animais',
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34, $35, $36,
        false, false, $37
      )
      RETURNING id
      `,
      [
        exercicio,
        String(numero),
        input.referenciaContrato.trim(),
        input.refObjectId ?? null,
        input.empresaId ?? null,
        input.parceiroId ?? null,
        empresaSnapshot?.codigo ?? null,
        empresaSnapshot?.nome ?? null,
        empresaSnapshot?.cnpj ?? null,
        parceiroSnapshot?.codigo ?? null,
        parceiroSnapshot?.nome ?? null,
        parceiroSnapshot?.documento ?? null,
        normalizeDateInput(input.assinaturaEm),
        normalizeDateInput(input.prazoEntregaEm),
        normalizeDateInput(input.inicioEm),
        normalizeDateInput(input.vencimentoEm),
        input.contratoCedenteId ?? null,
        input.contratoAnteriorId ?? null,
        input.valor ?? 0,
        input.valorMaoObra ?? 0,
        input.responsavelFrete ?? "empresa",
        input.calculoFrete ?? "km_rodado",
        input.valorUnitarioFrete ?? 0,
        input.emissorNotaId ? "parceiro" : input.emissorNota ?? "empresa",
        input.assinaturaParceiro ?? null,
        input.assinaturaEmpresa ?? null,
        input.comissionadoId ?? null,
        input.valorComissao ?? 0,
        input.responsavelJuridicoNome ?? null,
        input.testemunha1Nome ?? null,
        input.testemunha1Cpf ?? null,
        input.testemunha2Nome ?? null,
        input.testemunha2Cpf ?? null,
        input.objeto ?? null,
        input.execucao ?? null,
        observacoes,
        input.sapValorPago ?? 0,
      ],
    );

    const contratoId = insertResult.rows[0].id;
    if (input.custosResumo !== undefined) {
      await updateContratoCustosResumo(client, contratoId, input.custosResumo);
    }

    await replaceContratoItens(client, contratoId, input.itens);
    await replaceContratoFretes(client, contratoId, input.fretes);
    await replaceContratoFinanceiro(client, contratoId, input.financeiros);
    await replaceContratoNotas(client, contratoId, input.notas);
    await replaceContratoClausulas(client, contratoId, input.clausulas);
    await replaceContratoPrevisoes(client, contratoId, input.previsoes, input.mapas);

    await client.query("COMMIT");
    return await getContratoEntradaAnimaisById(contratoId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateContratoEntradaAnimais(id: number, input: ContratoEntradaAnimaisUpdateInput) {
  const pool = getPgPool();
  await assertContratoTable(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lockResult = await client.query<{ observacao: string | null }>(
      `
      SELECT observacao
      FROM contrato.contrato c
      WHERE c.id = $1
        AND ${ENTRADA_ANIMAIS_WHERE}
      FOR UPDATE
      `,
      [id],
    );

    if ((lockResult.rowCount ?? 0) === 0) throw new Error("Contrato nao encontrado.");

    const setClauses: string[] = [];
    const values: unknown[] = [];
    function pushSet(column: string, value: unknown) {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    }

    pushSet("updated_on", new Date());

    if (input.parceiroId !== undefined) {
      await resolveParceiroSnapshot(client, input.parceiroId);
      pushSet("parceiro_id", input.parceiroId ?? null);
    }
    if (input.empresaId !== undefined) {
      pushSet("empresa_id", input.empresaId ?? null);
    }

    mapUpdateField(input.referenciaContrato, "descricao", pushSet, (v) => String(v).trim());
    mapUpdateField(input.refObjectId, "ref_object_id", pushSet);
    mapUpdateField(input.assinaturaEm, "dt_assinatura", pushSet, normalizeDateInput);
    mapUpdateField(input.prazoEntregaEm, "prazo_entrega", pushSet, normalizeDateInput);
    mapUpdateField(input.inicioEm, "dt_inicio", pushSet, normalizeDateInput);
    mapUpdateField(input.vencimentoEm, "dt_vencimento", pushSet, normalizeDateInput);

    pushSet("permuta", false);
    pushSet("contrato_permuta_id", null);
    pushSet("aditivo", false);
    pushSet("tp_aditivo_id", null);

    mapUpdateField(input.contratoCedenteId, "contrato_cedente_id", pushSet);
    mapUpdateField(input.contratoAnteriorId, "contrato_anterior_id", pushSet);
    mapUpdateField(input.valor, "vl", pushSet);
    mapUpdateField(input.valorMaoObra, "vl_mao_obra", pushSet);
    mapUpdateField(input.responsavelFrete, "frete", pushSet);
    mapUpdateField(input.calculoFrete, "calculo_frete", pushSet);
    mapUpdateField(input.valorUnitarioFrete, "vl_unit_frete", pushSet);

    if (input.emissorNotaId !== undefined) {
      pushSet("emissor_nota", input.emissorNotaId ? "parceiro" : "empresa");
    } else {
      mapUpdateField(input.emissorNota, "emissor_nota", pushSet);
    }

    if (input.comissionadoId !== undefined) pushSet("comissionado_id", input.comissionadoId ?? null);
    if (input.empresaSap !== undefined) {
      const empresaSnapshot = normalizeEmpresaSnapshot(input.empresaSap);
      pushSet("empresa_codigo_snapshot", empresaSnapshot?.codigo ?? null);
      pushSet("empresa_nome_snapshot", empresaSnapshot?.nome ?? null);
      pushSet("empresa_cnpj_snapshot", empresaSnapshot?.cnpj ?? null);
    }
    if (input.parceiroSap !== undefined) {
      const parceiroSnapshot = normalizeParceiroSnapshot(input.parceiroSap);
      pushSet("parceiro_codigo_snapshot", parceiroSnapshot?.codigo ?? null);
      pushSet("parceiro_nome_snapshot", parceiroSnapshot?.nome ?? null);
      pushSet("parceiro_documento_snapshot", parceiroSnapshot?.documento ?? null);
    }
    applyCustosResumoToSetClauses(input.custosResumo, pushSet);

    mapUpdateField(input.assinaturaParceiro, "assinatura_parceiro", pushSet);
    mapUpdateField(input.assinaturaEmpresa, "assinatura_empresa", pushSet);
    mapUpdateField(input.valorComissao, "vl_comissao", pushSet);
    mapUpdateField(input.responsavelJuridicoNome, "responsavel_juridico", pushSet);
    mapUpdateField(input.testemunha1Nome, "testemunha", pushSet);
    mapUpdateField(input.testemunha1Cpf, "cpf_testemunha", pushSet);
    mapUpdateField(input.testemunha2Nome, "testemunha2", pushSet);
    mapUpdateField(input.testemunha2Cpf, "cpf_testemunha2", pushSet);
    mapUpdateField(input.objeto, "objeto", pushSet);
    mapUpdateField(input.execucao, "execucao", pushSet);
    if (input.sapValorPago !== undefined) pushSet("b1_vl_pago", input.sapValorPago ?? 0);

    const currentObs = splitObservacoesAndMeta(lockResult.rows[0].observacao);
    const nextMeta = mergeMetadata(currentObs.meta, {
      dadosGerais: input.dadosGerais,
      outros: input.outros,
      mapas: input.mapas,
      custosCategorias: input.custosCategorias,
      comissionadoId: input.comissionadoId,
      comissionadoSap: input.comissionadoSap,
      emissorNotaId: input.emissorNotaId,
      clausulaModeloId: input.clausulaModeloId,
      clausulaTitulo: input.clausulaTitulo,
      empresaSap: input.empresaSap,
      parceiroSap: input.parceiroSap,
    });

    const metadataChanged =
      input.dadosGerais !== undefined ||
      input.outros !== undefined ||
      input.mapas !== undefined ||
      input.custosCategorias !== undefined ||
      input.comissionadoId !== undefined ||
      input.comissionadoSap !== undefined ||
      input.emissorNotaId !== undefined ||
      input.clausulaModeloId !== undefined ||
      input.clausulaTitulo !== undefined ||
      input.empresaSap !== undefined ||
      input.parceiroSap !== undefined;

    if (input.observacoes !== undefined || metadataChanged) {
      const baseObs = input.observacoes !== undefined ? input.observacoes : currentObs.text;
      pushSet("observacao", composeObservacoesWithMeta(baseObs ?? null, nextMeta));
    }

    const hasCollectionUpdates =
      input.itens !== undefined ||
      input.fretes !== undefined ||
      input.financeiros !== undefined ||
      input.notas !== undefined ||
      input.clausulas !== undefined ||
      input.previsoes !== undefined ||
      input.mapas !== undefined;

    if (setClauses.length === 0 && !hasCollectionUpdates) throw new Error("Nenhum campo informado para atualizacao.");

    if (setClauses.length > 0) {
      values.push(id);
      const idPlaceholder = `$${values.length}`;
      const updateResult = await client.query<{ id: number }>(
        `
        UPDATE contrato.contrato c
        SET ${setClauses.join(", ")}
        WHERE c.id = ${idPlaceholder}
          AND ${ENTRADA_ANIMAIS_WHERE}
        RETURNING c.id
        `,
        values,
      );

      if ((updateResult.rowCount ?? 0) === 0) throw new Error("Contrato nao encontrado.");
    }

    if (input.itens !== undefined) await replaceContratoItens(client, id, input.itens);
    if (input.fretes !== undefined) await replaceContratoFretes(client, id, input.fretes);
    if (input.financeiros !== undefined) await replaceContratoFinanceiro(client, id, input.financeiros);
    if (input.notas !== undefined) await replaceContratoNotas(client, id, input.notas);
    if (input.clausulas !== undefined) await replaceContratoClausulas(client, id, input.clausulas);
    if (input.previsoes !== undefined || input.mapas !== undefined) {
      await replaceContratoPrevisoes(client, id, input.previsoes ?? [], input.mapas ?? []);
    }

    await client.query("COMMIT");
    return await getContratoEntradaAnimaisById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function changeContratoEntradaAnimaisStatus(id: number, input: ContratoEntradaAnimaisStatusChangeInput) {
  const pool = getPgPool();
  await assertContratoTable(pool);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const contratoResult = await client.query<{ status: string | null }>(
      `
      SELECT c.status
      FROM contrato.contrato c
      WHERE c.id = $1
        AND ${ENTRADA_ANIMAIS_WHERE}
      FOR UPDATE
      `,
      [id],
    );

    if ((contratoResult.rowCount ?? 0) === 0) throw new Error("Contrato nao encontrado.");

    const statusAnterior = normalizeStatus(contratoResult.rows[0].status);
    const statusNovo = normalizeStatus(input.status);

    if (statusAnterior !== statusNovo) {
      await client.query(
        `
        UPDATE contrato.contrato c
        SET status = $1, updated_on = now()
        WHERE c.id = $2
          AND ${ENTRADA_ANIMAIS_WHERE}
        `,
        [statusNovo, id],
      );
    }

    await client.query("COMMIT");
    return await getContratoEntradaAnimaisById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function getNextNumeroContrato(client: PoolClient, empresaId: number | null, exercicio: number): Promise<number> {
  const result = await client.query<{ numero: number }>(
    `
    SELECT
      coalesce(
        max(CASE WHEN trim(coalesce(c.numero, '')) ~ '^[0-9]+$' THEN trim(c.numero)::bigint ELSE 0 END),
        0
      ) + 1 AS numero
    FROM contrato.contrato c
    WHERE ($1::bigint IS NULL OR c.empresa_id = $1)
      AND c.ano = $2
      AND ${ENTRADA_ANIMAIS_WHERE}
    `,
    [empresaId, exercicio],
  );

  return Number(result.rows[0]?.numero ?? 1) || 1;
}

async function resolveParceiroSnapshot(client: PoolClient, parceiroId?: number | null) {
  if (!parceiroId) return null;
  if (!(await hasTable(client, "dbo.res_partner"))) return null;

  const result = await client.query(
    `SELECT 1 FROM dbo.res_partner p WHERE p.id = $1`,
    [parceiroId],
  );
  if ((result.rowCount ?? 0) === 0) throw new Error("Parceiro informado nao encontrado.");
  return true;
}

async function replaceContratoItens(client: PoolClient, contratoId: number, rows?: ContratoLinhaPayload[]) {
  if (rows === undefined || !(await hasTable(client, "contrato.contrato_item"))) return;
  await ensureContratoItemSnapshotColumns(client);

  await client.query("DELETE FROM contrato.contrato_item WHERE contrato_id = $1", [contratoId]);
  if (rows.length === 0) return;

  for (const row of rows) {
    const itemIdRaw = getRowText(row, ["itemId"]);
    const itemLabel = getRowText(row, ["item"]);
    const itemSplit = splitCatalogLabel(itemLabel);
    const itemCodeSnapshot = normalizeItemCodeSnapshot(itemIdRaw) ?? itemSplit.code;
    await client.query(
      `
      INSERT INTO contrato.contrato_item (
        updated_on, created_on, contrato_id, item_id, vl_unitario, qt, vl_total, vl_comissao, prazo_entrega,
        condicao_pagamento_id, deposito_id, udm_id, cc_id, utilizacao_id, moeda_id,
        item_codigo_snapshot, item_nome_snapshot, item_label_snapshot,
        udm_label_snapshot, condicao_pagamento_label_snapshot, deposito_label_snapshot,
        centro_custo_label_snapshot, utilizacao_label_snapshot, moeda_label_snapshot
      )
      VALUES (now(), now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      `,
      [
        contratoId,
        toNullableInteger(itemIdRaw),
        getRowNumber(row, ["valorUnitario"]),
        getRowNumber(row, ["quantidade", "qtd"]),
        getRowNumber(row, ["valorTotal", "valor"]),
        getRowNumber(row, ["valorComissao"]),
        normalizeDateInput(getRowText(row, ["prazoEntrega", "prazo_entrega"])),
        toNullableInteger(getRowText(row, ["condicaoPagamentoId"])),
        toNullableInteger(getRowText(row, ["depositoId"])),
        toNullableInteger(getRowText(row, ["undMedidaId"])),
        toNullableInteger(getRowText(row, ["centroCustoId"])),
        toNullableInteger(getRowText(row, ["utilizacaoId"])),
        toNullableInteger(getRowText(row, ["moedaId"])),
        itemCodeSnapshot,
        itemSplit.name,
        itemLabel,
        getRowText(row, ["undMedida"]),
        getRowText(row, ["condicaoPagamento"]),
        getRowText(row, ["deposito"]),
        getRowText(row, ["centroCusto"]),
        getRowText(row, ["utilizacao"]),
        getRowText(row, ["moeda"]),
      ],
    );
  }
}

async function replaceContratoFretes(client: PoolClient, contratoId: number, rows?: ContratoLinhaPayload[]) {
  if (rows === undefined || !(await hasTable(client, "contrato.transportador"))) return;

  await client.query("DELETE FROM contrato.transportador WHERE contrato_id = $1", [contratoId]);
  if (rows.length === 0) return;

  for (const row of rows) {
    await client.query(
      `
      INSERT INTO contrato.transportador (
        updated_on, created_on, contrato_id, transportador_id, placa, motorista, cpf, observacao, vl, frete, qt,
        dt_embarque, dt_entrega, km, qt_chegada, equipamento_id
      )
      VALUES (now(), now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        contratoId,
        toNullableInteger(getRowText(row, ["transportadorId"])),
        getRowText(row, ["placa"]),
        getRowText(row, ["motorista", "transportador"]),
        normalizeCpfToStorage(getRowText(row, ["cpfMotorista", "cpf"])),
        serializeJsonOrNull({ __kind: "frete", payload: row }) ?? getRowText(row, ["observacao"]),
        getRowNumber(row, ["valor", "vl"]),
        getRowText(row, ["frete"]),
        getRowNumber(row, ["qtd", "qt", "quantidade"]),
        normalizeDateInput(getRowText(row, ["dataEmbarque", "dt_embarque"])),
        normalizeDateInput(getRowText(row, ["dataEntrega", "dt_entrega"])),
        getRowNumber(row, ["km"]),
        getRowNumber(row, ["qtdChegada", "qt_chegada"]),
        toNullableInteger(getRowText(row, ["equipamentoId"])),
      ],
    );
  }
}

async function replaceContratoFinanceiro(client: PoolClient, contratoId: number, rows?: ContratoLinhaPayload[]) {
  if (rows === undefined || !(await hasTable(client, "contrato.financeiro"))) return;

  await client.query("DELETE FROM contrato.financeiro WHERE contrato_id = $1", [contratoId]);
  if (rows.length === 0) return;

  const fallbackDate = new Date().toISOString().slice(0, 10);

  for (const row of rows) {
    const tpPayload = serializeJsonOrNull({
      formaPagamento: getRowText(row, ["formaPagamento"]),
      condicaoPagamento: getRowText(row, ["condicaoPagamento"]),
      banco: getRowText(row, ["banco"]),
      agencia: getRowText(row, ["agencia"]),
      conta: getRowText(row, ["conta"]),
      digito: getRowText(row, ["digito"]),
    });

    await client.query(
      `
      INSERT INTO contrato.financeiro (
        contrato_id, tp, dt, vl, created_on, updated_on, descricao, tx, dias_referencia
      )
      VALUES ($1, $2, $3, $4, now(), now(), $5, $6, $7)
      `,
      [
        contratoId,
        tpPayload ?? getRowText(row, ["formaPagamento"]),
        normalizeDateInput(getRowText(row, ["data", "dt"])) ?? fallbackDate,
        getRowNumber(row, ["valor", "vl"]),
        getRowText(row, ["descricao"]),
        getRowNumber(row, ["taxaJuros", "tx"]),
        toNullableInteger(getRowText(row, ["diasReferencia", "dias_referencia"])),
      ],
    );
  }
}
async function replaceContratoNotas(client: PoolClient, contratoId: number, rows?: ContratoLinhaPayload[]) {
  if (rows === undefined || !(await hasTable(client, "contrato.contrato_nf"))) return;

  await client.query("DELETE FROM contrato.contrato_nf WHERE contrato_id = $1", [contratoId]);
  if (rows.length === 0) return;

  for (const row of rows) {
    const nfId = toNullableInteger(getRowText(row, ["nf", "numero", "nf_id"]));
    if (!nfId) continue;

    await client.query(
      `
      INSERT INTO contrato.contrato_nf (contrato_id, nf_id, created_on, updated_on)
      VALUES ($1, $2, now(), now())
      `,
      [contratoId, nfId],
    );
  }
}

async function replaceContratoClausulas(client: PoolClient, contratoId: number, rows?: ContratoLinhaPayload[]) {
  if (rows === undefined || !(await hasTable(client, "contrato.clausula_contrato"))) return;

  await client.query("DELETE FROM contrato.clausula_contrato WHERE contrato_id = $1", [contratoId]);
  if (rows.length === 0) return;

  for (const row of rows) {
    await client.query(
      `
      INSERT INTO contrato.clausula_contrato (
        contrato_id, codigo, referencia, descricao, created_on, updated_on
      )
      VALUES ($1, $2, $3, $4, now(), now())
      `,
      [
        contratoId,
        getRowText(row, ["codigo"]),
        getRowText(row, ["referencia", "titulo", "codigo"]),
        getRowText(row, ["descricao", "conteudo"]) ?? "Sem descricao",
      ],
    );
  }
}

async function replaceContratoPrevisoes(
  client: PoolClient,
  contratoId: number,
  previsoes?: ContratoLinhaPayload[],
  mapas?: ContratoLinhaPayload[],
) {
  if ((previsoes === undefined && mapas === undefined) || !(await hasTable(client, "contrato.contrato_previsao"))) return;

  await client.query("DELETE FROM contrato.contrato_previsao WHERE contrato_id = $1", [contratoId]);

  const previsoesToInsert = previsoes ?? [];
  const mapasToInsert = mapas ?? [];
  if (previsoesToInsert.length === 0 && mapasToInsert.length === 0) return;

  const fallbackDate = new Date().toISOString().slice(0, 10);

  for (const row of [...previsoesToInsert, ...mapasToInsert]) {
    await client.query(
      `
      INSERT INTO contrato.contrato_previsao (contrato_id, dt_inicio, qt, created_on, updated_on)
      VALUES ($1, $2, $3, now(), now())
      `,
      [
        contratoId,
        normalizeDateInput(getRowText(row, ["dataInicio", "dtInicio", "dt_inicio"])) ?? fallbackDate,
        getRowNumber(row, ["quantidade", "qt", "valor"]),
      ],
    );
  }
}

function mapItemRowToPayload(row: JsonObject): ContratoLinhaPayload {
  const itemId = toNullableString(row.item_id) ?? toNullableString(row.item_codigo_snapshot) ?? "";
  const itemLabel =
    toNullableString(row.item_label_snapshot) ??
    toNullableString(row.item_nome_snapshot) ??
    toNullableString(row.item_id) ??
    "";
  return {
    itemId,
    item: itemLabel,
    undMedidaId: toNullableString(row.udm_id) ?? "",
    undMedida: toNullableString(row.udm_label_snapshot) ?? "",
    valorUnitario: toDecimalString(row.vl_unitario),
    quantidade: toDecimalString(row.qt),
    valorTotal: toDecimalString(row.vl_total),
    valorComissao: toDecimalString(row.vl_comissao),
    prazoEntrega: toNullableString(row.prazo_entrega) ?? "",
    condicaoPagamentoId: toNullableString(row.condicao_pagamento_id) ?? "",
    condicaoPagamento: toNullableString(row.condicao_pagamento_label_snapshot) ?? "",
    depositoId: toNullableString(row.deposito_id) ?? "",
    deposito: toNullableString(row.deposito_label_snapshot) ?? "",
    centroCustoId: toNullableString(row.cc_id) ?? "",
    centroCusto: toNullableString(row.centro_custo_label_snapshot) ?? "",
    utilizacaoId: toNullableString(row.utilizacao_id) ?? "",
    utilizacao: toNullableString(row.utilizacao_label_snapshot) ?? "",
    moedaId: toNullableString(row.moeda_id) ?? "",
    moeda: toNullableString(row.moeda_label_snapshot) ?? "",
  };
}

function mapFreteRowToPayload(row: JsonObject): ContratoLinhaPayload {
  const payload = extractPayloadFromObservation(row.observacao);
  if (payload) return payload;

  return {
    frete: toNullableString(row.frete) ?? "",
    transportadorId: toNullableString(row.transportador_id) ?? "",
    transportador: toNullableString(row.motorista) ?? "",
    cpfMotorista: toNullableString(row.cpf) ?? "",
    placa: toNullableString(row.placa) ?? "",
    observacao: toNullableString(row.observacao) ?? "",
    valor: toDecimalString(row.vl),
    qtd: toDecimalString(row.qt),
    qtdChegada: toDecimalString(row.qt_chegada),
    km: toDecimalString(row.km),
    dataEmbarque: toNullableString(row.dt_embarque) ?? "",
    dataEntrega: toNullableString(row.dt_entrega) ?? "",
    equipamentoId: toNullableString(row.equipamento_id) ?? "",
    equipamento: toNullableString(row.equipamento_id) ?? "",
  };
}

function mapFinanceiroRowToPayload(row: JsonObject): ContratoLinhaPayload {
  const tpPayload = parseJsonObject(row.tp);
  const formaPagamento =
    tpPayload && typeof tpPayload.formaPagamento === "string"
      ? String(tpPayload.formaPagamento)
      : toNullableString(row.tp) ?? "";
  const condicaoPagamento =
    tpPayload && typeof tpPayload.condicaoPagamento === "string"
      ? String(tpPayload.condicaoPagamento)
      : "";
  const banco =
    tpPayload && typeof tpPayload.banco === "string"
      ? String(tpPayload.banco)
      : "";
  const agencia =
    tpPayload && typeof tpPayload.agencia === "string"
      ? String(tpPayload.agencia)
      : "";
  const conta =
    tpPayload && typeof tpPayload.conta === "string"
      ? String(tpPayload.conta)
      : "";
  const digito =
    tpPayload && typeof tpPayload.digito === "string"
      ? String(tpPayload.digito)
      : "";

  return {
    descricao: toNullableString(row.descricao) ?? "",
    data: toNullableString(row.dt) ?? "",
    valor: toDecimalString(row.vl),
    taxaJuros: toDecimalString(row.tx),
    diasReferencia: toNullableString(row.dias_referencia) ?? "",
    condicaoPagamento,
    formaPagamento,
    banco,
    agencia,
    conta,
    digito,
  };
}

function mapNotaRowToPayload(row: JsonObject): ContratoLinhaPayload {
  return { nf: toNullableString(row.nf_id) ?? "" };
}

function mapClausulaRowToPayload(row: JsonObject): ContratoLinhaPayload {
  return {
    codigo: toNullableString(row.codigo) ?? "",
    referencia: toNullableString(row.referencia) ?? "",
    descricao: toNullableString(row.descricao) ?? "",
  };
}

function mapPrevisaoRowToPayload(row: JsonObject): ContratoLinhaPayload {
  return {
    dataInicio: toNullableString(row.dt_inicio) ?? "",
    descricao: "",
    quantidade: toDecimalString(row.qt),
    valor: toDecimalString(row.qt),
  };
}

function splitPrevisoesAndMapas(rows: JsonObject[]): { previsoes: ContratoLinhaPayload[]; mapas: ContratoLinhaPayload[] } {
  const mapas = rows.map(mapPrevisaoRowToPayload);
  return { previsoes: [], mapas };
}
function extractPayloadFromObservation(observacao: unknown): ContratoLinhaPayload | null {
  const parsed = parseJsonObject(observacao);
  if (!parsed?.payload || typeof parsed.payload !== "object" || Array.isArray(parsed.payload)) return null;
  return normalizePayloadRow(parsed.payload as JsonObject);
}

function normalizePayloadRow(row: JsonObject): ContratoLinhaPayload {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)]),
  );
}

function readDadosGeraisFromMeta(meta: JsonObject | null): ContratoDadosGeraisInput {
  if (!meta?.dadosGerais || typeof meta.dadosGerais !== "object" || Array.isArray(meta.dadosGerais)) return {};
  return meta.dadosGerais as ContratoDadosGeraisInput;
}

function readOutrosFromMeta(meta: JsonObject | null): ContratoOutrosInput {
  if (!meta?.outros || typeof meta.outros !== "object" || Array.isArray(meta.outros)) return {};
  return meta.outros as ContratoOutrosInput;
}

function readMapasFromMeta(meta: JsonObject | null): ContratoLinhaPayload[] | null {
  if (!meta?.mapas || !Array.isArray(meta.mapas)) return null;
  return meta.mapas
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => normalizePayloadRow(item as JsonObject));
}

function readCustosCategoriasFromMeta(meta: JsonObject | null): ContratoLinhaPayload[] | null {
  if (!meta?.custosCategorias || !Array.isArray(meta.custosCategorias)) return null;
  return meta.custosCategorias
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => normalizePayloadRow(item as JsonObject));
}

function readCustosResumoFromContrato(contrato: JsonObject): ContratoCustosResumoInput {
  return {
    valorMedioCepea: toNullableNumber(contrato.vl_cepea),
    percentualParceria: toNullableNumber(contrato.pct_parceria),
    percentualRecria: toNullableNumber(contrato.pct_recria),
    valorArroba: toNullableNumber(contrato.vl_arroba),
    valorCabeca: toNullableNumber(contrato.vl_cabeca),
    valorFreteCab: toNullableNumber(contrato.vl_frete_cab),
    valorIcmsArroba: toNullableNumber(contrato.vl_icms),
    valorIcmsFreteCab: toNullableNumber(contrato.vl_icms_frete),
    valorProtocolo: toNullableNumber(contrato.vl_protocolo),
    valorBrinco: toNullableNumber(contrato.vl_brinco),
    valorTotal: toNullableNumber(contrato.vl_total_compra),
    operacionalCabDia: toNullableNumber(contrato.custo_operacional),
    operacionalCabDiaVendido: toNullableNumber(contrato.custo_operacional_vendido),
    custoToneladaMs: toNullableNumber(contrato.custo_ton_ms),
    custoToneladaMsVendido: toNullableNumber(contrato.custo_ton_ms_vendido),
    valorArrobaProduzida: toNullableNumber(contrato.vl_arroba_produzida),
    animaisPrevisto: toNullableNumber(contrato.qt_animal_previsto),
    descontoVendaArroba: toNullableNumber(contrato.vl_desconto_venda),
  };
}

function readEmpresaSapFromMeta(meta: JsonObject | null): ContratoEmpresaSapInput | null {
  if (!meta?.empresaSap || typeof meta.empresaSap !== "object" || Array.isArray(meta.empresaSap)) return null;
  const row = meta.empresaSap as Record<string, unknown>;
  const nome = toNullableString(row.nome);
  if (!nome) return null;
  return {
    sapExternalId: toNullableString(row.sapExternalId),
    codigo: toNullableString(row.codigo),
    nome,
    cnpj: toNullableString(row.cnpj),
    rgIe: toNullableString(row.rgIe),
    telefone: toNullableString(row.telefone),
    email: toNullableString(row.email),
    representanteLegal: toNullableString(row.representanteLegal),
    endereco: toNullableString(row.endereco),
  };
}

function readParceiroSapFromMeta(meta: JsonObject | null): ContratoParceiroSapInput | null {
  if (!meta?.parceiroSap || typeof meta.parceiroSap !== "object" || Array.isArray(meta.parceiroSap)) return null;
  const row = meta.parceiroSap as Record<string, unknown>;
  const nome = toNullableString(row.nome);
  if (!nome) return null;
  return {
    sapExternalId: toNullableString(row.sapExternalId),
    codigo: toNullableString(row.codigo),
    nome,
    documento: toNullableString(row.documento),
    rgIe: toNullableString(row.rgIe),
    telefone: toNullableString(row.telefone),
    email: toNullableString(row.email),
    representanteLegal: toNullableString(row.representanteLegal),
    cpf: toNullableString(row.cpf),
    rg: toNullableString(row.rg),
    profissao: toNullableString(row.profissao),
    estadoCivil: toNullableString(row.estadoCivil),
    endereco: toNullableString(row.endereco),
  };
}

function readComissionadoSapFromMeta(meta: JsonObject | null): ContratoParceiroSapInput | null {
  if (!meta?.comissionadoSap || typeof meta.comissionadoSap !== "object" || Array.isArray(meta.comissionadoSap)) {
    return null;
  }
  const row = meta.comissionadoSap as Record<string, unknown>;
  const nome = toNullableString(row.nome);
  if (!nome) return null;
  return {
    sapExternalId: toNullableString(row.sapExternalId),
    codigo: toNullableString(row.codigo),
    nome,
    documento: toNullableString(row.documento),
    rgIe: toNullableString(row.rgIe),
    telefone: toNullableString(row.telefone),
    email: toNullableString(row.email),
    representanteLegal: toNullableString(row.representanteLegal),
    cpf: toNullableString(row.cpf),
    rg: toNullableString(row.rg),
    profissao: toNullableString(row.profissao),
    estadoCivil: toNullableString(row.estadoCivil),
    endereco: toNullableString(row.endereco),
  };
}

function readParceiroDisplayFromMeta(observacao: string | null): string | null {
  const parsed = splitObservacoesAndMeta(observacao);
  const parceiroSap = readParceiroSapFromMeta(parsed.meta);
  if (!parceiroSap?.nome) return null;
  const parts = [parceiroSap.codigo, parceiroSap.nome, parceiroSap.documento].filter((item) => Boolean(item));
  return parts.length > 0 ? parts.join(" - ") : parceiroSap.nome;
}

function mergeMetadata(currentMeta: JsonObject | null, patch: MetadataPayload): MetadataPayload | null {
  const current = currentMeta ?? {};

  const merged: MetadataPayload = {
    dadosGerais:
      patch.dadosGerais !== undefined
        ? patch.dadosGerais
        : current.dadosGerais && typeof current.dadosGerais === "object" && !Array.isArray(current.dadosGerais)
          ? (current.dadosGerais as ContratoDadosGeraisInput)
          : null,
    outros:
      patch.outros !== undefined
        ? patch.outros
        : current.outros && typeof current.outros === "object" && !Array.isArray(current.outros)
          ? (current.outros as ContratoOutrosInput)
          : null,
    mapas:
      patch.mapas !== undefined
        ? patch.mapas
        : current.mapas && Array.isArray(current.mapas)
          ? current.mapas
              .filter((item) => item && typeof item === "object" && !Array.isArray(item))
              .map((item) => normalizePayloadRow(item as JsonObject))
          : null,
    custosCategorias:
      patch.custosCategorias !== undefined
        ? patch.custosCategorias
        : current.custosCategorias && Array.isArray(current.custosCategorias)
          ? current.custosCategorias
              .filter((item) => item && typeof item === "object" && !Array.isArray(item))
              .map((item) => normalizePayloadRow(item as JsonObject))
          : null,
    comissionadoId:
      patch.comissionadoId !== undefined ? patch.comissionadoId : toNullableInteger(current.comissionadoId),
    comissionadoSap:
      patch.comissionadoSap !== undefined
        ? patch.comissionadoSap
        : readComissionadoSapFromMeta(current) ?? null,
    emissorNotaId:
      patch.emissorNotaId !== undefined ? patch.emissorNotaId : toNullableInteger(current.emissorNotaId),
    clausulaModeloId:
      patch.clausulaModeloId !== undefined ? patch.clausulaModeloId : toNullableInteger(current.clausulaModeloId),
    clausulaTitulo:
      patch.clausulaTitulo !== undefined ? patch.clausulaTitulo : toNullableString(current.clausulaTitulo),
    empresaSap:
      patch.empresaSap !== undefined
        ? patch.empresaSap
        : readEmpresaSapFromMeta(current) ?? null,
    parceiroSap:
      patch.parceiroSap !== undefined
        ? patch.parceiroSap
        : readParceiroSapFromMeta(current) ?? null,
  };

  const hasData =
    Boolean(merged.dadosGerais && Object.keys(merged.dadosGerais).length > 0) ||
    Boolean(merged.outros && Object.keys(merged.outros).length > 0) ||
    Boolean(merged.mapas && merged.mapas.length > 0) ||
    Boolean(merged.custosCategorias && merged.custosCategorias.length > 0) ||
    merged.comissionadoId !== null ||
    Boolean(merged.comissionadoSap?.nome) ||
    merged.emissorNotaId !== null ||
    merged.clausulaModeloId !== null ||
    Boolean(merged.clausulaTitulo) ||
    Boolean(merged.empresaSap?.nome) ||
    Boolean(merged.parceiroSap?.nome);

  return hasData ? merged : null;
}

function splitObservacoesAndMeta(observacoes: string | null): { text: string | null; meta: JsonObject | null } {
  if (!observacoes) return { text: null, meta: null };

  const bareMarker = "/*CS_META*/";
  const markerIndexWithPrefix = observacoes.lastIndexOf(OBS_META_MARKER);
  const markerIndexBare = observacoes.lastIndexOf(bareMarker);
  const markerIndex = markerIndexWithPrefix >= 0 ? markerIndexWithPrefix : markerIndexBare;
  if (markerIndex < 0) return { text: observacoes, meta: null };

  const text = observacoes.slice(0, markerIndex).trim() || null;
  const markerLength = markerIndexWithPrefix >= 0 ? OBS_META_MARKER.length : bareMarker.length;
  const metaRaw = observacoes.slice(markerIndex + markerLength).trim();
  return { text, meta: parseJsonObject(metaRaw) };
}

function composeObservacoesWithMeta(observacoes: string | null, meta: MetadataPayload | null): string | null {
  const text = toNullableString(observacoes);
  const metaSerialized = serializeJsonOrNull(meta);
  if (!metaSerialized) return text;
  if (!text) return `${OBS_META_MARKER}${metaSerialized}`;
  return `${text}${OBS_META_MARKER}${metaSerialized}`;
}

function applyCustosResumoToSetClauses(
  custosResumo: ContratoCustosResumoInput | undefined,
  pushSet: (columnName: string, fieldValue: unknown) => void,
) {
  if (!custosResumo) return;
  mapUpdateField(custosResumo.valorMedioCepea, "vl_cepea", pushSet);
  mapUpdateField(custosResumo.percentualParceria, "pct_parceria", pushSet);
  mapUpdateField(custosResumo.percentualRecria, "pct_recria", pushSet);
  mapUpdateField(custosResumo.valorArroba, "vl_arroba", pushSet);
  mapUpdateField(custosResumo.valorCabeca, "vl_cabeca", pushSet);
  mapUpdateField(custosResumo.valorFreteCab, "vl_frete_cab", pushSet);
  mapUpdateField(custosResumo.valorIcmsArroba, "vl_icms", pushSet);
  mapUpdateField(custosResumo.valorIcmsFreteCab, "vl_icms_frete", pushSet);
  mapUpdateField(custosResumo.valorProtocolo, "vl_protocolo", pushSet);
  mapUpdateField(custosResumo.valorBrinco, "vl_brinco", pushSet);
  mapUpdateField(custosResumo.valorTotal, "vl_total_compra", pushSet);
  mapUpdateField(custosResumo.operacionalCabDia, "custo_operacional", pushSet);
  mapUpdateField(custosResumo.operacionalCabDiaVendido, "custo_operacional_vendido", pushSet);
  mapUpdateField(custosResumo.custoToneladaMs, "custo_ton_ms", pushSet);
  mapUpdateField(custosResumo.custoToneladaMsVendido, "custo_ton_ms_vendido", pushSet);
  mapUpdateField(custosResumo.valorArrobaProduzida, "vl_arroba_produzida", pushSet);
  mapUpdateField(custosResumo.animaisPrevisto, "qt_animal_previsto", pushSet);
  mapUpdateField(custosResumo.descontoVendaArroba, "vl_desconto_venda", pushSet);
}

async function updateContratoCustosResumo(
  client: PoolClient,
  contratoId: number,
  custosResumo: ContratoCustosResumoInput,
) {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  function pushSet(column: string, value: unknown) {
    values.push(value);
    setClauses.push(`${column} = $${values.length}`);
  }

  applyCustosResumoToSetClauses(custosResumo, pushSet);
  if (setClauses.length === 0) return;

  values.push(contratoId);
  await client.query(
    `
    UPDATE contrato.contrato c
    SET ${setClauses.join(", ")}
    WHERE c.id = $${values.length}
    `,
    values,
  );
}

function mapUpdateField(
  value: unknown | undefined,
  column: string,
    pushSet: (columnName: string, fieldValue: unknown) => void,
  transform?: (fieldValue: unknown) => unknown,
) {
  if (value !== undefined) {
    pushSet(column, transform ? transform(value) : value);
  }
}

function toDecimalString(value: unknown): string {
  const parsed = toNullableNumber(value);
  return parsed === null ? "0" : String(parsed);
}

async function selectRowsIfTableExists(
  db: Queryable,
  tableName: string,
  queryText: string,
  values: unknown[],
): Promise<JsonObject[]> {
  if (!(await hasTable(db, tableName))) return [];
  const result = await db.query<JsonObject>(queryText, values);
  return result.rows;
}

async function hasTable(db: Queryable, relation: string): Promise<boolean> {
  if (tableExistsCache.has(relation)) return tableExistsCache.get(relation) ?? false;

  const result = await db.query<{ relation: string | null }>("SELECT to_regclass($1) AS relation", [relation]);
  const exists = result.rows[0]?.relation !== null;
  tableExistsCache.set(relation, exists);
  return exists;
}

async function assertContratoTable(db: Queryable) {
  const legacyExists = await hasTable(db, "contrato.contrato");
  if (legacyExists) {
    await ensureContratoSnapshotColumns(db);
    await ensureContratoCustosColumns(db);
    return;
  }

  const csExists = await hasTable(db, "public.cs_contrato");
  if (csExists) {
    throw new Error("Encontrada tabela public.cs_contrato, mas o modulo Entrada de Animais esta configurado para o esquema contrato.*.");
  }

  throw new Error("Tabela contrato.contrato nao encontrada. Execute o script legado no schema contrato.");
}

async function ensureContratoSnapshotColumns(db: Queryable) {
  if (snapshotColumnsEnsured) return;
  await db.query(
    `
    ALTER TABLE contrato.contrato
      ADD COLUMN IF NOT EXISTS empresa_codigo_snapshot varchar(64),
      ADD COLUMN IF NOT EXISTS empresa_nome_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS empresa_cnpj_snapshot varchar(20),
      ADD COLUMN IF NOT EXISTS parceiro_codigo_snapshot varchar(64),
      ADD COLUMN IF NOT EXISTS parceiro_nome_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS parceiro_documento_snapshot varchar(20);
    `,
  );
  snapshotColumnsEnsured = true;
}

async function ensureContratoCustosColumns(db: Queryable) {
  if (custosColumnsEnsured) return;
  await db.query(
    `
    ALTER TABLE contrato.contrato
      ADD COLUMN IF NOT EXISTS vl_cepea numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pct_parceria numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pct_recria numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_arroba numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_cabeca numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_frete_cab numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_icms numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_icms_frete numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_protocolo numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_brinco numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_total_compra numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS custo_operacional numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS custo_operacional_vendido numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS custo_ton_ms numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS custo_ton_ms_vendido numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_arroba_produzida numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS qt_animal_previsto numeric(29,6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vl_desconto_venda numeric(29,6) DEFAULT 0;
    `,
  );
  custosColumnsEnsured = true;
}

async function ensureContratoItemSnapshotColumns(db: Queryable) {
  if (itemSnapshotColumnsEnsured) return;
  await db.query(
    `
    ALTER TABLE contrato.contrato_item
      ADD COLUMN IF NOT EXISTS item_codigo_snapshot varchar(64),
      ADD COLUMN IF NOT EXISTS item_nome_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS item_label_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS udm_label_snapshot varchar(120),
      ADD COLUMN IF NOT EXISTS condicao_pagamento_label_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS deposito_label_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS centro_custo_label_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS utilizacao_label_snapshot varchar(255),
      ADD COLUMN IF NOT EXISTS moeda_label_snapshot varchar(120);
    `,
  );
  itemSnapshotColumnsEnsured = true;
}

function normalizeStatus(status: unknown): ContratoStatus {
  const parsed = String(status ?? "").toLowerCase().trim();

  if (["aguardando_aprovacao", "aguardando aprovacao", "aguardando aprovação"].includes(parsed)) return "aguardando_aprovacao";
  if (parsed === "ativo") return "ativo";
  if (["contendo_parc", "contendo parc", "contendo parc.", "conferido parc", "conferido parc.", "conferido parcialmente"].includes(parsed)) return "contendo_parc";
  if (parsed === "encerrado") return "encerrado";
  if (["inativo_cancelado", "inativo/cancelado", "inativo cancelado"].includes(parsed)) return "inativo_cancelado";

  return "aguardando_aprovacao";
}

function normalizeEmpresaSnapshot(input: ContratoEmpresaSapInput | null | undefined) {
  if (!input) return null;
  const nome = toNullableString(input.nome);
  if (!nome) return null;
  return {
    codigo: toNullableString(input.codigo),
    nome,
    cnpj: toNullableString(input.cnpj),
  };
}

function normalizeParceiroSnapshot(input: ContratoParceiroSapInput | null | undefined) {
  if (!input) return null;
  const nome = toNullableString(input.nome);
  if (!nome) return null;
  return {
    codigo: toNullableString(input.codigo),
    nome,
    documento: toNullableString(input.documento),
  };
}

function normalizeDateInput(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return null;
  return parsed;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsedText = String(value).trim();
  if (!/^\d+$/.test(parsedText)) return null;

  const parsed = Number.parseInt(parsedText, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = String(value).trim();
  return parsed.length === 0 ? null : parsed;
}

function normalizeItemCodeSnapshot(raw: string | null): string | null {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const sapPrefixMatch = text.match(/^sap:[^:]+:(.+)$/i);
  if (sapPrefixMatch?.[1]) {
    return sapPrefixMatch[1].trim() || null;
  }
  return /^\d+$/.test(text) ? null : text;
}

function splitCatalogLabel(label: string | null): { code: string | null; name: string | null } {
  if (!label) return { code: null, name: null };
  const text = String(label).trim();
  if (!text) return { code: null, name: null };

  const separator = " - ";
  const separatorIndex = text.indexOf(separator);
  if (separatorIndex <= 0) {
    return { code: null, name: text };
  }

  const code = text.slice(0, separatorIndex).trim();
  const name = text.slice(separatorIndex + separator.length).trim();
  return {
    code: code || null,
    name: name || null,
  };
}

function normalizeCpfToStorage(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits.length > 0 ? digits : null;
}

function getRowText(row: ContratoLinhaPayload, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const parsed = String(value).trim();
    if (parsed.length > 0) return parsed;
  }
  return null;
}

function getRowNumber(row: ContratoLinhaPayload, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number(String(value).replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function parseJsonObject(value: unknown): JsonObject | null {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as JsonObject;

  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
  } catch {
    return null;
  }

  return null;
}

function serializeJsonOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
