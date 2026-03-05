import { NextResponse } from "next/server";
import { getGtaById, updateGta } from "@/lib/repositories/gta-repo";
import type { GtaStatus, GtaTipo } from "@/lib/types/gta";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const validTipos = new Set<GtaTipo>(["entrada", "saida", "temporaria"]);
const validStatus = new Set<GtaStatus>(["ativo", "cancelado", "desembarcado", "encerrado"]);

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  try {
    const data = await getGtaById(parsedId);
    if (!data) {
      return NextResponse.json({ error: "GTA nao encontrada." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar GTA.";
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

  const tipo = toOptionalString(body.tipo) as GtaTipo | undefined;
  if (tipo && !validTipos.has(tipo)) {
    return NextResponse.json({ error: "Tipo invalido." }, { status: 400 });
  }

  const status = toOptionalString(body.status) as GtaStatus | undefined;
  if (status && !validStatus.has(status)) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  try {
    const updated = await updateGta(parsedId, {
      tipo,
      status,
      numero: toOptionalNullableString(body.numero),
      serie: toOptionalNullableString(body.serie),
      local: toOptionalNullableString(body.local),
      contrato: toOptionalNullableString(body.contrato),
      estado: toOptionalNullableString(body.estado),
      especie: toOptionalNullableString(body.especie),
      finalidade: toOptionalNullableString(body.finalidade),
      transporte: toOptionalNullableString(body.transporte),
      dataEmissao: toOptionalNullableString(body.dataEmissao),
      horaEmissao: toOptionalNullableString(body.horaEmissao),
      dataValidade: toOptionalNullableString(body.dataValidade),
      quantidadeMachos: parseOptionalInteger(body.quantidadeMachos),
      quantidadeFemeas: parseOptionalInteger(body.quantidadeFemeas),
      total: parseOptionalInteger(body.total),
      totalEntrada: parseOptionalInteger(body.totalEntrada),
      totalIdentificados: parseOptionalInteger(body.totalIdentificados),
      totalPesagem: parseOptionalInteger(body.totalPesagem),
      proprietario: toOptionalNullableString(body.proprietario),
      produtor: toOptionalNullableString(body.produtor),
      propriedadeOrigem: toOptionalNullableString(body.propriedadeOrigem),
      vendaInterna: parseOptionalBoolean(body.vendaInterna),
      animaisRastreados: parseOptionalBoolean(body.animaisRastreados),
      valorGta: parseOptionalNumber(body.valorGta),
      eras: body.eras !== undefined ? parseEras(body.eras) : undefined,
      gtaTemporariaRows:
        body.gtaTemporariaRows !== undefined ? parseTemporariaRows(body.gtaTemporariaRows) : undefined,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar GTA.";
    const code = message.toLowerCase().includes("nao encontrada") ? 404 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}

function parseOptionalInteger(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
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

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").toLowerCase().trim();
  if (!normalized) return undefined;
  return normalized === "1" || normalized === "true" || normalized === "sim" || normalized === "s";
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

function parseEras(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        era: String(row.era ?? "").trim(),
        quantidade: parseOptionalInteger(row.quantidade) ?? 0,
        quantidadeEntrada: parseOptionalInteger(row.quantidadeEntrada) ?? 0,
        quantidadeIdentificado: parseOptionalInteger(row.quantidadeIdentificado) ?? 0,
      };
    });
}

function parseTemporariaRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        descricao: String(row.descricao ?? row.gtaTemporaria ?? "").trim(),
        quantidade: parseOptionalInteger(row.quantidade) ?? 0,
        quantidadeEntrada: parseOptionalInteger(row.quantidadeEntrada) ?? 0,
      };
    });
}
