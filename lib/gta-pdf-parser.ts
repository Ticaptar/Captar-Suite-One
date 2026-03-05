import pdfParse from "pdf-parse";

export type GtaPdfImportResult = {
  numeroGta: string | null;
  serie: string | null;
  dataEmissao: string | null;
  horaEmissao: string | null;
  dataValidade: string | null;
  transporte: string | null;
  finalidade: string | null;
  especie: string | null;
  estabelecimentoOrigem: string | null;
  estabelecimentoDestino: string | null;
  localOrigem: string | null;
  localDestino: string | null;
  produtor: string | null;
  quantidadeMachos: number;
  quantidadeFemeas: number;
  quantidadeTotal: number;
  confidencePercent: number;
  warnings: string[];
  rawTextPreview: string;
};

type ParsedFaixa = {
  quantidadeMachos: number;
  quantidadeFemeas: number;
  quantidadeTotal: number;
  foundBreakdown: boolean;
};

export async function parseGtaPdfFromBytes(bytes: Uint8Array): Promise<GtaPdfImportResult> {
  const parsed = await pdfParse(Buffer.from(bytes));
  const text = normalizePdfText(parsed.text ?? "");
  const plainText = normalizePlainText(text);

  const numeroSerie = extractNumeroSerie(plainText);
  const numeroGta = numeroSerie.numeroGta;
  const serie = numeroSerie.serie;
  const transporte = cleanLabel(extractFirst(plainText, [/transporte\s*:\s*([^\n|]+?)(?:finalidade\s*:|\n|$)/i]));
  const finalidade = cleanLabel(extractFirst(plainText, [/finalidade\s*:\s*([^\n|]+?)(?:especie\s*:|\n|$)/i]));
  const especie = cleanLabel(extractFirst(plainText, [/especie\s*:\s*([^\n|]+)/i]));

  const dataHora = extractDataHoraEmissao(plainText);
  const dataValidade = extractDate(
    extractFirst(plainText, [/validade\s*:\s*(\d{2}\/\d{2}\/\d{4})/i]),
  );

  const estabelecimentos = extractMany(plainText, /(?:^|\n)\s*estabelecimento\s*:\s*([^\n]+)/gi);
  const municipios = extractMany(plainText, /(?:^|\n)\s*municipio\s*:\s*([^\n]+)/gi);
  const nomes = extractMany(plainText, /(?:^|\n)\s*nome\s*:\s*([^\n]+)/gi);

  const faixa = extractFaixaAnimais(plainText);

  const warnings: string[] = [];
  if (!numeroGta) warnings.push("Numero da GTA nao identificado automaticamente.");
  if (!faixa.foundBreakdown && faixa.quantidadeTotal <= 0) {
    warnings.push("Quantidade de animais nao identificada automaticamente.");
  }

  const confidencePercent = calculateConfidencePercent(numeroGta, dataHora.dataEmissao, dataValidade, serie, faixa);

  return {
    numeroGta,
    serie,
    dataEmissao: dataHora.dataEmissao,
    horaEmissao: dataHora.horaEmissao,
    dataValidade,
    transporte,
    finalidade,
    especie,
    estabelecimentoOrigem: estabelecimentos[0] ?? null,
    estabelecimentoDestino: estabelecimentos[1] ?? null,
    localOrigem: municipios[0] ?? null,
    localDestino: municipios[1] ?? null,
    produtor: nomes[0] ?? null,
    quantidadeMachos: faixa.quantidadeMachos,
    quantidadeFemeas: faixa.quantidadeFemeas,
    quantidadeTotal: faixa.quantidadeTotal,
    confidencePercent,
    warnings,
    rawTextPreview: text.slice(0, 1500),
  };
}

function normalizePdfText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePlainText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-");
}

