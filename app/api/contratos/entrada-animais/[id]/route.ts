import { NextResponse } from "next/server";
import {
  getContratoEntradaAnimaisById,
  updateContratoEntradaAnimais,
} from "@/lib/repositories/contratos-entrada-animais-repo";

export const runtime = "nodejs";
const RESPONSAVEL_JURIDICO_FIXO = "CAMILA CARMO DE CARVALHO - 05500424580";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const contratoId = Number.parseInt(id, 10);

  if (Number.isNaN(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const data = await getContratoEntradaAnimaisById(contratoId);
    if (!data) {
      return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const contratoId = Number.parseInt(id, 10);

  if (Number.isNaN(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  try {
    const updated = await updateContratoEntradaAnimais(contratoId, {
      parceiroId: parseOptionalPositiveInt(body.parceiroId),
      comissionadoSap: parseOptionalParceiroSap(body.comissionadoSap),
      referenciaContrato: toOptionalString(body.referenciaContrato),
      refObjectId: body.refObjectId === null ? null : toOptionalString(body.refObjectId),
      assinaturaEm: body.assinaturaEm === null ? null : toOptionalString(body.assinaturaEm),
      prazoEntregaEm: body.prazoEntregaEm === null ? null : toOptionalString(body.prazoEntregaEm),
      inicioEm: body.inicioEm === null ? null : toOptionalString(body.inicioEm),
      vencimentoEm: body.vencimentoEm === null ? null : toOptionalString(body.vencimentoEm),
      permuta: false,
      contratoPermutaId: null,
      aditivo: false,
      tipoAditivo: "nenhum",
      contratoCedenteId: parseOptionalNullablePositiveInt(body.contratoCedenteId),
      contratoAnteriorId: parseOptionalNullablePositiveInt(body.contratoAnteriorId),
      valor: parseOptionalNumber(body.valor),
      valorMaoObra: parseOptionalNumber(body.valorMaoObra),
      responsavelFrete: toOptionalString(body.responsavelFrete) as "empresa" | "parceiro" | "terceiro" | undefined,
      calculoFrete: toOptionalString(body.calculoFrete) as "km_rodado" | "peso" | undefined,
      valorUnitarioFrete: parseOptionalNumber(body.valorUnitarioFrete),
      emissorNotaId: parseOptionalNullablePositiveInt(body.emissorNotaId),
      emissorNota: toOptionalString(body.emissorNota) as "empresa" | "parceiro" | "terceiro" | undefined,
      assinaturaParceiro: parseOptionalNullableString(body.assinaturaParceiro),
      assinaturaEmpresa: parseOptionalNullableString(body.assinaturaEmpresa),
      comissionadoId: parseOptionalNullablePositiveInt(body.comissionadoId),
      comissionadoTipo: toOptionalString(body.comissionadoTipo) as
        | "nao_aplica"
        | "interno"
        | "parceiro"
        | "corretor"
        | undefined,
      comissionadoNome: parseOptionalNullableString(body.comissionadoNome),
      valorComissao: parseOptionalNumber(body.valorComissao),
      responsavelJuridicoNome: RESPONSAVEL_JURIDICO_FIXO,
      testemunha1Nome: parseOptionalNullableString(body.testemunha1Nome),
      testemunha1Cpf: parseOptionalNullableString(body.testemunha1Cpf),
      testemunha2Nome: parseOptionalNullableString(body.testemunha2Nome),
      testemunha2Cpf: parseOptionalNullableString(body.testemunha2Cpf),
      objeto: parseOptionalNullableString(body.objeto),
      execucao: parseOptionalNullableString(body.execucao),
      observacoes: parseOptionalNullableString(body.observacoes),
      sapDocEntry: parseOptionalNullablePositiveInt(body.sapDocEntry),
      sapDocNum: parseOptionalNullablePositiveInt(body.sapDocNum),
      sapValorPago: parseOptionalNumber(body.sapValorPago),
      sapUltimoSyncEm: parseOptionalNullableString(body.sapUltimoSyncEm),
      dadosGerais: parseOptionalDadosGerais(body.dadosGerais),
      custosResumo: parseOptionalCustosResumo(body.custosResumo),
      custosCategorias: parseOptionalCollectionRows(body.custosCategorias),
      itens: parseOptionalCollectionRows(body.itens),
      fretes: parseOptionalCollectionRows(body.fretes),
      financeiros: parseOptionalCollectionRows(body.financeiros),
      notas: parseOptionalCollectionRows(body.notas),
      clausulas: parseOptionalCollectionRows(body.clausulas),
      previsoes: parseOptionalCollectionRows(body.previsoes),
      mapas: parseOptionalCollectionRows(body.mapas),
      atualizadoPor: parseOptionalNullableString(body.atualizadoPor),
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar contrato.";
    if (message.toLowerCase().includes("nao encontrado") || message.toLowerCase().includes("não encontrado")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.toLowerCase().includes("nenhum campo")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseOptionalNullablePositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(String(value));
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = String(value).trim();
  return parsed.length === 0 ? undefined : parsed;
}

function parseOptionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = String(value).trim();
  return parsed.length === 0 ? null : parsed;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return undefined;
}

function parseOptionalDadosGerais(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const dados = value as Record<string, unknown>;
  return {
    tipoEntrada: parseOptionalNullableString(dados.tipoEntrada),
    tabelaPreco: parseOptionalNullableString(dados.tabelaPreco),
    originador: parseOptionalNullableString(dados.originador),
    sexo: parseOptionalNullableString(dados.sexo),
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
    dls: parseOptionalNullableString(dados.dls),
    gmd: parseOptionalNumber(dados.gmd) ?? null,
    gmc: parseOptionalNumber(dados.gmc) ?? null,
    consumoPercentualPv: parseOptionalNumber(dados.consumoPercentualPv) ?? null,
    categoria: parseOptionalNullableString(dados.categoria),
    racaPredominante: parseOptionalNullableString(dados.racaPredominante),
    precoVendaFutura: toOptionalBoolean(dados.precoVendaFutura) ?? null,
  };
}

function parseOptionalCustosResumo(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

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

function parseOptionalCollectionRows(value: unknown): Record<string, string>[] | undefined {
  if (value === undefined) return undefined;
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

function parseOptionalParceiroSap(value: unknown) {
  if (value === undefined) return undefined;
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


