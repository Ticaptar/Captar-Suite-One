import { NextResponse } from "next/server";
import { listFrotaContratoOptions } from "@/lib/repositories/frota-viagem-repo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contratoSearch = searchParams.get("contratoSearch");
  const contratoLimit = parsePositiveInt(searchParams.get("contratoLimit"));

  try {
    const contratos = await listFrotaContratoOptions({
      search: contratoSearch,
      limit: contratoLimit,
    });

    return NextResponse.json({
      contratos,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar opcoes de viagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}
