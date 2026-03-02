import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";

type JsonObject = Record<string, unknown>;
type Row = Record<string, string>;

type PartyProfile = {
  nome?: string;
  cnpjCpf?: string;
  rgIe?: string;
  telefone?: string;
  email?: string;
  representanteLegal?: string;
  cpf?: string;
  rg?: string;
  profissao?: string;
  estadoCivil?: string;
  condicaoPagamento?: string;
  formaPagamento?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  digito?: string;
  endereco?: string;
};

type ContratoPayload = {
  contrato: JsonObject;
  itens?: Row[];
  fretes?: Row[];
  financeiro?: Row[];
  notas?: Row[];
  clausulas?: Row[];
  previsoes?: Row[];
  mapas?: Row[];
  custos?: Row[];
  partes?: {
    comprador?: PartyProfile;
    vendedor?: PartyProfile;
    consideracoesIniciais?: string;
    cidadeAssinatura?: string;
  };
};

type ContractKind = "entrada_animais" | "saida_insumos";
type BrandKind = "almir" | "captar";
type BrandLogoImages = { captar: PDFImage | null; almir: PDFImage | null }
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 34;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLOR_TEXT = rgb(0.18, 0.18, 0.2);
const COLOR_MUTED = rgb(0.33, 0.35, 0.43);
const COLOR_TITLE = rgb(0.2, 0.26, 0.44);
const COLOR_LINE = rgb(0.82, 0.85, 0.91);

const COLOR_CAPTAR_RED = rgb(0.82, 0.208, 0.22);
const COLOR_CAPTAR_ORANGE = rgb(0.949, 0.541, 0.208);
const COLOR_CAPTAR_LIME = rgb(0.761, 0.847, 0.231);
const COLOR_CAPTAR_GREEN = rgb(0.043, 0.671, 0.349);
const COLOR_CAPTAR_BLUE = rgb(0.11, 0.659, 0.863);
const COLOR_CAPTAR_INDIGO = rgb(0.286, 0.298, 0.627);
const COLOR_BRAND_TEXT = rgb(0.18, 0.18, 0.2);

const DEFAULT_CONSIDERACOES_INICIAIS =
  "As partes têm entre si, como justo e contratado, o presente contrato, que será regido de acordo com as cláusulas e condições adiante dispostas, sendo o Anexo I parte integrante do presente instrumento.";
const LEGACY_LOGO_DIR = path.join(process.cwd(), "app", "api", "contratos", "entrada-animais", "[id]", "pdf");
let cachedLogoBytes: { captar?: Uint8Array; almir?: Uint8Array } | null = null;

