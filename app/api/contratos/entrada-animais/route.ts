import { NextResponse } from "next/server";
import {
  createContratoEntradaAnimais,
  listContratosEntradaAnimais,
} from "@/lib/repositories/contratos-entrada-animais-repo";
import type { ContratoStatus } from "@/lib/types/contrato";

export const runtime = "nodejs";
const RESPONSAVEL_JURIDICO_FIXO = "CAMILA CARMO DE CARVALHO - 05500424580";

const validStatus: ContratoStatus[] = [
  "aguardando_aprovacao",
  "ativo",
  "contendo_parc",
  "encerrado",
  "inativo_cancelado",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const statusParam = searchParams.get("status");
  const exercicioParam = searchParams.get("exercicio");
  const search = searchParams.get("search");
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 25), 100);

  if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
    return NextResponse.json({ error: "Paginação inválida." }, { status: 400 });
  }

  let status: ContratoStatus | null = null;
  if (statusParam) {
    if (!validStatus.includes(statusParam as ContratoStatus)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    status = statusParam as ContratoStatus;
  }

  let exercicio: number | null = null;
  if (exercicioParam) {
    exercicio = Number.parseInt(exercicioParam, 10);
    if (Number.isNaN(exercicio) || exercicio < 2000 || exercicio > 2100) {
      return NextResponse.json({ error: "Exercício inválido." }, { status: 400 });
    }
  }

  try {
    const data = await listContratosEntradaAnimais({
      status,
      exercicio,
      search,
      page,
      pageSize,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar contratos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const empresaId = parseOptionalPositiveInt(body.empresaId);
  const referenciaContrato = String(body.referenciaContrato ?? "").trim();
  const numero = parseOptionalPositiveInt(body.numero);

  if (!referenciaContrato) {
    return NextResponse.json({ error: "referenciaContrato é obrigatório." }, { status: 400 });
  }
  if (!numero) {
    return NextResponse.json({ error: "numero é obrigatório na criação." }, { status: 400 });
  }

  try {
    const created = await createContratoEntradaAnimais({
      empresaId,
      empresaSap: parseEmpresaSap(body.empresaSap),
      parceiroId: parseOptionalPositiveInt(body.parceiroId),
      parceiroSap: parseParceiroSap(body.parceiroSap),
      comissionadoSap: parseParceiroSap(body.comissionadoSap),
      exercicio: parseOptionalPositiveInt(body.exercicio),
      numero,
      referenciaContrato,
      refObjectId: toOptionalString(body.refObjectId),
      assinaturaEm: toOptionalString(body.assinaturaEm),
      prazoEntregaEm: toOptionalString(body.prazoEntregaEm),
      inicioEm: toOptionalString(body.inicioEm),
      vencimentoEm: toOptionalString(body.vencimentoEm),
      permuta: false,
      contratoPermutaId: null,
      aditivo: false,
      tipoAditivo: "nenhum",
      contratoCedenteId: parseOptionalPositiveInt(body.contratoCedenteId),
      contratoAnteriorId: parseOptionalPositiveInt(body.contratoAnteriorId),
      valor: parseOptionalNumber(body.valor),
      valorMaoObra: parseOptionalNumber(body.valorMaoObra),
      responsavelFrete: toOptionalString(body.responsavelFrete) as "empresa" | "parceiro" | "terceiro" | undefined,
      calculoFrete: toOptionalString(body.calculoFrete) as "km_rodado" | "peso" | undefined,
      valorUnitarioFrete: parseOptionalNumber(body.valorUnitarioFrete),
      emissorNotaId: parseOptionalPositiveInt(body.emissorNotaId),
      emissorNota: toOptionalString(body.emissorNota) as "empresa" | "parceiro" | "terceiro" | undefined,
      assinaturaParceiro: toOptionalString(body.assinaturaParceiro),
      assinaturaEmpresa: toOptionalString(body.assinaturaEmpresa),
      comissionadoId: parseOptionalPositiveInt(body.comissionadoId),
      comissionadoTipo: toOptionalString(body.comissionadoTipo) as
        | "nao_aplica"
        | "interno"
        | "parceiro"
        | "corretor"
        | undefined,
      comissionadoNome: toOptionalString(body.comissionadoNome),
      valorComissao: parseOptionalNumber(body.valorComissao),
      responsavelJuridicoNome: RESPONSAVEL_JURIDICO_FIXO,
      testemunha1Nome: toOptionalString(body.testemunha1Nome),
      testemunha1Cpf: toOptionalString(body.testemunha1Cpf),
      testemunha2Nome: toOptionalString(body.testemunha2Nome),
      testemunha2Cpf: toOptionalString(body.testemunha2Cpf),
      objeto: toOptionalString(body.objeto),
      execucao: toOptionalString(body.execucao),
      observacoes: toOptionalString(body.observacoes),
      sapDocEntry: parseOptionalPositiveInt(body.sapDocEntry),
      sapDocNum: parseOptionalPositiveInt(body.sapDocNum),
      sapValorPago: parseOptionalNumber(body.sapValorPago),
      sapUltimoSyncEm: toOptionalString(body.sapUltimoSyncEm),
      dadosGerais: parseDadosGerais(body.dadosGerais),
      custosResumo: parseCustosResumo(body.custosResumo),
      custosCategorias: parseCollectionRows(body.custosCategorias),
      itens: parseCollectionRows(body.itens),
      fretes: parseCollectionRows(body.fretes),
      financeiros: parseCollectionRows(body.financeiros),
      notas: parseCollectionRows(body.notas),
      clausulas: parseCollectionRows(body.clausulas),
      previsoes: parseCollectionRows(body.previsoes),
      mapas: parseCollectionRows(body.mapas),
      criadoPor: toOptionalString(body.criadoPor),
      atualizadoPor: toOptionalString(body.atualizadoPor),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(String(value));
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length === 0 ? undefined : text;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return undefined;
}

function parseDadosGerais(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const dados = value as Record<string, unknown>;

  return {
    tipoEntrada: toOptionalString(dados.tipoEntrada),
    tabelaPreco: toOptionalString(dados.tabelaPreco),
    originador: toOptionalString(dados.originador),
    sexo: toOptionalString(dados.sexo),
    quantidadeNegociada: parseOptionalNumber(dados.quantidadeNegociada) ?? null,
    animaisMapa: parseOptionalNumber(dados.animaisMapa) ?? null,
    pesoMapaKg: parseOptionalNumber(dados.pesoMapaKg) ?? null,
    quantidadeGta: parseOptionalNumber(dados.quantidadeGta) ?? null,
    animaisMortos: parseOptionalNumber(dados.animaisMortos) ?? null,
    animaisLesionados: parseOptionalNumber(dados.animaisLesionados) ?? null,
    animaisChegada: parseOptionalNumber(dados.animaisChegada) ?? null,
    pesoChegadaKg: parseOptionalNumber(dados.pesoChegadaKg) ?? null,
    quebraKg: parseOptionalNumber(dados.quebraKg) ?? null,
    quebraArroba: parseOptionalNumber(dados.quebraArroba) ?? null,
    quebraPercentual: parseOptionalNumber(dados.quebraPercentual) ?? null,
    animaisDesembarcados: parseOptionalNumber(dados.animaisDesembarcados) ?? null,
    animaisProcessado: parseOptionalNumber(dados.animaisProcessado) ?? null,
    pesoIdentificacaoKg: parseOptionalNumber(dados.pesoIdentificacaoKg) ?? null,
    pesoBrutoCabeca: parseOptionalNumber(dados.pesoBrutoCabeca) ?? null,
    rcEntrada: parseOptionalNumber(dados.rcEntrada) ?? null,
    pesoComRc: parseOptionalNumber(dados.pesoComRc) ?? null,
    pesoConsideradoArroba: parseOptionalNumber(dados.pesoConsideradoArroba) ?? null,
    pesoConsideradoKg: parseOptionalNumber(dados.pesoConsideradoKg) ?? null,
    pesoMedioAbate: parseOptionalNumber(dados.pesoMedioAbate) ?? null,
    dls: toOptionalString(dados.dls),
    gmd: parseOptionalNumber(dados.gmd) ?? null,
    gmc: parseOptionalNumber(dados.gmc) ?? null,
    consumoPercentualPv: parseOptionalNumber(dados.consumoPercentualPv) ?? null,
    categoria: toOptionalString(dados.categoria),
    racaPredominante: toOptionalString(dados.racaPredominante),
    precoVendaFutura: toOptionalBoolean(dados.precoVendaFutura) ?? null,
  };
}

function parseCustosResumo(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const dados = value as Record<string, unknown>;
  return {
    valorMedioCepea: parseOptionalNumber(dados.valorMedioCepea) ?? null,
    percentualParceria: parseOptionalNumber(dados.percentualParceria) ?? null,
    percentualRecria: parseOptionalNumber(dados.percentualRecria) ?? null,
    valorArroba: parseOptionalNumber(dados.valorArroba) ?? null,
    valorCabeca: parseOptionalNumber(dados.valorCabeca) ?? null,
    valorFreteCab: parseOptionalNumber(dados.valorFreteCab) ?? null,
    valorIcmsArroba: parseOptionalNumber(dados.valorIcmsArroba) ?? null,
    valorIcmsFreteCab: parseOptionalNumber(dados.valorIcmsFreteCab) ?? null,
    valorProtocolo: parseOptionalNumber(dados.valorProtocolo) ?? null,
    valorBrinco: parseOptionalNumber(dados.valorBrinco) ?? null,
    valorTotal: parseOptionalNumber(dados.valorTotal) ?? null,
    operacionalCabDia: parseOptionalNumber(dados.operacionalCabDia) ?? null,
    operacionalCabDiaVendido: parseOptionalNumber(dados.operacionalCabDiaVendido) ?? null,
    custoToneladaMs: parseOptionalNumber(dados.custoToneladaMs) ?? null,
    custoToneladaMsVendido: parseOptionalNumber(dados.custoToneladaMsVendido) ?? null,
    valorArrobaProduzida: parseOptionalNumber(dados.valorArrobaProduzida) ?? null,
    animaisPrevisto: parseOptionalNumber(dados.animaisPrevisto) ?? null,
    descontoVendaArroba: parseOptionalNumber(dados.descontoVendaArroba) ?? null,
  };
}

function parseCollectionRows(value: unknown): Record<string, string>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const data = row as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(data).map(([key, item]) => [key, item === null || item === undefined ? "" : String(item)]),
      );
    });
}

function parseEmpresaSap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const nome = toOptionalString(row.nome);
  if (!nome) return undefined;
  return {
    sapExternalId: toOptionalString(row.sapExternalId) ?? null,
    codigo: toOptionalString(row.codigo) ?? null,
    nome,
    cnpj: toOptionalString(row.cnpj) ?? null,
  };
}

function parseParceiroSap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const nome = toOptionalString(row.nome);
  if (!nome) return undefined;
  return {
    sapExternalId: toOptionalString(row.sapExternalId) ?? null,
    codigo: toOptionalString(row.codigo) ?? null,
    nome,
    documento: toOptionalString(row.documento) ?? null,
  };
}
