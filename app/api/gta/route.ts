import { NextResponse } from "next/server";
import { createGta, listGtas } from "@/lib/repositories/gta-repo";
import type { GtaStatus, GtaTipo } from "@/lib/types/gta";

export const runtime = "nodejs";

const validTipos = new Set<GtaTipo>(["entrada", "saida", "temporaria"]);
const validStatus = new Set<GtaStatus>(["ativo", "cancelado", "desembarcado", "encerrado"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 25), 100);
  const search = searchParams.get("search");
  const tipoParam = searchParams.get("tipo");
  const statusParam = searchParams.get("status");

  let tipo: GtaTipo | null = null;
  if (tipoParam) {
    if (!validTipos.has(tipoParam as GtaTipo)) {
      return NextResponse.json({ error: "Tipo invalido." }, { status: 400 });
    }
    tipo = tipoParam as GtaTipo;
  }

  let status: GtaStatus | null = null;
  if (statusParam) {
    if (!validStatus.has(statusParam as GtaStatus)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }
    status = statusParam as GtaStatus;
  }

  try {
    const data = await listGtas({
      tipo,
      status,
      search,
      page,
      pageSize,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar GTA.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const created = await createGta({
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
      eras: parseEras(body.eras),
      gtaTemporariaRows: parseTemporariaRows(body.gtaTemporariaRows),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar GTA.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseOptionalInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
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

function toOptionalNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
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
