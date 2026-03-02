import { NextResponse } from "next/server";
import {
  createContratoSaidaInsumos,
  listContratosSaidaInsumos,
} from "@/lib/repositories/contratos-saida-insumos-repo";
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
    const data = await listContratosSaidaInsumos({
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
    const created = await createContratoSaidaInsumos({
      empresaId,
      empresaSap: parseEmpresaSap(body.empresaSap),
      parceiroId: parseOptionalPositiveInt(body.parceiroId),
      parceiroSap: parseParceiroSap(body.parceiroSap),
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
        | undefined,
      valorUnitarioFrete: parseOptionalNumber(body.valorUnitarioFrete),
      emissorNota: toOptionalString(body.emissorNota) as "empresa" | "parceiro" | "terceiro" | undefined,
      assinaturaParceiro: toOptionalString(body.assinaturaParceiro),
      assinaturaEmpresa: toOptionalString(body.assinaturaEmpresa),
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

