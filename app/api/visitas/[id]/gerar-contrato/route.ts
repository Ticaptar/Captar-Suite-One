import { NextResponse } from "next/server";
import { createContratoEntradaAnimais } from "@/lib/repositories/contratos-entrada-animais-repo";
import { createContratoSaidaInsumos } from "@/lib/repositories/contratos-saida-insumos-repo";
import { getVisitaById, markVisitaContratoGerado } from "@/lib/repositories/visitas-repo";
import type { VisitaTipoContrato } from "@/lib/types/visita";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const visitaId = Number.parseInt(id, 10);
  if (Number.isNaN(visitaId) || visitaId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const tipoBody = String(body?.tipoContrato ?? "").trim();
  const tipoContrato: VisitaTipoContrato =
    tipoBody === "saida_insumos" || tipoBody === "entrada_animais"
      ? (tipoBody as VisitaTipoContrato)
      : "entrada_animais";

  try {
    const visitaData = await getVisitaById(visitaId);
    if (!visitaData) {
      return NextResponse.json({ error: "Visita nao encontrada." }, { status: 404 });
    }

    const visita = visitaData.visita;
    if (visita.contratoGeradoId) {
      const existingTipo = visita.tipoContratoSugerido === "saida_insumos" ? "saida_insumos" : "entrada_animais";
      return NextResponse.json(
        {
          visitaId,
          contratoId: visita.contratoGeradoId,
          tipoContrato: existingTipo,
          url:
            existingTipo === "saida_insumos"
              ? `/contratos/saida-insumos?created=${visita.contratoGeradoId}`
              : `/contratos/entrada-animais?created=${visita.contratoGeradoId}`,
          jaExistente: true,
        },
        { status: 200 },
      );
    }

    const referenciaBase = `VISITA ${visita.id} - ${visita.parceiroNome ?? "LEAD"}`.slice(0, 80);
    const exercicio = resolveExercicio(visita.dataVisita);

    const contratoCriado =
      tipoContrato === "saida_insumos"
        ? await createContratoSaidaInsumos({
            empresaId: visita.empresaId,
            parceiroId: visita.parceiroId ?? undefined,
            exercicio,
            referenciaContrato: referenciaBase,
            inicioEm: visita.dataVisita ?? undefined,
            assinaturaEm: visita.dataVisita ?? undefined,
            prazoEntregaEm: visita.dataVisita ?? undefined,
            observacoes: `Gerado automaticamente da visita #${visita.id}.`,
          })
        : await createContratoEntradaAnimais({
            empresaId: visita.empresaId,
            parceiroId: visita.parceiroId ?? undefined,
            exercicio,
            referenciaContrato: referenciaBase,
            inicioEm: visita.dataVisita ?? undefined,
            assinaturaEm: visita.dataVisita ?? undefined,
            prazoEntregaEm: visita.dataVisita ?? undefined,
            observacoes: `Gerado automaticamente da visita #${visita.id}.`,
            dadosGerais: {
              quantidadeNegociada: visita.rebanhoAtual,
              categoria: visita.categoria,
              racaPredominante: visita.raca,
            },
          });

    const contratoId = extractContratoId(contratoCriado);
    if (!Number.isFinite(contratoId) || contratoId <= 0) {
      throw new Error("Falha ao recuperar o ID do contrato gerado.");
    }

    await markVisitaContratoGerado(visitaId, contratoId);

    return NextResponse.json(
      {
        visitaId,
        contratoId,
        tipoContrato,
        url:
          tipoContrato === "saida_insumos"
            ? `/contratos/saida-insumos?created=${contratoId}`
            : `/contratos/entrada-animais?created=${contratoId}`,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function resolveExercicio(dataVisita: string | null): number {
  if (!dataVisita) return new Date().getFullYear();
  const date = new Date(dataVisita);
  if (Number.isNaN(date.getTime())) return new Date().getFullYear();
  return date.getFullYear();
}

function extractContratoId(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const obj = payload as Record<string, unknown>;
  if ("id" in obj) {
    const parsed = Number(obj.id);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if ("contratoId" in obj) {
    const parsed = Number(obj.contratoId);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if ("contrato" in obj && obj.contrato && typeof obj.contrato === "object") {
    const contrato = obj.contrato as Record<string, unknown>;
    const parsed = Number(contrato.id);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}
