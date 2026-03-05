import { NextResponse } from "next/server";
import { getFrotaViagemById, updateFrotaViagem } from "@/lib/repositories/frota-viagem-repo";
import type { FrotaViagemStatus } from "@/lib/types/frota-viagem";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const validStatus = new Set<FrotaViagemStatus>(["rascunho", "aprovado", "encerrado", "cancelado"]);

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  try {
    const data = await getFrotaViagemById(parsedId);
    if (!data) {
      return NextResponse.json({ error: "Viagem nao encontrada." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar viagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const status = toOptionalString(body.status) as FrotaViagemStatus | undefined;
  if (status && !validStatus.has(status)) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  try {
    const updated = await updateFrotaViagem(parsedId, {
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

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar viagem.";
    const statusCode = message.toLowerCase().includes("nao encontrada") ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

function parseOptionalNullableNonZeroInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return parsed;
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
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

function toOptionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}
