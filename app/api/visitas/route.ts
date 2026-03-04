import { NextResponse } from "next/server";
import { createVisita, listVisitas } from "@/lib/repositories/visitas-repo";
import type { VisitaStatus, VisitaTipoContrato } from "@/lib/types/visita";

export const runtime = "nodejs";

const validStatus = new Set<VisitaStatus>([
  "oportunidade",
  "em_analise",
  "negociacao",
  "contrato_gerado",
  "perdida",
  "arquivada",
]);

const validTipoContrato = new Set<VisitaTipoContrato>(["entrada_animais"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 25), 100);

  if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
    return NextResponse.json({ error: "Paginacao invalida." }, { status: 400 });
  }

  let status: VisitaStatus | null = null;
  if (statusParam) {
    if (!validStatus.has(statusParam as VisitaStatus)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }
    status = statusParam as VisitaStatus;
  }

  try {
    const data = await listVisitas({
      status,
      search,
      page,
      pageSize,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar visitas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const empresaId = parseNonZeroInt(body.empresaId, NaN);
  const dataVisita = toOptionalString(body.dataVisita);

  if (!Number.isFinite(empresaId) || empresaId === 0) {
    return NextResponse.json({ error: "empresaId e obrigatorio." }, { status: 400 });
  }
  if (!dataVisita) {
    return NextResponse.json({ error: "dataVisita e obrigatoria." }, { status: 400 });
  }

  const status = toOptionalString(body.status) as VisitaStatus | undefined;
  if (status && !validStatus.has(status)) {
    return NextResponse.json({ error: "status invalido." }, { status: 400 });
  }

  const tipoContrato = toOptionalString(body.tipoContratoSugerido) as VisitaTipoContrato | undefined;
  if (tipoContrato && !validTipoContrato.has(tipoContrato)) {
    return NextResponse.json({ error: "tipoContratoSugerido invalido." }, { status: 400 });
  }

  try {
    const created = await createVisita({
      empresaId,
      status,
      dataVisita,
      parceiroId: parseOptionalNullablePositiveInt(body.parceiroId),
      parceiroCodigo: parseOptionalNullableString(body.parceiroCodigo),
      parceiroNome: parseOptionalNullableString(body.parceiroNome),
      responsavelId: parseOptionalNullablePositiveInt(body.responsavelId),
      responsavelCodigo: parseOptionalNullableString(body.responsavelCodigo),
      responsavelNome: parseOptionalNullableString(body.responsavelNome),
      cep: parseOptionalNullableString(body.cep),
      endereco: parseOptionalNullableString(body.endereco),
      complemento: parseOptionalNullableString(body.complemento),
      bairro: parseOptionalNullableString(body.bairro),
      cidade: parseOptionalNullableString(body.cidade),
      estado: parseOptionalNullableString(body.estado),
      telefone: parseOptionalNullableString(body.telefone),
      email: parseOptionalNullableString(body.email),
      rebanhoAtual: parseOptionalNumber(body.rebanhoAtual) ?? 0,
      informacoesDetalhadas: parseOptionalNullableString(body.informacoesDetalhadas),
      categoria: parseOptionalNullableString(body.categoria),
      raca: parseOptionalNullableString(body.raca),
      observacoes: parseOptionalNullableString(body.observacoes),
      tipoContratoSugerido: tipoContrato,
      atividades: parseAtividades(body.atividades),
      categoriaItens: parseCategoriaItens(body.categoriaItens),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar visita.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseNonZeroInt(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed === 0 ? fallback : parsed;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseOptionalNullablePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length === 0 ? undefined : text;
}

function parseOptionalNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function parseAtividades(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        tipoAtividade: String(row.tipoAtividade ?? "").trim(),
        dataVencimento: String(row.dataVencimento ?? "").trim(),
        resumo: String(row.resumo ?? "").trim(),
        responsavel: String(row.responsavel ?? "").trim(),
        dataRealizacao: String(row.dataRealizacao ?? "").trim(),
        descricaoAtividade: String(row.descricaoAtividade ?? "").trim(),
      };
    });
}

function parseCategoriaItens(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        categoria: String(row.categoria ?? "").trim(),
        raca: String(row.raca ?? "").trim(),
        qualidade: String(row.qualidade ?? "").trim(),
        condicaoPagto: String(row.condicaoPagto ?? "").trim(),
        pesoAproxArroba: String(row.pesoAproxArroba ?? "").trim(),
        rcPercentual: String(row.rcPercentual ?? "").trim(),
        valorArroba: String(row.valorArroba ?? "").trim(),
        valorTabelaArroba: String(row.valorTabelaArroba ?? "").trim(),
        freteArroba: String(row.freteArroba ?? "").trim(),
        valorIcmsArroba: String(row.valorIcmsArroba ?? "").trim(),
        cabecas: String(row.cabecas ?? "").trim(),
      };
    });
}
