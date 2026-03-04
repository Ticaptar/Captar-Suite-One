import { NextResponse } from "next/server";
import { buildContratoPdf } from "@/lib/pdf/contrato-pdf";
import { getContratoSaidaAnimaisById } from "@/lib/repositories/contratos-saida-animais-repo";
import { getBusinessPartnerProfileFromSap, type SapBusinessPartnerProfile } from "@/lib/sap-service-layer";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const contratoId = Number.parseInt(id, 10);

  if (Number.isNaN(contratoId) || contratoId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    const data = await getContratoSaidaAnimaisById(contratoId);
    if (!data) {
      return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
    }

    const contrato = data.contrato as Record<string, unknown>;
    const partes = await resolveContractParties(contrato, data.financeiro ?? []);

    const pdf = await buildContratoPdf("saida_animais", {
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
        "Content-Disposition": `inline; filename=\"contrato-saida-animais-${contratoId}.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function resolveContractParties(contrato: Record<string, unknown>, financeiroRows: Array<Record<string, unknown>>) {
  const dadosGerais = asObject(contrato.dadosGerais);
  const compradorRefs = collectReferences([
    ...collectPartyReferences(contrato, [
      "empresa_codigo",
      "empresa_codigo_snapshot",
      "empresa_external_id",
      "empresa_nome_snapshot",
      "empresa_nome",
      "empresa",
      "empresa_cnpj",
      "empresa_cnpj_snapshot",
    ]),
    pickText(dadosGerais, ["vendedorCodigo", "vendedorNome", "vendedorDocumento"]),
  ]);
  const vendedorRefs = collectReferences([
    ...collectPartyReferences(contrato, [
      "parceiro_codigo_base",
      "parceiro_codigo_snapshot",
      "parceiro_external_id",
      "parceiro_nome_snapshot",
      "parceiro_nome_base",
      "parceiro_documento_base",
      "parceiro_documento_snapshot",
    ]),
    pickText(dadosGerais, ["compradorCodigo", "compradorNome", "compradorDocumento"]),
  ]);
  const faturamentoRefs = collectReferences([
    pickText(dadosGerais, ["faturadorCodigo", "faturadorNome", "faturadorDocumento"]),
    pickText(contrato, ["faturador_nome", "faturamento_nome", "faturador"]),
    pickText(contrato, ["faturador_documento", "faturador_cnpj", "faturador_cpf"]),
  ]);
  const frigorificoRefs = collectReferences([
    pickText(dadosGerais, ["frigorificoCodigo", "frigorificoNome", "frigorificoDocumento"]),
    pickText(contrato, ["frigorifico_nome", "frigorifico"]),
    pickText(contrato, ["frigorifico_documento", "frigorifico_cnpj", "frigorifico_cpf"]),
  ]);
  const anuenteRefs = collectReferences([
    pickText(dadosGerais, ["anuenteCodigo", "anuenteNome", "anuenteDocumento"]),
    pickText(contrato, ["anuente_nome", "anuente"]),
    pickText(contrato, ["anuente_documento", "anuente_cnpj", "anuente_cpf"]),
  ]);

  const [compradorSap, vendedorSap, faturamentoSap, frigorificoSap, anuenteSap] = await Promise.all([
    resolveSapProfileByReferences(compradorRefs),
    resolveSapProfileByReferences(vendedorRefs),
    resolveSapProfileByReferences(faturamentoRefs),
    resolveSapProfileByReferences(frigorificoRefs),
    resolveSapProfileByReferences(anuenteRefs),
  ]);

  const financeiroDefaults = pickFinanceiroDefaults(financeiroRows);

  return {
    comprador: mergePartyProfile(
      {
        nome: pickText(contrato, ["empresa_nome", "empresa_nome_snapshot", "empresa"]),
        cnpjCpf: pickText(contrato, ["empresa_cnpj", "empresa_cnpj_snapshot"]),
        rgIe: pickText(contrato, ["empresa_ie", "empresa_rg_ie", "empresa_rgie"]),
        telefone: pickText(contrato, ["empresa_telefone", "telefone_empresa"]),
        email: pickText(contrato, ["empresa_email", "email_empresa"]),
        representanteLegal: pickText(contrato, ["assinatura_empresa"]),
        cpf: pickText(contrato, ["empresa_cpf"]),
        rg: pickText(contrato, ["empresa_rg"]),
        profissao: pickText(contrato, ["empresa_profissao"]),
        estadoCivil: pickText(contrato, ["empresa_estado_civil"]),
        endereco: pickText(contrato, ["empresa_endereco", "empresa_endereco_snapshot"]),
      },
      compradorSap,
    ),
    vendedor: mergePartyProfile(
      {
        nome: pickText(contrato, ["parceiro_nome_base", "parceiro_nome_snapshot"]),
        cnpjCpf: pickText(contrato, ["parceiro_documento_base", "parceiro_documento_snapshot"]),
        rgIe: pickText(contrato, ["parceiro_ie", "parceiro_rg_ie", "parceiro_rgie"]),
        telefone: pickText(contrato, ["parceiro_telefone", "telefone_parceiro"]),
        email: pickText(contrato, ["parceiro_email", "email_parceiro"]),
        representanteLegal: pickText(contrato, ["assinatura_parceiro"]),
        cpf: pickText(contrato, ["parceiro_cpf"]),
        rg: pickText(contrato, ["parceiro_rg"]),
        profissao: pickText(contrato, ["parceiro_profissao"]),
        estadoCivil: pickText(contrato, ["parceiro_estado_civil"]),
        endereco: pickText(contrato, ["parceiro_endereco", "parceiro_endereco_snapshot"]),
        banco: financeiroDefaults.banco,
        agencia: financeiroDefaults.agencia,
        conta: financeiroDefaults.conta,
        digito: financeiroDefaults.digito,
        condicaoPagamento: financeiroDefaults.condicaoPagamento,
        formaPagamento: financeiroDefaults.formaPagamento,
      },
      vendedorSap,
    ),
    faturamento: mergePartyProfile(
      {
        nome:
          pickText(dadosGerais, ["faturadorNome", "faturador"]) ||
          pickText(contrato, ["faturador_nome", "faturamento_nome", "faturador"]),
        cnpjCpf:
          pickText(dadosGerais, ["faturadorDocumento"]) ||
          pickText(contrato, ["faturador_documento", "faturador_cnpj", "faturador_cpf"]),
        rgIe: pickText(contrato, ["faturador_ie"]),
        telefone: pickText(contrato, ["faturador_telefone"]),
        email: pickText(contrato, ["faturador_email"]),
        representanteLegal: "",
        endereco: pickText(contrato, ["faturador_endereco"]),
      },
      faturamentoSap,
    ),
    frigorifico: mergePartyProfile(
      {
        nome:
          pickText(dadosGerais, ["frigorificoNome", "frigorifico"]) ||
          pickText(contrato, ["frigorifico_nome", "frigorifico"]),
        cnpjCpf:
          pickText(dadosGerais, ["frigorificoDocumento"]) ||
          pickText(contrato, ["frigorifico_documento", "frigorifico_cnpj", "frigorifico_cpf"]),
        rgIe: pickText(contrato, ["frigorifico_ie"]),
        telefone: pickText(contrato, ["frigorifico_telefone"]),
        email: pickText(contrato, ["frigorifico_email"]),
        representanteLegal: "",
        endereco: pickText(contrato, ["frigorifico_endereco"]),
      },
      frigorificoSap,
    ),
    anuente: mergePartyProfile(
      {
        nome:
          pickText(dadosGerais, ["anuenteNome", "anuente"]) ||
          pickText(contrato, ["anuente_nome", "anuente"]),
        cnpjCpf:
          pickText(dadosGerais, ["anuenteDocumento"]) ||
          pickText(contrato, ["anuente_documento", "anuente_cnpj", "anuente_cpf"]),
        rgIe: pickText(contrato, ["anuente_ie"]),
        telefone: pickText(contrato, ["anuente_telefone"]),
        email: pickText(contrato, ["anuente_email"]),
        representanteLegal: "",
        endereco: pickText(contrato, ["anuente_endereco"]),
      },
      anuenteSap,
    ),
    consideracoesIniciais:
      pickText(contrato, ["consideracoes_iniciais", "consideracoesIniciais"]) ||
      "As partes têm entre si, como justo e contratado, o presente contrato, que será regido de acordo com as cláusulas e condições adiante dispostas, sendo o Anexo I parte integrante do presente instrumento.",
    cidadeAssinatura:
      pickText(contrato, ["cidade_assinatura", "cidade_nome", "cidade", "municipio_nome", "municipio"]) ||
      "Luís Eduardo Magalhães, Bahia",
  };
}

function collectReferences(values: string[]): string[] {
  const refs = new Set<string>();
  for (const raw of values) {
    const normalized = String(raw ?? "").trim();
    if (!normalized) continue;
    refs.add(normalized);
    const digits = normalized.replace(/\D/g, "");
    if (digits.length >= 8) refs.add(digits);
  }
  return Array.from(refs);
}

function mergePartyProfile(
  fallback: {
    nome: string;
    cnpjCpf: string;
    rgIe?: string;
    telefone?: string;
    email?: string;
    representanteLegal: string;
    cpf?: string;
    rg?: string;
    profissao?: string;
    estadoCivil?: string;
    endereco?: string;
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
    rgIe: sap?.rgIe || fallback.rgIe || "",
    telefone: sap?.phone || fallback.telefone || "",
    email: sap?.email || fallback.email || "",
    representanteLegal: sap?.legalRep || fallback.representanteLegal,
    cpf: sap?.cpf || fallback.cpf || "",
    rg: sap?.rg || fallback.rg || "",
    profissao: sap?.profession || fallback.profissao || "",
    estadoCivil: sap?.maritalStatus || fallback.estadoCivil || "",
    banco: fallback.banco || sap?.bank || "",
    agencia: fallback.agencia || sap?.agency || "",
    conta: fallback.conta || sap?.account || "",
    digito: fallback.digito || sap?.digit || "",
    condicaoPagamento: fallback.condicaoPagamento || sap?.paymentTerm || "",
    formaPagamento: fallback.formaPagamento || sap?.paymentMethod || "",
    endereco: sap?.address || fallback.endereco || "",
  };
}

function collectPartyReferences(contrato: Record<string, unknown>, keys: string[]): string[] {
  const refs = new Set<string>();
  for (const key of keys) {
    const raw = pickText(contrato, [key]);
    if (!raw) continue;
    const trimmed = raw.trim();
    if (trimmed) refs.add(trimmed);

    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 8) refs.add(digits);
  }
  return Array.from(refs);
}

async function resolveSapProfileByReferences(references: string[]): Promise<SapBusinessPartnerProfile | null> {
  for (const reference of references) {
    if (!reference) continue;
    const profile = await getBusinessPartnerProfileFromSap(reference);
    if (profile) {
      return profile;
    }
  }
  return null;
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

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

