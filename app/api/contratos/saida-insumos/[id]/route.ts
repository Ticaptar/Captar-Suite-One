import { NextResponse } from "next/server";
import {
  getContratoSaidaInsumosById,
  updateContratoSaidaInsumos,
} from "@/lib/repositories/contratos-saida-insumos-repo";
import { hydrateEmpresaSapSnapshot, hydrateParceiroSapSnapshot } from "@/lib/contracts/sap-snapshot";

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
    const data = await getContratoSaidaInsumosById(contratoId);
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
    const empresaSapInput = parseOptionalEmpresaSap(body.empresaSap);
    const parceiroSapInput = parseOptionalParceiroSap(body.parceiroSap);

    const [empresaSap, parceiroSap] = await Promise.all([
      hydrateEmpresaSapSnapshot(empresaSapInput),
      hydrateParceiroSapSnapshot(parceiroSapInput),
    ]);

    const updated = await updateContratoSaidaInsumos(contratoId, {
      tipoContrato: parseContratoTipo(body.tipoContrato),
      empresaSap,
      parceiroId: parseOptionalPositiveInt(body.parceiroId),
      parceiroSap,
      referenciaContrato: toOptionalString(body.referenciaContrato),
      refObjectId: body.refObjectId === null ? null : toOptionalString(body.refObjectId),
      assinaturaEm: body.assinaturaEm === null ? null : toOptionalString(body.assinaturaEm),
      prazoEntregaEm: body.prazoEntregaEm === null ? null : toOptionalString(body.prazoEntregaEm),
      inicioEm: body.inicioEm === null ? null : toOptionalString(body.inicioEm),
      vencimentoEm: body.vencimentoEm === null ? null : toOptionalString(body.vencimentoEm),
      permuta: toOptionalBoolean(body.permuta),
      contratoPermutaId: parseOptionalNullablePositiveInt(body.contratoPermutaId),
      aditivo: toOptionalBoolean(body.aditivo),
      tipoAditivo: toOptionalString(body.tipoAditivo) as
        | "nenhum"
        | "valor"
        | "prazo"
        | "quantidade"
        | "misto"
        | undefined,
      contratoCedenteId: parseOptionalNullablePositiveInt(body.contratoCedenteId),
      contratoAnteriorId: parseOptionalNullablePositiveInt(body.contratoAnteriorId),
      valor: parseOptionalNumber(body.valor),
      valorMaoObra: parseOptionalNumber(body.valorMaoObra),
      responsavelFrete: toOptionalString(body.responsavelFrete) as "empresa" | "parceiro" | "terceiro" | undefined,
      calculoFrete: toOptionalString(body.calculoFrete) as
        | "fixo"
        | "por_tonelada"
        | "por_unidade"
        | "por_km"
        | "sem_frete"
        | "km_rodado"
        | "peso"
        | undefined,
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
      itens: parseLinhas(body.itens),
      fretes: parseLinhas(body.fretes),
      financeiros: parseLinhas(body.financeiros ?? body.financeiro),
      notas: parseLinhas(body.notas),
      clausulas: parseLinhas(body.clausulas),
      clausulaModeloId: parseOptionalNullablePositiveInt(body.clausulaModeloId),
      clausulaTitulo: parseOptionalNullableString(body.clausulaTitulo),
      previsoes: parseLinhas(body.previsoes),
      mapas: parseLinhas(body.mapas),
      dadosGerais: parseOptionalDadosGerais(body.dadosGerais),
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

function parseContratoTipo(value: unknown): "saida_insumos" | "entrada_insumos" | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (parsed === "entrada_insumos" || parsed.includes("entrada")) return "entrada_insumos";
  if (parsed === "saida_insumos" || parsed.includes("saida")) return "saida_insumos";
  return undefined;
}

function parseOptionalDadosGerais(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const dados = value as Record<string, unknown>;
  const analises = Array.isArray(dados.analises)
    ? dados.analises
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            tipoAnalise: parseOptionalNullableString(row.tipoAnalise ?? row.tipo_analise) ?? null,
            valorMaximo: parseOptionalNumber(row.valorMaximo ?? row.valor_maximo) ?? null,
          };
        })
    : undefined;

  return {
    periodoProducao: parseOptionalNullableString(dados.periodoProducao),
    fazenda: parseOptionalNullableString(dados.fazenda),
    distanciaRaioKm: parseOptionalNumber(dados.distanciaRaioKm) ?? null,
    programacaoRetirada: parseOptionalNullableString(dados.programacaoRetirada),
    programacaoPagamento: parseOptionalNullableString(dados.programacaoPagamento),
    analises,
  };
}

function parseLinhas(value: unknown): Record<string, string>[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(row).map(([key, rowValue]) => [key, rowValue === null || rowValue === undefined ? "" : String(rowValue)]),
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
    rgIe: toOptionalString(row.rgIe) ?? null,
    telefone: toOptionalString(row.telefone) ?? null,
    email: toOptionalString(row.email) ?? null,
    representanteLegal: toOptionalString(row.representanteLegal) ?? null,
    cpf: toOptionalString(row.cpf) ?? null,
    rg: toOptionalString(row.rg) ?? null,
    profissao: toOptionalString(row.profissao) ?? null,
    estadoCivil: toOptionalString(row.estadoCivil) ?? null,
    endereco: toOptionalString(row.endereco) ?? null,
  };
}

function parseOptionalEmpresaSap(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  const nome = toOptionalString(row.nome);
  if (!nome) return undefined;
  return {
    sapExternalId: toOptionalString(row.sapExternalId) ?? null,
    codigo: toOptionalString(row.codigo) ?? null,
    nome,
    cnpj: toOptionalString(row.cnpj) ?? null,
    rgIe: toOptionalString(row.rgIe) ?? null,
    telefone: toOptionalString(row.telefone) ?? null,
    email: toOptionalString(row.email) ?? null,
    representanteLegal: toOptionalString(row.representanteLegal) ?? null,
    endereco: toOptionalString(row.endereco) ?? null,
  };
}

