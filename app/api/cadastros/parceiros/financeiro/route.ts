import { NextResponse } from "next/server";
import { getBusinessPartnerFinanceDefaultsFromSap, isSapServiceLayerConfigured } from "@/lib/sap-service-layer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const referencia = searchParams.get("referencia")?.trim() ?? "";

  if (!referencia) {
    return NextResponse.json({ error: "Referencia do parceiro e obrigatoria." }, { status: 400 });
  }

  if (!isSapServiceLayerConfigured()) {
    return NextResponse.json({
      condicaoPagamento: "",
      formaPagamento: "",
      formasPagamento: [],
      banco: "",
      agencia: "",
      conta: "",
      digito: "",
    });
  }

  try {
    const defaults = await getBusinessPartnerFinanceDefaultsFromSap(referencia);
    return NextResponse.json({
      condicaoPagamento: defaults?.condicaoPagamento ?? "",
      formaPagamento: defaults?.formaPagamento ?? "",
      condicaoPagamentoCode: defaults?.condicaoPagamentoCode ?? "",
      formaPagamentoCode: defaults?.formaPagamentoCode ?? "",
      formasPagamento: defaults?.formasPagamento ?? [],
      banco: defaults?.banco ?? "",
      agencia: defaults?.agencia ?? "",
      conta: defaults?.conta ?? "",
      digito: defaults?.digito ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar padrao financeiro do parceiro.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
