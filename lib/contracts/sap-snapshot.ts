import { getBusinessPartnerProfileFromSap, type SapBusinessPartnerProfile } from "@/lib/sap-service-layer";
import type { ContratoEmpresaSapInput, ContratoParceiroSapInput } from "@/lib/types/contrato";

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeDocument(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits.length > 0 ? digits : text;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return null;
}

function collectReferences(values: unknown[]): string[] {
  const refs = new Set<string>();

  for (const value of values) {
    const text = normalizeText(value);
    if (!text) continue;

    refs.add(text);
    const docDigits = normalizeDocument(text);
    if (docDigits && docDigits.length >= 8) {
      refs.add(docDigits);
    }
  }

  return Array.from(refs);
}

async function resolveProfileByReferences(references: string[]): Promise<SapBusinessPartnerProfile | null> {
  for (const reference of references) {
    const profile = await getBusinessPartnerProfileFromSap(reference);
    if (profile) return profile;
  }
  return null;
}

export async function hydrateEmpresaSapSnapshot(
  snapshot: ContratoEmpresaSapInput | null | undefined,
): Promise<ContratoEmpresaSapInput | undefined> {
  if (!snapshot) return undefined;

  const references = collectReferences([snapshot.sapExternalId, snapshot.codigo, snapshot.cnpj, snapshot.nome]);
  const profile = references.length > 0 ? await resolveProfileByReferences(references) : null;
  if (!profile) return snapshot;

  return {
    sapExternalId: firstNonEmpty(snapshot.sapExternalId, profile.cardCode),
    codigo: firstNonEmpty(snapshot.codigo, profile.cardCode),
    nome: firstNonEmpty(snapshot.nome, profile.cardName) ?? snapshot.nome,
    cnpj: firstNonEmpty(snapshot.cnpj, profile.document),
    rgIe: firstNonEmpty(snapshot.rgIe, profile.rgIe),
    telefone: firstNonEmpty(snapshot.telefone, profile.phone),
    email: firstNonEmpty(snapshot.email, profile.email),
    representanteLegal: firstNonEmpty(snapshot.representanteLegal, profile.legalRep),
    endereco: firstNonEmpty(snapshot.endereco, profile.address),
  };
}

export async function hydrateParceiroSapSnapshot(
  snapshot: ContratoParceiroSapInput | null | undefined,
): Promise<ContratoParceiroSapInput | undefined> {
  if (!snapshot) return undefined;

  const references = collectReferences([snapshot.sapExternalId, snapshot.codigo, snapshot.documento, snapshot.nome]);
  const profile = references.length > 0 ? await resolveProfileByReferences(references) : null;
  if (!profile) return snapshot;

  return {
    sapExternalId: firstNonEmpty(snapshot.sapExternalId, profile.cardCode),
    codigo: firstNonEmpty(snapshot.codigo, profile.cardCode),
    nome: firstNonEmpty(snapshot.nome, profile.cardName) ?? snapshot.nome,
    documento: firstNonEmpty(snapshot.documento, profile.document),
    rgIe: firstNonEmpty(snapshot.rgIe, profile.rgIe),
    telefone: firstNonEmpty(snapshot.telefone, profile.phone),
    email: firstNonEmpty(snapshot.email, profile.email),
    representanteLegal: firstNonEmpty(snapshot.representanteLegal, profile.legalRep),
    cpf: firstNonEmpty(snapshot.cpf, profile.cpf),
    rg: firstNonEmpty(snapshot.rg, profile.rg),
    profissao: firstNonEmpty(snapshot.profissao, profile.profession),
    estadoCivil: firstNonEmpty(snapshot.estadoCivil, profile.maritalStatus),
    endereco: firstNonEmpty(snapshot.endereco, profile.address),
  };
}
