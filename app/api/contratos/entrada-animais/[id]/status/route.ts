import { NextResponse } from "next/server";
import {
  changeContratoEntradaAnimaisStatus,
  getContratoEntradaAnimaisById,
} from "@/lib/repositories/contratos-entrada-animais-repo";
import { gerarPedidoCompraSapPorContrato, getPedidoExistenteFromContrato } from "@/lib/contracts/sap-pedido-compra";
import { saveContratoSapPedido } from "@/lib/repositories/contratos-sap-pedido-repo";
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
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    status?: ContratoStatus;
    motivo?: string | null;
    alteradoPor?: string | null;
    gerarPedido?: boolean;
    forcarGeracao?: boolean;
  } | null;

  if (!body?.status || !validStatus.includes(body.status)) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  try {
    let sapPedido:
      | {
          docEntry: number | null;
          docNum: number | null;
          cardCode?: string;
          lineCount?: number;
          jaExistente: boolean;
        }
      | null = null;

    if (body.gerarPedido && body.status === "ativo") {
      const contratoAtual = await getContratoEntradaAnimaisById(contratoId);
      if (!contratoAtual) {
        return NextResponse.json({ error: "Contrato nao encontrado." }, { status: 404 });
      }

      const statusAtual = normalizeStatusValue((contratoAtual as { status?: string | null }).status);
      if (statusAtual === "ativo" && !body.forcarGeracao) {
        return NextResponse.json(
          { error: "Contrato ja esta ativo. Geracao de novo pedido bloqueada para evitar duplicidade." },
          { status: 409 },
        );
      }

      const pedidoExistente = getPedidoExistenteFromContrato(contratoAtual);
      if (pedidoExistente && !body.forcarGeracao) {
        sapPedido = { ...pedidoExistente, jaExistente: true };
      } else {
        const pedidoGerado = await gerarPedidoCompraSapPorContrato(contratoAtual);
        await saveContratoSapPedido(contratoId, {
          docEntry: pedidoGerado.docEntry,
          docNum: pedidoGerado.docNum,
          objectName: "PurchaseOrders",
          createdBy: body.alteradoPor ?? null,
          approvedBy: body.alteradoPor ?? null,
        });
        sapPedido = {
          docEntry: pedidoGerado.docEntry,
          docNum: pedidoGerado.docNum,
          cardCode: pedidoGerado.cardCode,
          lineCount: pedidoGerado.lineCount,
          jaExistente: false,
        };
      }
    }

    const updated = await changeContratoEntradaAnimaisStatus(contratoId, {
      status: body.status,
      motivo: body.motivo ?? null,
      alteradoPor: body.alteradoPor ?? null,
    });

    return NextResponse.json({ ...updated, sapPedido });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao alterar status.";
    if (message.toLowerCase().includes("nao encontrado") || message.toLowerCase().includes("não encontrado")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Params) {
  return POST(request, context);
}

function normalizeStatusValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\/\s]+/g, "_");
}
