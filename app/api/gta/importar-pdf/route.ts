import { NextResponse } from "next/server";
import { parseGtaPdfFromBytes } from "@/lib/gta-pdf-parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo PDF nao informado." }, { status: 400 });
    }

    const fileName = (file.name ?? "").toLowerCase();
    if (!fileName.endsWith(".pdf")) {
      return NextResponse.json({ error: "Formato invalido. Envie um arquivo PDF." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
    }

    const parsed = await parseGtaPdfFromBytes(bytes);
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar PDF da GTA.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
