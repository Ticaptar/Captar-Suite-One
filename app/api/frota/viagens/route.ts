import { NextResponse } from "next/server";
import { createFrotaViagem, listFrotaViagens } from "@/lib/repositories/frota-viagem-repo";
import type { FrotaViagemStatus } from "@/lib/types/frota-viagem";

export const runtime = "nodejs";

const validStatus = new Set<FrotaViagemStatus>(["rascunho", "aprovado", "encerrado", "cancelado"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 25), 100);
  const search = searchParams.get("search");
  const statusParam = searchParams.get("status");

  let status: FrotaViagemStatus | null = null;
  if (statusParam) {
    if (!validStatus.has(statusParam as FrotaViagemStatus)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }
    status = statusParam as FrotaViagemStatus;
  }

  try {
    const data = await listFrotaViagens({
      status,
      search,
      page,
      pageSize,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar viagens.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const status = toOptionalString(body.status) as FrotaViagemStatus | undefined;
  if (status && !validStatus.has(status)) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  try {
    const created = await createFrotaViagem({
      numero: toOptionalNullableString(body.numero),
      status,
      equipamentoId: toOptionalNullableString(body.equipamentoId),
      equipamentoDescricao: toOptionalNullableString(body.equipamentoDescricao),
      reboque: toOptionalNullableString(body.reboque),
      rota: toOptionalNullableString(body.rota),
      motorista: toOptionalNullableString(body.motorista),
      responsavel: toOptionalNullableString(body.responsavel),
      contratoId: parseOptionalNullableNonZeroInt(body.contratoId),
      contratoReferencia: toOptionalNullableString(body.contratoReferencia),
      transportadorId: parseOptionalNullableNonZeroInt(body.transportadorId),
      transportadorNome: toOptionalNullableString(body.transportadorNome),
      dataSaida: toOptionalNullableString(body.dataSaida),
      dataRetorno: toOptionalNullableString(body.dataRetorno),
      dataValidade: toOptionalNullableString(body.dataValidade),
      motivo: toOptionalNullableString(body.motivo),
      localOrigem: toOptionalNullableString(body.localOrigem),
      localDestino: toOptionalNullableString(body.localDestino),
      condicaoPagamentoId: toOptionalNullableString(body.condicaoPagamentoId),
      condicaoPagamento: toOptionalNullableString(body.condicaoPagamento),
      excessos: toOptionalNullableString(body.excessos),
      kmPrevisto: parseOptionalNumber(body.kmPrevisto),
      kmReal: parseOptionalNumber(body.kmReal),
      pesoPrevisto: parseOptionalNumber(body.pesoPrevisto),
      pesoRealizado: parseOptionalNumber(body.pesoRealizado),
      cidadeOrigemCodigo: toOptionalNullableString(body.cidadeOrigemCodigo),
      cidadeOrigemNome: toOptionalNullableString(body.cidadeOrigemNome),
      cidadeDestinoCodigo: toOptionalNullableString(body.cidadeDestinoCodigo),
      cidadeDestinoNome: toOptionalNullableString(body.cidadeDestinoNome),
      odometroSaida: parseOptionalNumber(body.odometroSaida),
      observacao: toOptionalNullableString(body.observacao),
      declaracaoResponsabilidade: toOptionalNullableString(body.declaracaoResponsabilidade),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar viagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseOptionalNullableNonZeroInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return parsed;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function toOptionalNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}
