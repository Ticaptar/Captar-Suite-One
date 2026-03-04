import { NextResponse } from "next/server";
import {
  createContratoSaidaInsumos,
  listContratosSaidaInsumos,
} from "@/lib/repositories/contratos-saida-insumos-repo";
import { hydrateEmpresaSapSnapshot, hydrateParceiroSapSnapshot } from "@/lib/contracts/sap-snapshot";
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
  const tipoParam = searchParams.get("tipo");
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

  let tipo: "saida_insumos" | "entrada_insumos" | null = null;
  if (tipoParam) {
    const parsedTipo = parseContratoTipo(tipoParam);
    if (!parsedTipo) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    }
    tipo = parsedTipo;
  }

  let exercicio: number | null = null;
  if (exercicioParam) {
    exercicio = Number.parseInt(exercicioParam, 10);
    if (Number.isNaN(exercicio) || exercicio < 2000 || exercicio > 2100) {
      return NextResponse.json({ error: "Exercício inválido." }, { status: 400 });
    }
  }

  try {
    const data = await listContratosSaidaInsumos({
      status,
      tipo,
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
    return NextResponse.json({ error: "Referência do contrato é obrigatória." }, { status: 400 });
  }
  if (!numero) {
    return NextResponse.json({ error: "Número é obrigatório na criação." }, { status: 400 });
  }

  try {
    const empresaSapInput = parseEmpresaSap(body.empresaSap);
    const parceiroSapInput = parseParceiroSap(body.parceiroSap);

    const [empresaSap, parceiroSap] = await Promise.all([
      hydrateEmpresaSapSnapshot(empresaSapInput),
      hydrateParceiroSapSnapshot(parceiroSapInput),
    ]);

    const created = await createContratoSaidaInsumos({
      tipoContrato: parseContratoTipo(body.tipoContrato),
      empresaId,
      empresaSap,
      parceiroId: parseOptionalPositiveInt(body.parceiroId),
      parceiroSap,
      exercicio: parseOptionalPositiveInt(body.exercicio),
      numero,
      referenciaContrato,
      refObjectId: toOptionalString(body.refObjectId),
      assinaturaEm: toOptionalString(body.assinaturaEm),
      prazoEntregaEm: toOptionalString(body.prazoEntregaEm),
      inicioEm: toOptionalString(body.inicioEm),
      vencimentoEm: toOptionalString(body.vencimentoEm),
      permuta: toOptionalBoolean(body.permuta),
      contratoPermutaId: parseOptionalPositiveInt(body.contratoPermutaId),
      aditivo: toOptionalBoolean(body.aditivo),
      tipoAditivo: toOptionalString(body.tipoAditivo) as
        | "nenhum"
        | "valor"
        | "prazo"
        | "quantidade"
        | "misto"
        | undefined,
      contratoCedenteId: parseOptionalPositiveInt(body.contratoCedenteId),
      contratoAnteriorId: parseOptionalPositiveInt(body.contratoAnteriorId),
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
      itens: parseLinhas(body.itens),
      fretes: parseLinhas(body.fretes),
      financeiros: parseLinhas(body.financeiros ?? body.financeiro),
      notas: parseLinhas(body.notas),
      clausulas: parseLinhas(body.clausulas),
      clausulaModeloId: parseOptionalPositiveInt(body.clausulaModeloId),
      clausulaTitulo: toOptionalString(body.clausulaTitulo),
      previsoes: parseLinhas(body.previsoes),
      mapas: parseLinhas(body.mapas),
      dadosGerais: parseDadosGerais(body.dadosGerais),
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
    rgIe: toOptionalString(row.rgIe) ?? null,
    telefone: toOptionalString(row.telefone) ?? null,
    email: toOptionalString(row.email) ?? null,
    representanteLegal: toOptionalString(row.representanteLegal) ?? null,
    endereco: toOptionalString(row.endereco) ?? null,
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

function parseDadosGerais(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const dados = value as Record<string, unknown>;
  const analises = Array.isArray(dados.analises)
    ? dados.analises
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            tipoAnalise: toOptionalString(row.tipoAnalise ?? row.tipo_analise) ?? null,
            valorMaximo: parseOptionalNumber(row.valorMaximo ?? row.valor_maximo) ?? null,
          };
        })
    : undefined;

  return {
    periodoProducao: toOptionalString(dados.periodoProducao),
    fazenda: toOptionalString(dados.fazenda),
    distanciaRaioKm: parseOptionalNumber(dados.distanciaRaioKm),
    programacaoRetirada: toOptionalString(dados.programacaoRetirada),
    programacaoPagamento: toOptionalString(dados.programacaoPagamento),
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

