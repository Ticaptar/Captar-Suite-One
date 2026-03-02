import { NextResponse } from "next/server";
import {
  getContratoSaidaInsumosById,
  updateContratoSaidaInsumos,
} from "@/lib/repositories/contratos-saida-insumos-repo";

export const runtime = "nodejs";
const RESPONSAVEL_JURIDICO_FIXO = "CAMILA CARMO DE CARVALHO - 05500424580";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const contratoId = Number.parseInt(id, 10);

  if (Number.isNaN(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const data = await getContratoSaidaInsumosById(contratoId);
    if (!data) {
      return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const contratoId = Number.parseInt(id, 10);

  if (Number.isNaN(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  try {
    const updated = await updateContratoSaidaInsumos(contratoId, {
      parceiroId: parseOptionalPositiveInt(body.parceiroId),
      referenciaContrato: toOptionalString(body.referenciaContrato),
      refObjectId: body.refObjectId === null ? null : toOptionalString(body.refObjectId),
      assinaturaEm: body.assinaturaEm === null ? null : toOptionalString(body.assinaturaEm),
      prazoEntregaEm: body.prazoEntregaEm === null ? null : toOptionalString(body.prazoEntregaEm),
      inicioEm: body.inicioEm === null ? null : toOptionalString(body.inicioEm),
      vencimentoEm: body.vencimentoEm === null ? null : toOptionalString(body.vencimentoEm),
      permuta: toOptionalBoolean(body.permuta),
      contratoPermutaId: parseOptionalNullablePositiveInt(body.contratoPermutaId),
      aditivo: toOptionalBoolean(body.aditivo),
      tipoAditivo: toOptionalString(body.tipoAditivo) as
        | "nenhum"
        | "valor"
        | "prazo"
        | "quantidade"
        | "misto"
        | undefined,
      contratoCedenteId: parseOptionalNullablePositiveInt(body.contratoCedenteId),
      contratoAnteriorId: parseOptionalNullablePositiveInt(body.contratoAnteriorId),
      valor: parseOptionalNumber(body.valor),
      valorMaoObra: parseOptionalNumber(body.valorMaoObra),
      responsavelFrete: toOptionalString(body.responsavelFrete) as "empresa" | "parceiro" | "terceiro" | undefined,
      calculoFrete: toOptionalString(body.calculoFrete) as
        | "fixo"
        | "por_tonelada"
        | "por_unidade"
        | "por_km"
        | "sem_frete"
        | undefined,
      valorUnitarioFrete: parseOptionalNumber(body.valorUnitarioFrete),
      emissorNota: toOptionalString(body.emissorNota) as "empresa" | "parceiro" | "terceiro" | undefined,
      assinaturaParceiro: parseOptionalNullableString(body.assinaturaParceiro),
      assinaturaEmpresa: parseOptionalNullableString(body.assinaturaEmpresa),
      comissionadoTipo: toOptionalString(body.comissionadoTipo) as
        | "nao_aplica"
        | "interno"
        | "parceiro"
        | "corretor"
        | undefined,
      comissionadoNome: parseOptionalNullableString(body.comissionadoNome),
      valorComissao: parseOptionalNumber(body.valorComissao),
      responsavelJuridicoNome: RESPONSAVEL_JURIDICO_FIXO,
      testemunha1Nome: parseOptionalNullableString(body.testemunha1Nome),
      testemunha1Cpf: parseOptionalNullableString(body.testemunha1Cpf),
      testemunha2Nome: parseOptionalNullableString(body.testemunha2Nome),
      testemunha2Cpf: parseOptionalNullableString(body.testemunha2Cpf),
      objeto: parseOptionalNullableString(body.objeto),
      execucao: parseOptionalNullableString(body.execucao),
      observacoes: parseOptionalNullableString(body.observacoes),
      sapDocEntry: parseOptionalNullablePositiveInt(body.sapDocEntry),
      sapDocNum: parseOptionalNullablePositiveInt(body.sapDocNum),
      sapValorPago: parseOptionalNumber(body.sapValorPago),
      sapUltimoSyncEm: parseOptionalNullableString(body.sapUltimoSyncEm),
      atualizadoPor: parseOptionalNullableString(body.atualizadoPor),
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar contrato.";
    if (message.toLowerCase().includes("nao encontrado") || message.toLowerCase().includes("não encontrado")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.toLowerCase().includes("nenhum campo")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseOptionalNullablePositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(String(value));
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = String(value).trim();
  return parsed.length === 0 ? undefined : parsed;
}

function parseOptionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = String(value).trim();
  return parsed.length === 0 ? null : parsed;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return undefined;
}