function extractNumeroSerie(text: string): { numeroGta: string | null; serie: string | null } {
  const numberWithSerie = text.match(/\bnumero\s*:\s*([0-9]{4,})\s*\|\s*([A-Za-z0-9]+)/i);
  if (numberWithSerie?.[1]) {
    return {
      numeroGta: cleanLabel(numberWithSerie[1]),
      serie: cleanLabel(numberWithSerie[2] ?? null),
    };
  }

  const numberOnly = text.match(/\bnumero\s*:\s*([0-9]{4,})\b/i);
  const serieOnly = text.match(/\bserie\s*:\s*([A-Za-z0-9]+)/i);
  return {
    numeroGta: cleanLabel(numberOnly?.[1] ?? null),
    serie: cleanLabel(serieOnly?.[1] ?? null),
  };
}

function extractDataHoraEmissao(text: string): { dataEmissao: string | null; horaEmissao: string | null } {
  const match = text.match(
    /data\/hora\s*emissao\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2})?/i,
  );
  if (!match) return { dataEmissao: null, horaEmissao: null };
  return {
    dataEmissao: extractDate(match[1]),
    horaEmissao: extractTime(match[2]),
  };
}

function extractDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function extractTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

function cleanLabel(value: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/[|;]+$/g, "")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function extractMany(text: string, pattern: RegExp): string[] {
  const matches = Array.from(text.matchAll(pattern));
  return matches
    .map((match) => cleanLabel(match[1] ?? null))
    .filter((value): value is string => Boolean(value));
}

function extractFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanLabel(match?.[1] ?? null);
    if (value) return value;
  }
  return null;
}

function extractFaixaAnimais(text: string): ParsedFaixa {
  const sectionMatch = text.match(
    /III\s*[-]?\s*ANIMAIS\s+TRANSPORTADOS([\s\S]*?)(?:IV\s*[-]?\s*INFORMACOES|IV\s*[-]?\s*INFORMACOES|GTA\s+EMITIDA|$)/i,
  );
  const section = sectionMatch?.[1] ?? "";
  const scopedText = section || text;

  const tokens = extractCountTokens(scopedText);
  if (tokens.length >= 8) {
    const machos = tokens[0] + tokens[2] + tokens[4] + tokens[6];
    const femeas = tokens[1] + tokens[3] + tokens[5] + tokens[7];
    const total = tokens[8] ?? machos + femeas;
    return {
      quantidadeMachos: machos,
      quantidadeFemeas: femeas,
      quantidadeTotal: total,
      foundBreakdown: true,
    };
  }

  if (tokens.length === 1) {
    const total = tokens[0];
    return {
      quantidadeMachos: 0,
      quantidadeFemeas: 0,
      quantidadeTotal: total,
      foundBreakdown: false,
    };
  }

  return {
    quantidadeMachos: 0,
    quantidadeFemeas: 0,
    quantidadeTotal: 0,
    foundBreakdown: false,
  };
}

function extractCountTokens(text: string): number[] {
  const compact = text.replace(/\n/g, " ");
  const directRowMatch = compact.match(
    />\s*36\s*F\s*Total\s*([0-9][0-9 .]{0,80})(?:Vacinacoes|Exames|IV\s*[-]|$)/i,
  );
  if (directRowMatch?.[1]) {
    const tokens = parseNumberTokens(directRowMatch[1]);
    if (tokens.length > 0) return tokens;
  }

  const rowLikeLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^\d[\d\s.]*\d$/.test(line) || /^\d+$/.test(line));
  if (rowLikeLine) {
    const tokens = parseNumberTokens(rowLikeLine);
    if (tokens.length > 0) return tokens;
  }

  return [];
}

function parseNumberTokens(value: string): number[] {
  return (value.match(/\d+/g) ?? [])
    .map((token) => Number.parseInt(token, 10))
    .filter((token) => Number.isFinite(token) && token >= 0);
}

function calculateConfidencePercent(
  numeroGta: string | null,
  dataEmissao: string | null,
  dataValidade: string | null,
  serie: string | null,
  faixa: ParsedFaixa,
): number {
  let score = 0;
  if (numeroGta) score += 35;
  if (dataEmissao) score += 10;
  if (dataValidade) score += 5;
  if (serie) score += 5;
  if (faixa.foundBreakdown) {
    score += 45;
  } else if (faixa.quantidadeTotal > 0) {
    score += 25;
  }
  return Math.max(0, Math.min(100, score));
}
