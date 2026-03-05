import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceSimulado = searchParams.get("simulado") === "1";

  const fixed = parseNumber(searchParams.get("fixed")) ?? parseNumber(process.env.PESAGEM_CAPTURA_PESO_FIXO);
  if (fixed !== null) {
    return NextResponse.json({
      peso: round2(fixed),
      capturedAt: new Date().toISOString(),
      source: "fixed",
    });
  }

  if (!forceSimulado) {
    if (!process.env.URL_BALANCA?.trim()) {
      return NextResponse.json(
        { error: "URL_BALANCA nao configurada para captura automatica de peso." },
        { status: 503 },
      );
    }

    const pesoBalanca = await readPesoFromBalanca();
    if (pesoBalanca !== null) {
      return NextResponse.json({
        peso: round2(pesoBalanca),
        capturedAt: new Date().toISOString(),
        source: "balanca",
      });
    }

    return NextResponse.json(
      { error: "Nao foi possivel ler o peso na balanca no momento." },
      { status: 503 },
    );
  }

  const min =
    parseNumber(searchParams.get("min")) ??
    parseNumber(process.env.PESAGEM_CAPTURA_PESO_MIN) ??
    42000;
  const max =
    parseNumber(searchParams.get("max")) ??
    parseNumber(process.env.PESAGEM_CAPTURA_PESO_MAX) ??
    52000;

  const normalizedMin = Number.isFinite(min) ? min : 42000;
  const normalizedMax = Number.isFinite(max) && max > normalizedMin ? max : normalizedMin + 1000;
  const peso = normalizedMin + Math.random() * (normalizedMax - normalizedMin);

  return NextResponse.json({
    peso: round2(peso),
    capturedAt: new Date().toISOString(),
    source: "simulado",
  });
}

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function readPesoFromBalanca(): Promise<number | null> {
  const url = process.env.URL_BALANCA?.trim();
  if (!url) return null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | null;
      const parsedFromJson = parsePesoFromJson(body);
      if (parsedFromJson !== null) return parsedFromJson;
    }

    const text = await response.text();
    return parsePesoFromString(text);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parsePesoFromJson(
  body: Record<string, unknown> | Array<Record<string, unknown>> | null,
): number | null {
  if (!body) return null;
  if (Array.isArray(body)) {
    for (const item of body) {
      const found = parsePesoFromJson(item);
      if (found !== null) return found;
    }
    return null;
  }

  const keys = ["peso", "weight", "value", "bruto", "tara", "liquido"];
  for (const key of keys) {
    const parsed = parseNumber(toStringValue(body[key]));
    if (parsed !== null) return parsed;
  }

  for (const value of Object.values(body)) {
    const parsed =
      typeof value === "object"
        ? parsePesoFromJson(value as Record<string, unknown>)
        : parsePesoFromString(toStringValue(value));
    if (parsed !== null) return parsed;
  }

  return null;
}

function parsePesoFromString(value: string): number | null {
  if (!value) return null;
  const numericTokens = value.match(/-?\d+(?:[.,]\d+)?/g);
  if (!numericTokens || numericTokens.length === 0) return null;
  const parsedNumbers = numericTokens
    .map((token) => parseNumber(token))
    .filter((token): token is number => token !== null);
  if (parsedNumbers.length === 0) return null;
  return parsedNumbers[parsedNumbers.length - 1];
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

