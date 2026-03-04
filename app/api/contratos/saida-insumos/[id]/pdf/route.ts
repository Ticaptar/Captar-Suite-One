import { NextResponse } from "next/server";
import { buildContratoPdf } from "@/lib/pdf/contrato-pdf";
import { getContratoSaidaInsumosById } from "@/lib/repositories/contratos-saida-insumos-repo";
import {
  getBusinessPartnerProfileFromSap,
  listItemsFromSap,
  type SapBusinessPartnerProfile,
} from "@/lib/sap-service-layer";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };
type PdfRow = Record<string, string>;

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

    const contrato = data.contrato as Record<string, unknown>;
    const partes = await resolveContractParties(contrato);
    const itens = await enrichItensWithSapDescription(data.itens);

    const tipoContrato = normalizeContratoTipo(pickText(contrato, ["tp_contrato", "tipoContrato"]));
    const pdf = await buildContratoPdf(tipoContrato, {
      contrato,
      itens,
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
        "Content-Disposition": `inline; filename=\"contrato-saida-insumos-${contratoId}.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeContratoTipo(value: string): "saida_insumos" | "entrada_insumos" {
  const parsed = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (parsed === "entrada_insumos" || parsed.includes("entrada")) return "entrada_insumos";
  return "saida_insumos";
}

async function resolveContractParties(contrato: Record<string, unknown>) {
  const compradorRefs = collectPartyReferences(contrato, [
    "empresa_codigo",
    "empresa_codigo_snapshot",
    "empresa_external_id",
    "empresa_nome_snapshot",
    "empresa_nome",
    "empresa",
    "empresa_cnpj",
    "empresa_cnpj_snapshot",
  ]);
  const vendedorRefs = collectPartyReferences(contrato, [
    "parceiro_codigo_base",
    "parceiro_codigo_snapshot",
    "parceiro_external_id",
    "parceiro_nome_snapshot",
    "parceiro_nome_base",
    "parceiro_documento_base",
    "parceiro_documento_snapshot",
  ]);

  const [compradorSap, vendedorSap] = await Promise.all([
    resolveSapProfileByReferences(compradorRefs),
    resolveSapProfileByReferences(vendedorRefs),
  ]);

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
      },
      vendedorSap,
    ),
    consideracoesIniciais:
      pickText(contrato, ["consideracoes_iniciais", "consideracoesIniciais"]) ||
      "As partes têm entre si, como justo e contratado, o presente contrato, que será regido de acordo com as cláusulas e condições adiante dispostas, sendo o Anexo I parte integrante do presente instrumento.",
    cidadeAssinatura:
      pickText(contrato, ["cidade_assinatura", "cidade_nome", "cidade", "municipio_nome", "municipio"]) ||
      "Luís Eduardo Magalhães, Bahia",
  };
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
    banco: sap?.bank || "",
    agencia: sap?.agency || "",
    conta: sap?.account || "",
    digito: sap?.digit || "",
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

function pickText(target: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = target[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

async function enrichItensWithSapDescription(
  itens: Array<Record<string, unknown>> | undefined,
): Promise<PdfRow[]> {
  if (!itens || itens.length === 0) return [];

  const cache = new Map<string, Promise<string | null>>();
  const resolveDescription = async (code: string): Promise<string | null> => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return null;
    const existing = cache.get(normalizedCode);
    if (existing) return existing;

    const pending = (async () => {
      try {
        const options = await listItemsFromSap(normalizedCode, 200);
        const exact = options.find((option) => String(option.value ?? "").trim().toUpperCase() === normalizedCode);
        const fallback = options.find((option) =>
          String(option.label ?? "").trim().toUpperCase().startsWith(`${normalizedCode} - `),
        );
        const selected = exact ?? fallback ?? null;
        if (!selected) return null;
        const label = String(selected.label ?? "").trim();
        const separator = " - ";
        const index = label.indexOf(separator);
        if (index > 0) {
          const description = label.slice(index + separator.length).trim();
          return description || null;
        }
        return null;
      } catch {
        return null;
      }
    })();

    cache.set(normalizedCode, pending);
    return pending;
  };

  return await Promise.all(
    itens.map(async (item) => {
      const row = toStringRow(item ?? {});
      const code = extractItemCode(row);
      const currentDescription = extractItemDescription(row);
      if (!code || (currentDescription && currentDescription.toUpperCase() !== code.toUpperCase())) {
        return row;
      }

      const description = await resolveDescription(code);
      if (!description) return row;

      return {
        ...row,
        item_nome_snapshot: description,
        itemDescricao: description,
        descricaoItem: description,
        itemName: description,
        item: `${code} - ${description}`,
      };
    }),
  );
}

function toStringRow(item: Record<string, unknown>): PdfRow {
  const row: PdfRow = {};
  for (const [key, value] of Object.entries(item)) {
    if (value === null || value === undefined) continue;
    row[key] = String(value);
  }
  return row;
}

function extractItemCode(item: Record<string, unknown>): string {
  const raw = pickFromRow(item, ["itemId", "itemCodigo", "item_codigo_snapshot", "codigo"]);
  if (!raw) return "";
  return raw.replace(/^sap:[^:]+:/i, "").trim();
}

function extractItemDescription(item: Record<string, unknown>): string {
  const text = normalizeItemText(pickFromRow(item, ["item_nome_snapshot", "itemDescricao", "descricaoItem", "itemName"]));
  if (text) return text;
  const label = normalizeItemText(pickFromRow(item, ["item", "item_label_snapshot"]));
  if (!label) return "";
  const separator = " - ";
  const index = label.indexOf(separator);
  if (index > 0) return label.slice(index + separator.length).trim();
  return label;
}

function normalizeItemText(value: string): string {
  return String(value ?? "")
    .replace(/^sap:[^:]+:/i, "")
    .replace(/^\-\s*/, "")
    .trim();
}

function pickFromRow(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}
