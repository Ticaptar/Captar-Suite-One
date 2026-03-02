import { NextResponse } from "next/server";
import { buildContratoPdf } from "@/lib/pdf/contrato-pdf";
import { getContratoEntradaAnimaisById } from "@/lib/repositories/contratos-entrada-animais-repo";
import { getBusinessPartnerProfileFromSap, type SapBusinessPartnerProfile } from "@/lib/sap-service-layer";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const contratoId = Number.parseInt(id, 10);

  if (Number.isNaN(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  try {
    const data = await getContratoEntradaAnimaisById(contratoId);
    if (!data) {
      return NextResponse.json({ error: "Contrato nao encontrado." }, { status: 404 });
    }

    const contrato = data.contrato as Record<string, unknown>;
    const partes = await resolveContractParties(contrato, data.financeiro ?? []);

    const pdf = await buildContratoPdf("entrada_animais", {
      contrato,
      itens: data.itens,
      fretes: data.fretes,
      financeiro: data.financeiro,
      notas: data.notas,
      clausulas: data.clausulas,
      previsoes: data.previsoes,
      mapas: data.mapas,
      partes,
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"contrato-entrada-animais-${contratoId}.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function resolveContractParties(contrato: Record<string, unknown>, financeiroRows: Array<Record<string, unknown>>) {
  const compradorCode = pickText(contrato, [
    "empresa_codigo",
    "empresa_codigo_snapshot",
    "empresa_external_id",
    "empresa_nome_snapshot",
    "empresa_nome",
    "empresa",
  ]);
  const vendedorCode = pickText(contrato, [
    "parceiro_codigo_base",
    "parceiro_codigo_snapshot",
    "parceiro_external_id",
    "parceiro_nome_snapshot",
    "parceiro_nome_base",
  ]);

  const [compradorSap, vendedorSap] = await Promise.all([
    compradorCode ? getBusinessPartnerProfileFromSap(compradorCode) : Promise.resolve(null),
    vendedorCode ? getBusinessPartnerProfileFromSap(vendedorCode) : Promise.resolve(null),
  ]);

  const financeiroDefaults = pickFinanceiroDefaults(financeiroRows);

  return {
    comprador: mergePartyProfile(
      {
        nome: pickText(contrato, ["empresa_nome", "empresa_nome_snapshot", "empresa"]),
        cnpjCpf: pickText(contrato, ["empresa_cnpj", "empresa_cnpj_snapshot"]),
        representanteLegal: pickText(contrato, ["assinatura_empresa"]),
      },
      compradorSap,
    ),
    vendedor: mergePartyProfile(
      {
        nome: pickText(contrato, ["parceiro_nome_base", "parceiro_nome_snapshot"]),
        cnpjCpf: pickText(contrato, ["parceiro_documento_base", "parceiro_documento_snapshot"]),
        representanteLegal: pickText(contrato, ["assinatura_parceiro"]),
        banco: financeiroDefaults.banco,
        agencia: financeiroDefaults.agencia,
        conta: financeiroDefaults.conta,
        digito: financeiroDefaults.digito,
        condicaoPagamento: financeiroDefaults.condicaoPagamento,
        formaPagamento: financeiroDefaults.formaPagamento,
      },
      vendedorSap,
    ),
    consideracoesIniciais:
      pickText(contrato, ["consideracoes_iniciais", "consideracoesIniciais"]) ||
      "As partes tem entre si, como justo e contratado o presente contrato que sera regido de acordo com as clausulas e condicoes adiante dispostas, sendo o Anexo I parte integrante do presente instrumento.",
    cidadeAssinatura:
      pickText(contrato, ["cidade_assinatura", "cidade_nome", "cidade", "municipio_nome", "municipio"]) ||
      "Luis Eduardo Magalhaes, Bahia",
  };
}

function mergePartyProfile(
  fallback: {
    nome: string;
    cnpjCpf: string;
    representanteLegal: string;
    banco?: string;
    agencia?: string;
    conta?: string;
    digito?: string;
    condicaoPagamento?: string;
    formaPagamento?: string;
  },
  sap: SapBusinessPartnerProfile | null,
) {
  return {
    nome: sap?.cardName || fallback.nome,
    cnpjCpf: sap?.document || fallback.cnpjCpf,
    rgIe: sap?.rgIe || "",
    telefone: sap?.phone || "",
    email: sap?.email || "",
    representanteLegal: sap?.legalRep || fallback.representanteLegal,
    cpf: sap?.cpf || "",
    rg: sap?.rg || "",
    profissao: sap?.profession || "",
    estadoCivil: sap?.maritalStatus || "",
    banco: fallback.banco || sap?.bank || "",
    agencia: fallback.agencia || sap?.agency || "",
    conta: fallback.conta || sap?.account || "",
    digito: fallback.digito || sap?.digit || "",
    condicaoPagamento: fallback.condicaoPagamento || sap?.paymentTerm || "",
    formaPagamento: fallback.formaPagamento || sap?.paymentMethod || "",
    endereco: sap?.address || "",
  };
}

function pickFinanceiroDefaults(rows: Array<Record<string, unknown>>) {
  const firstWithAny = rows.find((row) =>
    Boolean(
      pickText(row, ["banco"]) ||
      pickText(row, ["agencia"]) ||
      pickText(row, ["conta"]) ||
      pickText(row, ["digito"]) ||
      pickText(row, ["condicaoPagamento"]) ||
      pickText(row, ["formaPagamento"]),
    ),
  );

  return {
    banco: firstWithAny ? pickText(firstWithAny, ["banco"]) : "",
    agencia: firstWithAny ? pickText(firstWithAny, ["agencia"]) : "",
    conta: firstWithAny ? pickText(firstWithAny, ["conta"]) : "",
    digito: firstWithAny ? pickText(firstWithAny, ["digito"]) : "",
    condicaoPagamento: firstWithAny ? pickText(firstWithAny, ["condicaoPagamento"]) : "",
    formaPagamento: firstWithAny ? pickText(firstWithAny, ["formaPagamento"]) : "",
  };
}

function pickText(target: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = target[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}