export async function buildContratoPdf(kind: ContractKind, payload: ContratoPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const brandLogos = await loadBrandLogoImages(pdf);

  const contrato = payload.contrato ?? {};
  const companyName = pickString(contrato, ["empresa_nome", "empresaNome", "empresa"]);
  const brand = resolveBrand(companyName);
  const title = kind === "entrada_animais" ? "CONTRATO DE ENTRADA DE ANIMAIS" : "CONTRATO DE SAIDA DE INSUMOS";
  const numeroContrato = pickString(contrato, ["numero"]);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = drawHeader(page, font, fontBold, {
    title,
    brand,
    logos: brandLogos,
    companyName,
    numero: pickString(contrato, ["numero"]),
    exercicio: pickString(contrato, ["ano"]),
    assinatura: formatDateBr(pickString(contrato, ["dt_assinatura"])),
  });

  const ctx = { page, cursorY, font, fontBold };

  const ensureSpace = (height: number) => {
    if (ctx.cursorY - height >= MARGIN) return;
    ctx.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.cursorY = drawHeader(ctx.page, ctx.font, ctx.fontBold, {
      title,
      brand,
      logos: brandLogos,
      companyName,
      numero: pickString(contrato, ["numero"]),
      exercicio: pickString(contrato, ["ano"]),
      assinatura: formatDateBr(pickString(contrato, ["dt_assinatura"])),
    });
  };

  const sectionTitle = (label: string) => {
    ensureSpace(20);
    ctx.page.drawText(label, {
      x: MARGIN,
      y: ctx.cursorY,
      size: 11,
      font: ctx.fontBold,
      color: COLOR_TITLE,
    });
    ctx.cursorY -= 8;
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.cursorY },
      end: { x: PAGE_WIDTH - MARGIN, y: ctx.cursorY },
      thickness: 0.6,
      color: COLOR_LINE,
    });
    ctx.cursorY -= 12;
  };

  const paragraph = (label: string, value: string) => {
    const text = (value || "-").trim() || "-";
    const lines = wrapText(text, ctx.font, 9.4, CONTENT_WIDTH);
    const blockHeight = 14 + lines.length * 11 + 4;
    ensureSpace(blockHeight);

    ctx.page.drawText(label, {
      x: MARGIN,
      y: ctx.cursorY,
      size: 9,
      font: ctx.fontBold,
      color: COLOR_MUTED,
    });
    ctx.cursorY -= 12;

    for (const line of lines) {
      ctx.page.drawText(line, {
        x: MARGIN,
        y: ctx.cursorY,
        size: 9.4,
        font: ctx.font,
        color: COLOR_TEXT,
      });
      ctx.cursorY -= 10.5;
    }

    ctx.cursorY -= 2;
  };

  const compradorProfile: PartyProfile = {
    nome:
      payload.partes?.comprador?.nome ||
      pickString(contrato, ["empresa_nome", "empresa_nome_snapshot", "empresa"]),
    cnpjCpf:
      payload.partes?.comprador?.cnpjCpf ||
      pickString(contrato, ["empresa_cnpj", "empresa_cnpj_snapshot"]),
    rgIe: payload.partes?.comprador?.rgIe || "",
    telefone: payload.partes?.comprador?.telefone || "",
    email: payload.partes?.comprador?.email || "",
    representanteLegal: payload.partes?.comprador?.representanteLegal || pickString(contrato, ["assinatura_empresa"]),
    cpf: payload.partes?.comprador?.cpf || "",
    rg: payload.partes?.comprador?.rg || "",
    profissao: payload.partes?.comprador?.profissao || "",
    estadoCivil: payload.partes?.comprador?.estadoCivil || "",
    condicaoPagamento: payload.partes?.comprador?.condicaoPagamento || "",
    formaPagamento: payload.partes?.comprador?.formaPagamento || "",
    banco: payload.partes?.comprador?.banco || "",
    agencia: payload.partes?.comprador?.agencia || "",
    conta: payload.partes?.comprador?.conta || "",
    digito: payload.partes?.comprador?.digito || "",
    endereco: payload.partes?.comprador?.endereco || "",
  };

  const vendedorProfile: PartyProfile = {
    nome:
      payload.partes?.vendedor?.nome ||
      pickString(contrato, ["parceiro_nome_base", "parceiro_nome_snapshot"]),
    cnpjCpf:
      payload.partes?.vendedor?.cnpjCpf ||
      pickString(contrato, ["parceiro_documento_base", "parceiro_documento_snapshot"]),
    rgIe: payload.partes?.vendedor?.rgIe || "",
    telefone: payload.partes?.vendedor?.telefone || "",
    email: payload.partes?.vendedor?.email || "",
    representanteLegal: payload.partes?.vendedor?.representanteLegal || pickString(contrato, ["assinatura_parceiro"]),
    cpf: payload.partes?.vendedor?.cpf || "",
    rg: payload.partes?.vendedor?.rg || "",
    profissao: payload.partes?.vendedor?.profissao || "",
    estadoCivil: payload.partes?.vendedor?.estadoCivil || "",
    condicaoPagamento: payload.partes?.vendedor?.condicaoPagamento || "",
    formaPagamento: payload.partes?.vendedor?.formaPagamento || "",
    banco: payload.partes?.vendedor?.banco || "",
    agencia: payload.partes?.vendedor?.agencia || "",
    conta: payload.partes?.vendedor?.conta || "",
    digito: payload.partes?.vendedor?.digito || "",
    endereco: payload.partes?.vendedor?.endereco || "",
  };

  sectionTitle("Qualificação das Partes");
  ensureSpace(250);
  ctx.cursorY = drawPartiesProfileSection(ctx.page, ctx.font, ctx.fontBold, ctx.cursorY, compradorProfile, vendedorProfile);

  sectionTitle("Considerações Iniciais");
  paragraph(
    "",
    pickString(contrato, ["objeto"]) ||
      payload.partes?.consideracoesIniciais ||
      pickString(contrato, ["consideracoes_iniciais", "consideracoesIniciais"]) ||
      DEFAULT_CONSIDERACOES_INICIAIS,
  );

  // Espaco extra entre o texto de consideracoes e o titulo de clausulas.
  ctx.cursorY -= 10;
  sectionTitle("Cláusulas");
  ctx.cursorY -= 4;
  const clausulas = payload.clausulas ?? [];
  if (clausulas.length === 0) {
    ensureSpace(18);
    ctx.page.drawText("Nenhuma cláusula cadastrada para este contrato.", {
      x: MARGIN,
      y: ctx.cursorY,
      size: 9.4,
      font: ctx.font,
      color: COLOR_TEXT,
    });
    ctx.cursorY -= 16;
  } else {
    for (let index = 0; index < clausulas.length; index += 1) {
      const clausula = clausulas[index];
      const referencia = pickRow(clausula, ["referencia", "titulo", "codigo"]) || `Cláusula ${index + 1}`;
      const codigo = pickRow(clausula, ["codigo"]);
      const descricao = pickRow(clausula, ["descricao", "conteudo"]) || "-";
      const header = codigo ? `${codigo} - ${referencia}` : referencia;
      const lines = wrapText(descricao, ctx.font, 9.2, CONTENT_WIDTH);
      const needed = 20 + lines.length * 10.2 + 10;
      ensureSpace(needed);

      ctx.page.drawText(header, {
        x: MARGIN,
        y: ctx.cursorY,
        size: 9.4,
        font: ctx.fontBold,
        color: COLOR_TEXT,
      });
      ctx.cursorY -= 14;

      for (const line of lines) {
        ctx.page.drawText(line, {
          x: MARGIN,
          y: ctx.cursorY,
          size: 9.2,
          font: ctx.font,
          color: COLOR_TEXT,
        });
        ctx.cursorY -= 10.2;
      }
      ctx.cursorY -= 9;
    }
  }

  if (kind === "entrada_animais") {
    ctx.cursorY -= 6;
    ensureSpace(136);
    ctx.cursorY = drawTabelaBoitelSection(ctx.page, ctx.font, ctx.fontBold, ctx.cursorY, payload.custos ?? []);
  }

  const cidadeAssinatura =
    payload.partes?.cidadeAssinatura ||
    pickString(contrato, ["cidade_assinatura", "cidade_nome", "cidade", "municipio_nome", "municipio"]) ||
    "Cidade não informada";

  ctx.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.cursorY = PAGE_HEIGHT - MARGIN - 30;
  ctx.cursorY = drawClosingSignaturesSection(ctx.page, ctx.font, ctx.fontBold, ctx.cursorY, {
    cidade: cidadeAssinatura,
    dataAssinatura: formatDateBr(pickString(contrato, ["dt_assinatura"])) || formatDateBr(new Date().toISOString()),
    compradorNome:
      payload.partes?.comprador?.nome ||
      pickString(contrato, ["empresa_nome", "empresa_nome_snapshot", "empresa"]) ||
      "-",
    vendedorNome:
      payload.partes?.vendedor?.nome ||
      pickString(contrato, ["parceiro_nome_base", "parceiro_nome_snapshot"]) ||
      "-",
    testemunha1: pickString(contrato, ["testemunha"]) || "-",
    testemunha2: pickString(contrato, ["testemunha2"]) || "-",
  });

  const now = new Date();
  const generatedAt = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    drawLegacyFooter(currentPage, font, {
      generatedAt,
      numeroContrato,
      pageNumber: index + 1,
      totalPages: pages.length,
    });
  });

  return pdf.save();
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  params: {
    title: string;
    brand: BrandKind;
    logos: BrandLogoImages;
    companyName: string;
    numero: string;
    exercicio: string;
    assinatura: string;
  },
): number {
  const top = PAGE_HEIGHT - MARGIN;
  const boxHeight = 76;
  const boxY = top - boxHeight;

  page.drawRectangle({
    x: MARGIN,
    y: boxY,
    width: CONTENT_WIDTH,
    height: boxHeight,
    borderColor: COLOR_LINE,
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });

  const logoImage = params.brand === "almir" ? params.logos.almir : params.logos.captar;
  const logoX = MARGIN + 14;
  const logoY = boxY + 10;
  const logoDrawn = logoImage ? drawBrandImage(page, logoImage, logoX, logoY, 196, 54) : false;
  if (!logoDrawn) {
    if (params.brand === "almir") {
      drawAlmirBrand(page, logoX, logoY, 118, 54, fontBold);
    } else {
      drawCaptarBrand(page, logoX, logoY, 172, 54, fontBold);
    }
  }

  const titleX = PAGE_WIDTH - MARGIN - 260;
  page.drawText(params.title, {
    x: titleX,
    y: top - 30,
    size: 10.8,
    font: fontBold,
    color: COLOR_TITLE,
  });
  page.drawText("-", {
    x: titleX,
    y: top - 42,
    size: 10,
    font,
    color: COLOR_MUTED,
  });
  page.drawText(`Número: ${params.numero || "-"}`, {
    x: titleX,
    y: top - 55,
    size: 9,
    font,
    color: COLOR_TEXT,
  });
  page.drawText(`Exercício: ${params.exercicio || "-"}`, {
    x: titleX + 138,
    y: top - 55,
    size: 9,
    font,
    color: COLOR_TEXT,
  });
  page.drawText(`Assinatura: ${params.assinatura || "-"}`, {
    x: titleX,
    y: top - 68,
    size: 9,
    font,
    color: COLOR_TEXT,
  });

  return boxY - 14;
}

