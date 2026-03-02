import { NextResponse } from "next/server";
import { changeContratoSaidaInsumosStatus } from "@/lib/repositories/contratos-saida-insumos-repo";
import type { ContratoStatus } from "@/lib/types/contrato";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const validStatus: ContratoStatus[] = [
  "aguardando_aprovacao",
  "ativo",
  "contendo_parc",
  "encerrado",
  "inativo_cancelado",
];

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const contratoId = Number.parseInt(id, 10);

  if (Number.isNaN(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    status?: ContratoStatus;
    motivo?: string | null;
    alteradoPor?: string | null;
  } | null;

  if (!body?.status || !validStatus.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  try {
    const updated = await changeContratoSaidaInsumosStatus(contratoId, {
      status: body.status,
      motivo: body.motivo ?? null,
      alteradoPor: body.alteradoPor ?? null,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao alterar status.";
    if (message.toLowerCase().includes("nao encontrado") || message.toLowerCase().includes("não encontrado")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

