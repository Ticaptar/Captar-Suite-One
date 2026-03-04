import { NextResponse } from "next/server";
import { getVisitaById, updateVisita } from "@/lib/repositories/visitas-repo";
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

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const visitaId = Number.parseInt(id, 10);

  if (Number.isNaN(visitaId) || visitaId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  try {
    const data = await getVisitaById(visitaId);
    if (!data) {
      return NextResponse.json({ error: "Visita nao encontrada." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar visita.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const visitaId = Number.parseInt(id, 10);
  if (Number.isNaN(visitaId) || visitaId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
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
    const updated = await updateVisita(visitaId, {
      empresaId: parseOptionalNonZeroInt(body.empresaId),
      status,
      dataVisita: toOptionalString(body.dataVisita),
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
      rebanhoAtual: parseOptionalNumber(body.rebanhoAtual),
      informacoesDetalhadas: parseOptionalNullableString(body.informacoesDetalhadas),
      categoria: parseOptionalNullableString(body.categoria),
      raca: parseOptionalNullableString(body.raca),
      observacoes: parseOptionalNullableString(body.observacoes),
      tipoContratoSugerido: tipoContrato,
      atividades: body.atividades !== undefined ? parseAtividades(body.atividades) : undefined,
      categoriaItens: body.categoriaItens !== undefined ? parseCategoriaItens(body.categoriaItens) : undefined,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar visita.";
    const messageLower = message.toLowerCase();
    const statusCode = messageLower.includes("nao encontrada")
      ? 404
      : messageLower.includes("nao pode ser editada")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

function parseOptionalNonZeroInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed === 0 ? undefined : parsed;
}

function parseOptionalNullablePositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length === 0 ? undefined : text;
}

function parseOptionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
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