function drawAlmirBrand(page: PDFPage, x: number, y: number, width: number, height: number, fontBold: PDFFont) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
  });
  page.drawText("AF", {
    x: x + 10,
    y: y + 4,
    size: 46,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
}
function drawBrandImage(page: PDFPage, image: PDFImage, x: number, y: number, maxWidth: number, maxHeight: number): boolean {
  const widthRatio = maxWidth / image.width;
  const heightRatio = maxHeight / image.height;
  const scale = Math.min(widthRatio, heightRatio);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x;
  const drawY = y + (maxHeight - drawHeight) / 2;
  page.drawImage(image, { x: drawX, y: drawY, width: drawWidth, height: drawHeight });
  return true;
}
function drawCaptarBrand(page: PDFPage, x: number, y: number, _width: number, _height: number, fontBold: PDFFont) {
  const cx = x + 36;
  const cy = y + 27;
  const r = 10;

  page.drawCircle({ x: cx + 0, y: cy + 22, size: r, color: COLOR_CAPTAR_LIME });
  page.drawCircle({ x: cx + 18, y: cy + 12, size: r, color: COLOR_CAPTAR_RED });
  page.drawCircle({ x: cx + 20, y: cy - 8, size: r, color: COLOR_CAPTAR_ORANGE });
  page.drawCircle({ x: cx + 0, y: cy - 18, size: r, color: COLOR_CAPTAR_INDIGO });
  page.drawCircle({ x: cx - 18, y: cy - 8, size: r, color: COLOR_CAPTAR_BLUE });
  page.drawCircle({ x: cx - 18, y: cy + 12, size: r, color: COLOR_CAPTAR_GREEN });

  page.drawText("CAPTAR", {
    x: x + 78,
    y: y + 25,
    size: 16,
    font: fontBold,
    color: COLOR_BRAND_TEXT,
  });
  page.drawText("AGROBUSINESS", {
    x: x + 78,
    y: y + 9,
    size: 9.8,
    font: fontBold,
    color: COLOR_BRAND_TEXT,
  });
}

function drawPartiesProfileSection(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  startY: number,
  comprador: PartyProfile,
  vendedor: PartyProfile,
): number {
  const gap = 14;
  const colWidth = (CONTENT_WIDTH - gap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + gap;

  page.drawText("COMPRADOR", {
    x: leftX + (colWidth - fontBold.widthOfTextAtSize("COMPRADOR", 10)) / 2,
    y: startY,
    size: 10,
    font: fontBold,
    color: COLOR_TEXT,
  });
  page.drawText("VENDEDOR(a)", {
    x: rightX + (colWidth - fontBold.widthOfTextAtSize("VENDEDOR(a)", 10)) / 2,
    y: startY,
    size: 10,
    font: fontBold,
    color: COLOR_TEXT,
  });

  const lineY = startY - 4;
  page.drawLine({
    start: { x: leftX, y: lineY },
    end: { x: leftX + colWidth, y: lineY },
    thickness: 0.6,
    color: COLOR_LINE,
  });
  page.drawLine({
    start: { x: rightX, y: lineY },
    end: { x: rightX + colWidth, y: lineY },
    thickness: 0.6,
    color: COLOR_LINE,
  });

  const rows: Array<{ label: string; key: keyof PartyProfile }> = [
    { label: "Nome", key: "nome" },
    { label: "CNPJ/CPF", key: "cnpjCpf" },
    { label: "RG/IE", key: "rgIe" },
    { label: "Telefone", key: "telefone" },
    { label: "Email", key: "email" },
    { label: "Rep. Legal", key: "representanteLegal" },
    { label: "CPF", key: "cpf" },
    { label: "RG", key: "rg" },
    { label: "Profissão", key: "profissao" },
    { label: "Estado Civil", key: "estadoCivil" },
    { label: "Condicao Pagto", key: "condicaoPagamento" },
    { label: "Forma Pagto", key: "formaPagamento" },
    { label: "Banco", key: "banco" },
    { label: "Agência", key: "agencia" },
    { label: "Conta", key: "conta" },
    { label: "Dígito", key: "digito" },
    { label: "Endereço", key: "endereco" },
  ];

  let y = startY - 20;
  const labelWidth = 66;

  for (const row of rows) {
    const leftValue = (comprador[row.key] || "-").trim() || "-";
    const rightValue = (vendedor[row.key] || "-").trim() || "-";

    const leftLines = wrapText(leftValue, font, 9.2, colWidth - labelWidth - 6);
    const rightLines = wrapText(rightValue, font, 9.2, colWidth - labelWidth - 6);
    const rowLineCount = Math.max(leftLines.length, rightLines.length, 1);

    page.drawText(row.label, {
      x: leftX,
      y,
      size: 9.2,
      font: fontBold,
      color: COLOR_TEXT,
    });
    page.drawText(row.label, {
      x: rightX,
      y,
      size: 9.2,
      font: fontBold,
      color: COLOR_TEXT,
    });

    let leftValueY = y;
    for (const line of leftLines) {
      page.drawText(line, {
        x: leftX + labelWidth,
        y: leftValueY,
        size: 9.2,
        font,
        color: COLOR_TEXT,
      });
      leftValueY -= 10;
    }

    let rightValueY = y;
    for (const line of rightLines) {
      page.drawText(line, {
        x: rightX + labelWidth,
        y: rightValueY,
        size: 9.2,
        font,
        color: COLOR_TEXT,
      });
      rightValueY -= 10;
    }

    y -= rowLineCount * 10 + 2;
  }

  return y - 2;
}

function drawTabelaBoitelSection(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  startY: number,
  rows: Row[],
): number {
  const tableX = MARGIN + (CONTENT_WIDTH - 286) / 2;
  const colWidths = [97, 97, 92];
  const headerHeight = 17;
  const rowHeight = 16;
  const bodyRows = Math.max(Math.min(rows.length, 3), 1);
  const totalHeight = headerHeight + bodyRows * rowHeight;
  const topY = startY - 20;
  const bottomY = topY - totalHeight;

  page.drawText("Tabela 1", {
    x: tableX + 112,
    y: topY + 7,
    size: 9.4,
    font: fontBold,
    color: COLOR_TEXT,
  });

  page.drawRectangle({
    x: tableX,
    y: bottomY,
    width: colWidths[0] + colWidths[1] + colWidths[2],
    height: totalHeight,
    borderColor: COLOR_TEXT,
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });

  const firstColX = tableX + colWidths[0];
  const secondColX = firstColX + colWidths[1];
  page.drawLine({ start: { x: firstColX, y: bottomY }, end: { x: firstColX, y: topY }, thickness: 0.8, color: COLOR_TEXT });
  page.drawLine({ start: { x: secondColX, y: bottomY }, end: { x: secondColX, y: topY }, thickness: 0.8, color: COLOR_TEXT });
  page.drawLine({
    start: { x: tableX, y: topY - headerHeight },
    end: { x: tableX + colWidths[0] + colWidths[1] + colWidths[2], y: topY - headerHeight },
    thickness: 0.8,
    color: COLOR_TEXT,
  });

  page.drawText("Faixa Peso", {
    x: tableX + 28,
    y: topY - 8,
    size: 8.8,
    font: fontBold,
    color: COLOR_TEXT,
  });
  page.drawText("Entrada", {
    x: tableX + 34,
    y: topY - 17,
    size: 8.8,
    font: fontBold,
    color: COLOR_TEXT,
  });

  page.drawText("boitel Nelore", {
    x: firstColX + 20,
    y: topY - 8,
    size: 8.8,
    font: fontBold,
    color: COLOR_TEXT,
  });
  page.drawText("Padrão (R$)", {
    x: firstColX + 24,
    y: topY - 17,
    size: 8.8,
    font: fontBold,
    color: COLOR_TEXT,
  });

  page.drawText("Dias de Permanência", {
    x: secondColX,
    y: topY - 13,
    size: 8.8,
    font: fontBold,
    color: COLOR_TEXT,
  });

  for (let rowIndex = 0; rowIndex < bodyRows; rowIndex += 1) {
    const y = topY - headerHeight - rowHeight * rowIndex;
    if (rowIndex > 0) {
      page.drawLine({
        start: { x: tableX, y },
        end: { x: tableX + colWidths[0] + colWidths[1] + colWidths[2], y },
        thickness: 0.6,
        color: COLOR_TEXT,
      });
    }

    const row = rows[rowIndex] ?? {};
    const faixa = pickRow(row, ["faixaPesoEntrada", "pesoMedio", "categoria"]) || "";
    const boitel = pickRow(row, ["boitelNelore", "valorTabela", "valorNegociado"]) || "";
    const dias = pickRow(row, ["diasPermanencia", "trackCount"]) || "";

    page.drawText(faixa, { x: tableX + 4, y: y - 12, size: 8.4, font, color: COLOR_TEXT });
    page.drawText(boitel, { x: firstColX + 4, y: y - 12, size: 8.4, font, color: COLOR_TEXT });
    page.drawText(dias, { x: secondColX + 4, y: y - 12, size: 8.4, font, color: COLOR_TEXT });
  }

  return bottomY - 16;
}

function drawClosingSignaturesSection(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  startY: number,
  params: {
    cidade: string;
    dataAssinatura: string;
    compradorNome: string;
    vendedorNome: string;
    testemunha1: string;
    testemunha2: string;
  },
): number {
  const topLine = `${(params.cidade || "Cidade não informada").toUpperCase()}, ${params.dataAssinatura || "-"}`;
  page.drawText(topLine, {
    x: MARGIN + 8,
    y: startY,
    size: 10,
    font,
    color: COLOR_TEXT,
  });

  const firstSignatureY = startY - 78;
  const leftX = MARGIN + 8;
  const rightX = PAGE_WIDTH / 2 + 12;
  const lineWidth = CONTENT_WIDTH / 2 - 22;

  page.drawLine({
    start: { x: leftX, y: firstSignatureY },
    end: { x: leftX + lineWidth, y: firstSignatureY },
    thickness: 0.8,
    color: COLOR_TEXT,
  });
  page.drawLine({
    start: { x: rightX, y: firstSignatureY },
    end: { x: rightX + lineWidth, y: firstSignatureY },
    thickness: 0.8,
    color: COLOR_TEXT,
  });

  drawCenteredText(page, fontBold, params.compradorNome, leftX, firstSignatureY - 14, lineWidth, 10);
  drawCenteredText(page, fontBold, params.vendedorNome, rightX, firstSignatureY - 14, lineWidth, 10);
  drawCenteredText(page, fontBold, "COMPRADOR", leftX, firstSignatureY - 30, lineWidth, 10);
  drawCenteredText(page, fontBold, "VENDEDOR(a)", rightX, firstSignatureY - 30, lineWidth, 10);

  const witnessY = firstSignatureY - 178;
  page.drawLine({
    start: { x: leftX, y: witnessY },
    end: { x: leftX + lineWidth, y: witnessY },
    thickness: 0.8,
    color: COLOR_TEXT,
  });
  page.drawLine({
    start: { x: rightX, y: witnessY },
    end: { x: rightX + lineWidth, y: witnessY },
    thickness: 0.8,
    color: COLOR_TEXT,
  });

  drawCenteredText(page, fontBold, params.testemunha1 || "-", leftX, witnessY - 14, lineWidth, 10);
  drawCenteredText(page, fontBold, params.testemunha2 || "-", rightX, witnessY - 14, lineWidth, 10);

  return witnessY - 28;
}

function drawLegacyFooter(
  page: PDFPage,
  font: PDFFont,
  params: {
    generatedAt: string;
    numeroContrato: string;
    pageNumber: number;
    totalPages: number;
  },
) {
  const lineY = 24;
  page.drawLine({
    start: { x: MARGIN, y: lineY },
    end: { x: PAGE_WIDTH - MARGIN, y: lineY },
    thickness: 0.8,
    color: COLOR_TEXT,
  });

  const infoText = `Impresso em: ${params.generatedAt}`;
  const infoWidth = font.widthOfTextAtSize(infoText, 7.2);
  page.drawText(infoText, {
    x: MARGIN + (CONTENT_WIDTH - infoWidth) / 2,
    y: 14,
    size: 7.2,
    font,
    color: COLOR_TEXT,
  });

  const contractText = `Contrato Nº: ${params.numeroContrato || "-"}`;
  page.drawText(contractText, {
    x: PAGE_WIDTH - MARGIN - 145,
    y: 14,
    size: 7.4,
    font,
    color: COLOR_TEXT,
  });

  const pageText = `${params.pageNumber}/${params.totalPages}`;
  page.drawText(pageText, {
    x: PAGE_WIDTH - MARGIN - 18,
    y: 14,
    size: 7.4,
    font,
    color: COLOR_TEXT,
  });
}

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
) {
  const content = (text || "-").trim() || "-";
  const drawX = x + Math.max((width - font.widthOfTextAtSize(content, size)) / 2, 0);
  page.drawText(content, { x: drawX, y, size, font, color: COLOR_TEXT });
}

function resolveBrand(companyName: string): BrandKind {
  const normalized = normalizeSearch(companyName);
  if (normalized.includes("almir")) return "almir";
  return "captar";
}

async function loadBrandLogoImages(pdf: PDFDocument): Promise<BrandLogoImages> {
  const files = await getBrandLogoBytes();
  const images: BrandLogoImages = { captar: null, almir: null };
  if (files.captar) {
    try {
      images.captar = await pdf.embedPng(files.captar);
    } catch {
      images.captar = null;
    }
  }
  if (files.almir) {
    try {
      images.almir = await pdf.embedPng(files.almir);
    } catch {
      images.almir = null;
    }
  }
  return images;
}

async function getBrandLogoBytes(): Promise<{ captar?: Uint8Array; almir?: Uint8Array }> {
  if (cachedLogoBytes) return cachedLogoBytes;

  try {
    const names = await readdir(LEGACY_LOGO_DIR);
    const almirFile = names.find((name) => normalizeSearch(name).includes("logo almir"));
    const captarFile = names.find((name) => normalizeSearch(name).includes("logo captar"));

    const [almirBytes, captarBytes] = await Promise.all([
      almirFile ? readFile(path.join(LEGACY_LOGO_DIR, almirFile)) : Promise.resolve(undefined),
      captarFile ? readFile(path.join(LEGACY_LOGO_DIR, captarFile)) : Promise.resolve(undefined),
    ]);

    cachedLogoBytes = {
      almir: almirBytes ? new Uint8Array(almirBytes) : undefined,
      captar: captarBytes ? new Uint8Array(captarBytes) : undefined,
    };

    return cachedLogoBytes;
  } catch {
    cachedLogoBytes = {};
    return cachedLogoBytes;
  }
}

function formatDateBr(value: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatMoneyBr(value: string): string {
  const parsed = parseNumber(value);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function pickString(target: JsonObject | null | undefined, keys: string[]): string {
  if (!target) return "";
  for (const key of keys) {
    const value = target[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function pickRow(row: Row | null | undefined, keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[index];
    }
  }
  lines.push(current);
  return lines;
}

function normalizeSearch(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}






