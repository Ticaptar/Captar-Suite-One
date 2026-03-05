import { NextResponse } from "next/server";
import { listPesagemSaidaInsumosOptions } from "@/lib/repositories/pesagens-saida-insumos-repo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contratoSearch = searchParams.get("contratoSearch");
  const contratoLimit = parsePositiveInt(searchParams.get("contratoLimit"));

  try {
    const data = await listPesagemSaidaInsumosOptions({
      contratoSearch,
      contratoLimit,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar opcoes da pesagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}


