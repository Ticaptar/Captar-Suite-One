import { NextResponse } from "next/server";
import { listPesagemEntradaAnimaisOptions } from "@/lib/repositories/pesagens-entrada-animais-repo";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await listPesagemEntradaAnimaisOptions();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar opcoes da pesagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
