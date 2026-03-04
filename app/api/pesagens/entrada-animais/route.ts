import { NextResponse } from "next/server";
import {
  createPesagemEntradaAnimais,
  listPesagensEntradaAnimais,
} from "@/lib/repositories/pesagens-entrada-animais-repo";
import type { PesagemStatus } from "@/lib/types/pesagem";

export const runtime = "nodejs";

const validStatus = new Set<PesagemStatus>([
  "disponivel",
  "peso_finalizado",
  "fechado",
  "cancelado",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 25), 100);
  const search = searchParams.get("search");
  const statusParam = searchParams.get("status");

  let status: PesagemStatus | null = null;
  if (statusParam) {
    if (!validStatus.has(statusParam as PesagemStatus)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }
    status = statusParam as PesagemStatus;
  }

  try {
    const data = await listPesagensEntradaAnimais({
      status,
      search,
      page,
      pageSize,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar pesagens.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const status = toOptionalString(body.status) as PesagemStatus | undefined;
  if (status && !validStatus.has(status)) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  try {
    const created = await createPesagemEntradaAnimais({
      status,
      tipo: "entrada_animais",
      numeroTicket: toOptionalNullableString(body.numeroTicket),
      contratoId: parseOptionalNullablePositiveInt(body.contratoId),
      contratoReferencia: toOptionalNullableString(body.contratoReferencia),
      itemId: parseOptionalNullablePositiveInt(body.itemId),
      itemDescricao: toOptionalNullableString(body.itemDescricao),
      fazendaId: parseOptionalNullablePositiveInt(body.fazendaId),
      fazendaNome: toOptionalNullableString(body.fazendaNome),
      tipoFrete: toOptionalNullableString(body.tipoFrete),
      responsavelFrete: toOptionalNullableString(body.responsavelFrete),
      transportadorId: parseOptionalNullablePositiveInt(body.transportadorId),
      transportadorNome: toOptionalNullableString(body.transportadorNome),
      contratanteId: parseOptionalNullablePositiveInt(body.contratanteId),
      contratanteNome: toOptionalNullableString(body.contratanteNome),
      motoristaId: parseOptionalNullablePositiveInt(body.motoristaId),
      motoristaNome: toOptionalNullableString(body.motoristaNome),
      dataChegada: toOptionalNullableString(body.dataChegada),
      horaChegada: toOptionalNullableString(body.horaChegada),
      dataSaida: toOptionalNullableString(body.dataSaida),
      horaSaida: toOptionalNullableString(body.horaSaida),
      placa: toOptionalNullableString(body.placa),
      equipamentoId: parseOptionalNullablePositiveInt(body.equipamentoId),
      equipamentoNome: toOptionalNullableString(body.equipamentoNome),
      viagem: toOptionalNullableString(body.viagem),
      dataInicio: toOptionalNullableString(body.dataInicio),
      dataFim: toOptionalNullableString(body.dataFim),
      kmInicial: parseOptionalNumber(body.kmInicial),
      kmFinal: parseOptionalNumber(body.kmFinal),
      kmTotal: parseOptionalNumber(body.kmTotal),
      observacao: toOptionalNullableString(body.observacao),
      pesoBruto: parseOptionalNumber(body.pesoBruto),
      pesoTara: parseOptionalNumber(body.pesoTara),
      pesoLiquido: parseOptionalNumber(body.pesoLiquido),
      operacao: toOptionalNullableString(body.operacao),
      documentosFiscais: parseDocumentos(body.documentosFiscais),
      motivosAtraso: parseMotivos(body.motivosAtraso),
      motivosEspera: parseMotivos(body.motivosEspera),
      calendario: parseCalendario(body.calendario),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar pesagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseOptionalNullablePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  const parsed = Number(text.replace(/\./g, "").replace(",", "."));
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

function parseDocumentos(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return { documento: String(row.documento ?? "").trim() };
    });
}

function parseMotivos(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        motivo: String(row.motivo ?? "").trim(),
        tempoMinutos: Number.parseInt(String(row.tempoMinutos ?? 0), 10) || 0,
      };
    });
}

function parseCalendario(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        data: String(row.data ?? "").trim(),
        dia: String(row.dia ?? "").trim(),
        feriado: toBoolean(row.feriado),
        pago: toBoolean(row.pago),
        valor: parseOptionalNumber(row.valor) ?? 0,
      };
    });
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").toLowerCase().trim();
  return normalized === "true" || normalized === "1" || normalized === "sim";
}
