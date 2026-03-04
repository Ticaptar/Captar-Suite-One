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
    faturamento?: PartyProfile;
    frigorifico?: PartyProfile;
    anuente?: PartyProfile;
    consideracoesIniciais?: string;
    cidadeAssinatura?: string;
  };
};

type ContractKind = "entrada_animais" | "saida_animais" | "saida_insumos" | "entrada_insumos";
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
  if (kind === "saida_animais") {
    return buildSaidaAnimaisPdf(payload);
  }
  if (kind === "saida_insumos" || kind === "entrada_insumos") {
    return buildSaidaInsumosPdf(kind, payload);
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const brandLogos = await loadBrandLogoImages(pdf);

  const contrato = payload.contrato || {};
  const companyName = pickString(contrato, ["empresa_nome", "empresaNome", "empresa"]);
  const brand = resolveBrand(companyName);
  const title = "CONTRATO DE ENTRADA DE ANIMAIS";
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
  const clausulas = payload.clausulas || [];
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

async function buildSaidaAnimaisPdf(payload: ContratoPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logos = await loadBrandLogoImages(pdf);

  const contrato = payload.contrato || {};
  const companyName = pickString(contrato, ["empresa_nome", "empresa_nome_snapshot", "empresa"]);
  const brand = resolveBrand(companyName);
  const numeroContrato = pickString(contrato, ["numero"]) || "-";
  const codigoContrato = pickString(contrato, ["ref_object_id", "id"]) || "-";
  const dataRef =
    formatDateBr(
      pickString(contrato, ["dt_assinatura", "dt_inicio", "updated_on", "created_on"]) || new Date().toISOString(),
    ) || "-";
  const statusRef = statusLabelForPdf(pickString(contrato, ["status"]));
  const dadosGerais =
    contrato.dadosGerais && typeof contrato.dadosGerais === "object" && !Array.isArray(contrato.dadosGerais)
      ? (contrato.dadosGerais as JsonObject)
      : {};

  const vendedor = {
    nome: payload.partes?.comprador?.nome || companyName || "-",
    documento:
      payload.partes?.comprador?.cnpjCpf ||
      pickString(contrato, ["empresa_cnpj", "empresa_cnpj_snapshot"]) ||
      "-",
    endereco: payload.partes?.comprador?.endereco || pickString(contrato, ["empresa_endereco"]) || "-",
    telefone: payload.partes?.comprador?.telefone || pickString(contrato, ["empresa_telefone"]) || "-",
    ie: payload.partes?.comprador?.rgIe || pickString(contrato, ["empresa_ie"]) || "-",
    cep: pickString(contrato, ["empresa_cep"]) || "-",
    cidadeUf:
      pickString(contrato, ["empresa_cidade_uf", "empresa_cidade", "cidade_nome", "cidade"]) ||
      payload.partes?.cidadeAssinatura ||
      "-",
    email: payload.partes?.comprador?.email || pickString(contrato, ["empresa_email"]) || "-",
  };

  const comprador = {
    nome:
      payload.partes?.vendedor?.nome ||
      pickString(dadosGerais, ["compradorNome", "comprador"]) ||
      pickString(contrato, ["parceiro_nome_base", "parceiro_nome_snapshot", "parceiro_nome"]) ||
      "-",
    documento:
      payload.partes?.vendedor?.cnpjCpf ||
      pickString(dadosGerais, ["compradorDocumento"]) ||
      pickString(contrato, ["parceiro_documento_base", "parceiro_documento_snapshot"]) ||
      "-",
    endereco: payload.partes?.vendedor?.endereco || pickString(contrato, ["parceiro_endereco"]) || "-",
    telefone: payload.partes?.vendedor?.telefone || pickString(contrato, ["parceiro_telefone"]) || "-",
    ie: payload.partes?.vendedor?.rgIe || pickString(contrato, ["parceiro_ie"]) || "-",
    cep: pickString(contrato, ["parceiro_cep"]) || "-",
    cidadeUf: pickString(contrato, ["parceiro_cidade_uf", "parceiro_cidade"]) || "-",
    email: payload.partes?.vendedor?.email || pickString(contrato, ["parceiro_email"]) || "-",
  };

  const faturamento = {
    nome:
      payload.partes?.faturamento?.nome ||
      pickString(dadosGerais, ["faturadorNome", "faturador"]) ||
      pickString(contrato, ["faturador_nome", "faturamento_nome", "faturador"]) ||
      comprador.nome,
    documento:
      payload.partes?.faturamento?.cnpjCpf ||
      pickString(dadosGerais, ["faturadorDocumento"]) ||
      pickString(contrato, ["faturador_documento", "faturador_cnpj", "faturador_cpf"]) ||
      comprador.documento,
    endereco: payload.partes?.faturamento?.endereco || pickString(contrato, ["faturador_endereco"]) || comprador.endereco,
    telefone: payload.partes?.faturamento?.telefone || pickString(contrato, ["faturador_telefone"]) || comprador.telefone,
    ie: payload.partes?.faturamento?.rgIe || pickString(contrato, ["faturador_ie"]) || comprador.ie,
    cep: pickString(contrato, ["faturador_cep"]) || comprador.cep,
    cidadeUf: pickString(contrato, ["faturador_cidade_uf", "faturador_cidade"]) || comprador.cidadeUf,
    email: payload.partes?.faturamento?.email || pickString(contrato, ["faturador_email"]) || comprador.email,
  };

  const frigorifico = {
    nome:
      payload.partes?.frigorifico?.nome ||
      pickString(dadosGerais, ["frigorificoNome", "frigorifico"]) ||
      pickString(contrato, ["frigorifico_nome", "frigorifico"]) ||
      "-",
    documento:
      payload.partes?.frigorifico?.cnpjCpf ||
      pickString(dadosGerais, ["frigorificoDocumento"]) ||
      pickString(contrato, ["frigorifico_documento", "frigorifico_cnpj", "frigorifico_cpf"]) ||
      "-",
    endereco: payload.partes?.frigorifico?.endereco || pickString(contrato, ["frigorifico_endereco"]) || "-",
    telefone: payload.partes?.frigorifico?.telefone || pickString(contrato, ["frigorifico_telefone"]) || "-",
    ie: payload.partes?.frigorifico?.rgIe || pickString(contrato, ["frigorifico_ie"]) || "-",
    cep: pickString(contrato, ["frigorifico_cep"]) || "-",
    cidadeUf: pickString(contrato, ["frigorifico_cidade_uf", "frigorifico_cidade"]) || "-",
    email: payload.partes?.frigorifico?.email || pickString(contrato, ["frigorifico_email"]) || "-",
  };

  const anuente = {
    nome:
      payload.partes?.anuente?.nome ||
      pickString(dadosGerais, ["anuenteNome", "anuente"]) ||
      pickString(contrato, ["anuente_nome", "anuente"]) ||
      "-",
    documento:
      payload.partes?.anuente?.cnpjCpf ||
      pickString(dadosGerais, ["anuenteDocumento"]) ||
      pickString(contrato, ["anuente_documento", "anuente_cnpj", "anuente_cpf"]) ||
      "-",
    endereco: payload.partes?.anuente?.endereco || pickString(contrato, ["anuente_endereco"]) || "-",
    telefone: payload.partes?.anuente?.telefone || pickString(contrato, ["anuente_telefone"]) || "-",
    ie: payload.partes?.anuente?.rgIe || pickString(contrato, ["anuente_ie"]) || "-",
    cep: pickString(contrato, ["anuente_cep"]) || "-",
    cidadeUf: pickString(contrato, ["anuente_cidade_uf", "anuente_cidade"]) || "-",
    email: payload.partes?.anuente?.email || pickString(contrato, ["anuente_email"]) || "-",
  };

  const itens = payload.itens || [];
  const fretes = payload.fretes || [];
  const financeiros = payload.financeiro || [];
  const firstItem = itens[0];
  const firstFinanceiro = financeiros[0];
  const totalCabecas = itens.reduce((sum, row) => sum + parseNumber(pickRow(row, ["quantidade", "qtd"])), 0);
  const mercadoria =
    resolveSaidaProdutoData(firstItem).descricao ||
    resolveSaidaProdutoData(firstItem).codigo ||
    "-";
  const valorArroba = pickRow(firstItem, ["valorUnitario"]) || "0,00";
  const pesoMedio = pickString(contrato, ["peso_bruto_cabeca", "peso_medio_abate"]) || "0,00";
  const rcGancho = pickString(contrato, ["rc_saida", "rc_entrada"]) || "0,00";
  const vencimento = formatDateBr(pickString(contrato, ["dt_vencimento"])) || "-";
  const formaPagamento = [pickRow(firstFinanceiro, ["formaPagamento"]), pickRow(firstFinanceiro, ["descricao"])]
    .filter(Boolean)
    .join(" | ");
  const prazo = pickRow(firstFinanceiro, ["condicaoPagamento"]) || "-";

  const bankText = [
    payload.partes?.comprador?.banco ? `Banco: ${payload.partes.comprador.banco}` : "",
    payload.partes?.comprador?.agencia ? `Agência: ${payload.partes.comprador.agencia}` : "",
    payload.partes?.comprador?.conta ? `Conta: ${payload.partes.comprador.conta}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const lineColor = rgb(0, 0, 0);
  let y = PAGE_HEIGHT - 28;

  const logoImage = brand === "almir" ? logos.almir : logos.captar;
  const logoDrawn = logoImage ? drawBrandImage(page, logoImage, MARGIN - 20, y - 42, 84, 40) : false;
  if (!logoDrawn) {
    if (brand === "almir") drawAlmirBrand(page, MARGIN - 20, y - 42, 84, 40, fontBold);
    else drawCaptarBrand(page, MARGIN - 20, y - 42, 84, 40, fontBold);
  }

  page.drawText(`Contrato de Venda: ${numeroContrato}`, {
    x: 167,
    y: y - 10,
    size: 10.8,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawText("Código:", { x: 442, y: y + 2, size: 8, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText(codigoContrato, { x: 492, y: y + 2, size: 7.4, font, color: rgb(0, 0, 0) });
  page.drawText("DATA:", { x: 442, y: y - 13, size: 8, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText(dataRef, { x: 492, y: y - 13, size: 7.4, font, color: rgb(0, 0, 0) });
  page.drawText("STATUS:", { x: 442, y: y - 28, size: 8, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText(statusRef, { x: 492, y: y - 28, size: 7.4, font, color: rgb(0, 0, 0) });
  y -= 50;

  const blockHeight = 58;
  y = drawSaidaAnimaisPartyBlock(page, font, fontBold, y, "VENDEDOR", vendedor, lineColor, blockHeight);
  y = drawSaidaAnimaisPartyBlock(page, font, fontBold, y, "COMPRADOR", comprador, lineColor, blockHeight);
  y = drawSaidaAnimaisPartyBlock(page, font, fontBold, y, "FATURAMENTO", faturamento, lineColor, blockHeight);
  y = drawSaidaAnimaisPartyBlock(page, font, fontBold, y, "FRIGORÍFICO", frigorifico, lineColor, blockHeight);
  y = drawSaidaAnimaisPartyBlock(page, font, fontBold, y, "ANUENTE", anuente, lineColor, blockHeight);

  const boxTop = y - 8;
  const boxHeight = 96;
  page.drawRectangle({
    x: 12,
    y: boxTop - boxHeight,
    width: PAGE_WIDTH - 24,
    height: boxHeight,
    borderColor: lineColor,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  let infoY = boxTop - 12;
  const leftX = 20;
  const midX = 176;
  const rightX = 332;
  const farRightX = 468;

  drawInfo(page, font, fontBold, leftX, infoY, "Mercadoria:", mercadoria);
  drawInfo(page, font, fontBold, midX, infoY, "NOVILHA PARA ABATE", "");
  drawInfo(page, font, fontBold, rightX, infoY, "Frete(@):", formatMoneyBr(pickString(contrato, ["vl_unit_frete"]) || "0"));
  drawInfo(page, font, fontBold, farRightX, infoY, "Peso Médio (@):", formatMoneyBr(pesoMedio));

  infoY -= 15;
  drawInfo(page, font, fontBold, leftX, infoY, "Forma de Pagamento:", formaPagamento || "-");
  drawInfo(page, font, fontBold, rightX, infoY, "Prazo:", prazo || "-");

  infoY -= 15;
  drawInfo(page, font, fontBold, leftX, infoY, "Obs Financeiras:", pickString(contrato, ["observacao_financeiro"]) || "-");
  drawInfo(page, font, fontBold, rightX, infoY, "Vencimento:", vencimento);

  infoY -= 16;
  const companyLine = [vendedor.nome, vendedor.documento, payload.partes?.comprador?.banco, payload.partes?.comprador?.agencia, payload.partes?.comprador?.conta]
    .filter(Boolean)
    .join("   ");
  page.drawText(companyLine || "-", { x: leftX, y: infoY, size: 6.7, font, color: rgb(0, 0, 0) });

  infoY -= 14;
  page.drawText(`Observações Gerais: ${pickString(contrato, ["observacao", "execucao", "objeto"]) || "-"}`, {
    x: leftX,
    y: infoY,
    size: 6.7,
    font,
    color: rgb(0, 0, 0),
  });

  y = boxTop - boxHeight - 10;

  const tableTop = y;
  page.drawRectangle({
    x: 12,
    y: tableTop - 132,
    width: PAGE_WIDTH - 24,
    height: 132,
    borderColor: lineColor,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });
  page.drawText("AGENDAMENTO DE FRETES", {
    x: 52,
    y: tableTop - 12,
    size: 8.6,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawText("Observações Transporte:", {
    x: 352,
    y: tableTop - 12,
    size: 6.8,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: 12, y: tableTop - 18 },
    end: { x: PAGE_WIDTH - 12, y: tableTop - 18 },
    thickness: 0.8,
    color: lineColor,
  });

  const headers = [
    ["Embarque", 22],
    ["Abate", 73],
    ["Cabeças", 116],
    ["Placas", 163],
    ["Tipo Caminhão", 209],
    ["Transportadora", 292],
    ["Frete", 399],
    ["KM", 431],
    ["Frete (R$)", 456],
    ["R$ / Km", 517],
  ] as const;
  for (const [label, x] of headers) {
    page.drawText(label, { x, y: tableTop - 30, size: 6.3, font: fontBold, color: rgb(0, 0, 0) });
  }
  page.drawLine({
    start: { x: 12, y: tableTop - 34 },
    end: { x: PAGE_WIDTH - 12, y: tableTop - 34 },
    thickness: 0.6,
    color: lineColor,
  });

  const freteRows = fretes.length > 0 ? fretes : [{} as Row];
  let rowY = tableTop - 46;
  for (const row of freteRows.slice(0, 7)) {
    const valorFrete = parseNumber(pickRow(row, ["valor"]));
    const km = parseNumber(pickRow(row, ["km"]));
    const rsKm = km > 0 ? valorFrete / km : 0;
    page.drawText(formatDateBr(pickRow(row, ["dataEmbarque"])) || "-", { x: 22, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(formatDateBr(pickRow(row, ["dataEntrega"])) || "-", { x: 73, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(formatDecimalBr(parseNumber(pickRow(row, ["qtd", "quantidade"]))), { x: 116, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(pickRow(row, ["placa"]) || "-", { x: 163, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(pickRow(row, ["equipamento"]) || "-", { x: 209, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(pickRow(row, ["transportador"]) || "-", { x: 292, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(pickRow(row, ["frete"]) || "-", { x: 399, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(formatDecimalBr(km), { x: 431, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(formatMoneyBr(String(valorFrete)), { x: 456, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    page.drawText(formatMoneyBr(String(rsKm)), { x: 517, y: rowY, size: 6.2, font, color: rgb(0, 0, 0) });
    rowY -= 12.5;
  }

  const cidadeAssinatura =
    payload.partes?.cidadeAssinatura ||
    pickString(contrato, ["cidade_assinatura", "cidade_nome", "cidade", "municipio_nome", "municipio"]) ||
    "Luís Eduardo Magalhães, Bahia";
  const assinaturaPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawClosingSignaturesSection(assinaturaPage, font, fontBold, PAGE_HEIGHT - MARGIN - 30, {
    cidade: cidadeAssinatura,
    dataAssinatura:
      formatDateBr(pickString(contrato, ["dt_assinatura"])) || formatDateBr(new Date().toISOString()),
    compradorNome: comprador.nome || "-",
    vendedorNome: vendedor.nome || "-",
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

function drawSaidaAnimaisPartyBlock(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  topY: number,
  title: string,
  data: {
    nome: string;
    documento: string;
    endereco: string;
    telefone: string;
    ie: string;
    cep: string;
    cidadeUf: string;
    email: string;
  },
  lineColor: ReturnType<typeof rgb>,
  blockHeight: number,
): number {
  page.drawRectangle({
    x: 12,
    y: topY - blockHeight,
    width: PAGE_WIDTH - 24,
    height: blockHeight,
    borderColor: lineColor,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  const row1Y = topY - 12;
  const row2Y = topY - 28;
  const row3Y = topY - 43;
  const leftX = 20;
  const midX = 280;
  const rightX = 430;
  const contentRight = PAGE_WIDTH - 20;

  page.drawText(title, { x: leftX, y: row1Y, size: 8.2, font: fontBold, color: rgb(0, 0, 0) });
  const nomeValue = fitTextToWidth((data.nome || "-").toUpperCase(), font, 6.5, midX - (leftX + 52) - 8);
  page.drawText(nomeValue, { x: leftX + 52, y: row1Y, size: 6.5, font, color: rgb(0, 0, 0) });
  page.drawText("CNPJ/CPF:", { x: midX, y: row1Y, size: 7.4, font: fontBold, color: rgb(0, 0, 0) });
  const documentoValue = fitTextToWidth(data.documento || "-", font, 6.5, contentRight - (midX + 58));
  page.drawText(documentoValue, { x: midX + 58, y: row1Y, size: 6.5, font, color: rgb(0, 0, 0) });

  drawInfo(page, font, fontBold, leftX, row2Y, "Endereço:", data.endereco || "-", 180);
  drawInfo(page, font, fontBold, midX, row2Y, "Telefone:", data.telefone || "-", 86);
  drawInfo(page, font, fontBold, rightX, row2Y, "IE:", data.ie || "-", 62);

  drawInfo(page, font, fontBold, leftX, row3Y, "CEP:", data.cep || "-", 58);
  drawInfo(page, font, fontBold, 120, row3Y, "Cidade/UF:", data.cidadeUf || "-", 120);
  drawInfo(page, font, fontBold, midX, row3Y, "E-mail:", data.email || "-", 160);

  return topY - blockHeight;
}

function drawInfo(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  y: number,
  label: string,
  value: string,
  maxValueWidth?: number,
) {
  const labelWidth = fontBold.widthOfTextAtSize(label, 7.2);
  const safeValue =
    maxValueWidth && maxValueWidth > 0
      ? fitTextToWidth(value || "-", font, 6.5, maxValueWidth)
      : (value || "-");
  page.drawText(label, { x, y, size: 7.2, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText(safeValue, { x: x + labelWidth + 3, y, size: 6.5, font, color: rgb(0, 0, 0) });
}

function statusLabelForPdf(value: string): string {
  const normalized = normalizeSearch(value);
  if (normalized.includes("aguardando")) return "Aguardando Aprovação";
  if (normalized === "ativo") return "Ativo";
  if (normalized.includes("contendo") || normalized.includes("conferido")) return "Conferido Parcialmente";
  if (normalized === "encerrado") return "Encerrado";
  if (normalized.includes("inativo")) return "Inativo/Cancelado";
  return value || "-";
}

type SaidaResumoRow = {
  label: string;
  value: string;
  fullWidth?: boolean;
};

type SaidaClauseView = {
  titulo: string;
  descricao: string;
};

async function buildSaidaInsumosPdf(
  kind: "saida_insumos" | "entrada_insumos",
  payload: ContratoPayload,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logos = await loadBrandLogoImages(pdf);

  const contrato = payload.contrato || {};
  const companyName = pickString(contrato, ["empresa_nome", "empresaNome", "empresa"]);
  const brand = resolveBrand(companyName);
  const numeroContrato = pickString(contrato, ["numero"]);
  const exercicioContrato = pickString(contrato, ["ano", "exercicio"]);

  const compradorNome =
    payload.partes?.comprador?.nome ||
    pickString(contrato, ["empresa_nome", "empresa_nome_snapshot", "empresa"]) ||
    "-";
  const compradorDoc =
    payload.partes?.comprador?.cnpjCpf ||
    pickString(contrato, ["empresa_cnpj", "empresa_cnpj_snapshot"]) ||
    "-";
  const vendedorNome =
    payload.partes?.vendedor?.nome ||
    pickString(contrato, ["parceiro_nome_base", "parceiro_nome_snapshot"]) ||
    "-";
  const vendedorDoc =
    payload.partes?.vendedor?.cnpjCpf ||
    pickString(contrato, ["parceiro_documento_base", "parceiro_documento_snapshot"]) ||
    "-";

  const tituloPadrao = "CONTRATO DE COMPRA E VENDA DE INSUMOS";
  const clausulaTitulo = (
    pickString(contrato, ["titulo_clausula", "clausulaTitulo"]) ||
    pickRow(payload.clausulas?.[0], ["referencia", "titulo"]) ||
    tituloPadrao
  ).toUpperCase();
  const subTitulo = (
    pickString(contrato, ["empresa_nome", "empresa_nome_snapshot", "empresa"]) || compradorNome
  ).toUpperCase();

  const intro = buildSaidaIntroParagraph({
    brand,
    tituloContrato: clausulaTitulo,
    comprador: {
      nome: compradorNome,
      documento: compradorDoc,
      rgIe: payload.partes?.comprador?.rgIe || "",
      endereco: payload.partes?.comprador?.endereco || "",
    },
    vendedor: {
      nome: vendedorNome,
      documento: vendedorDoc,
      rgIe: payload.partes?.vendedor?.rgIe || "",
      endereco: payload.partes?.vendedor?.endereco || "",
    },
  });

  const resumoRows = buildSaidaResumoRows(payload);
  const clausulas: SaidaClauseView[] = (payload.clausulas || [])
    .map((clausula, index) => {
      const referencia = pickRow(clausula, ["referencia", "titulo"]);
      const titulo = referencia || `CLÁUSULA ${index + 1}`;
      const descricao = pickRow(clausula, ["descricao", "conteudo"]) || "-";
      return { titulo, descricao };
    })
    .filter((row) => row.descricao !== "-" || row.titulo !== "");

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = drawSaidaHeader(page, font, fontBold, {
    brand,
    logos,
    numeroContrato,
    exercicio: exercicioContrato,
    titulo: clausulaTitulo,
    subtitulo: subTitulo,
  });

  const ensureSpace = (height: number) => {
    if (cursorY - height >= MARGIN + 30) return;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = drawSaidaHeader(page, font, fontBold, {
      brand,
      logos,
      numeroContrato,
      exercicio: exercicioContrato,
      titulo: clausulaTitulo,
      subtitulo: subTitulo,
    });
  };

  const introLines = wrapText(intro, font, 10, CONTENT_WIDTH - 4);
  ensureSpace(introLines.length * 12 + 40);
  for (let index = 0; index < introLines.length; index += 1) {
    const line = introLines[index];
    const isLastLine = index === introLines.length - 1;
    drawParagraphLine(page, font, {
      text: line,
      x: MARGIN + 2,
      y: cursorY,
      size: 10,
      maxWidth: CONTENT_WIDTH - 4,
      justify: !isLastLine,
    });
    cursorY -= 12;
  }
  cursorY -= 8;

  if (resumoRows.length > 0) {
    if (kind === "entrada_insumos") {
      const tableX = MARGIN + 2;
      const tableWidth = CONTENT_WIDTH - 4;
      const labelColWidth = 220;
      const valueColWidth = tableWidth - labelColWidth;

      for (const row of resumoRows) {
        const labelLines = wrapText(row.label, fontBold, 9.2, labelColWidth - 10);
        const valueLines = wrapText(row.value, font, 9.2, valueColWidth - 10);
        const lines = Math.max(labelLines.length, valueLines.length, 1);
        const rowHeight = Math.max(22, lines * 10 + 8);

        ensureSpace(rowHeight + 10);
        page.drawRectangle({
          x: tableX,
          y: cursorY - rowHeight,
          width: tableWidth,
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.7,
          color: rgb(1, 1, 1),
        });
        page.drawLine({
          start: { x: tableX + labelColWidth, y: cursorY },
          end: { x: tableX + labelColWidth, y: cursorY - rowHeight },
          thickness: 0.7,
          color: rgb(0, 0, 0),
        });

        let labelY = cursorY - 14;
        for (const line of labelLines) {
          page.drawText(line, {
            x: tableX + 6,
            y: labelY,
            size: 9.2,
            font: fontBold,
            color: COLOR_TEXT,
          });
          labelY -= 10;
        }

        let valueY = cursorY - 14;
        for (const line of valueLines) {
          page.drawText(line, {
            x: tableX + labelColWidth + 6,
            y: valueY,
            size: 9.2,
            font,
            color: COLOR_TEXT,
          });
          valueY -= 10;
        }

        cursorY -= rowHeight;
      }
      cursorY -= 12;
    } else {
      cursorY = drawSaidaSectionTitle(page, fontBold, cursorY, "Dados da Negociação") - 10;
      const leftX = MARGIN + 2;
      const columnGap = 18;
      const columnWidth = (CONTENT_WIDTH - 4 - columnGap) / 2;
      const rightX = leftX + columnWidth + columnGap;

      const drawResumoBloco = (row: SaidaResumoRow, x: number, width: number): number => {
        page.drawText(row.label.toUpperCase(), {
          x,
          y: cursorY,
          size: 9.4,
          font: fontBold,
          color: COLOR_TEXT,
        });

        const valueLines = wrapText(row.value, font, 9.8, width);
        let blockY = cursorY - 12;
        for (const line of valueLines) {
          page.drawText(line, {
            x,
            y: blockY,
            size: 9.8,
            font,
            color: COLOR_TEXT,
          });
          blockY -= 10.2;
        }
        return 12 + valueLines.length * 10.2 + 8;
      };

      let rowIndex = 0;
      while (rowIndex < resumoRows.length) {
        const current = resumoRows[rowIndex];
        const next = resumoRows[rowIndex + 1];

        if (current.fullWidth) {
          const needed = 12 + wrapText(current.value, font, 9.8, CONTENT_WIDTH - 4).length * 10.2 + 8;
          ensureSpace(needed);
          const consumed = drawResumoBloco(current, leftX, CONTENT_WIDTH - 4);
          cursorY -= consumed;
          rowIndex += 1;
          continue;
        }

        if (!next || next.fullWidth) {
          const needed = 12 + wrapText(current.value, font, 9.8, columnWidth).length * 10.2 + 8;
          ensureSpace(needed);
          const consumed = drawResumoBloco(current, leftX, columnWidth);
          cursorY -= consumed;
          rowIndex += 1;
          continue;
        }

        const leftNeeded = 12 + wrapText(current.value, font, 9.8, columnWidth).length * 10.2 + 8;
        const rightNeeded = 12 + wrapText(next.value, font, 9.8, columnWidth).length * 10.2 + 8;
        const needed = Math.max(leftNeeded, rightNeeded);
        ensureSpace(needed);

        const leftConsumed = drawResumoBloco(current, leftX, columnWidth);
        const rightConsumed = drawResumoBloco(next, rightX, columnWidth);
        cursorY -= Math.max(leftConsumed, rightConsumed);
        rowIndex += 2;
      }
    }
  }

  const sectionTitleY = drawSaidaSectionTitle(page, fontBold, cursorY, "Cláusulas");
  cursorY = sectionTitleY - 10;

  if (clausulas.length === 0) {
    ensureSpace(26);
    page.drawText("Nenhuma cláusula cadastrada para este contrato.", {
      x: MARGIN + 2,
      y: cursorY,
      size: 10,
      font,
      color: COLOR_TEXT,
    });
    cursorY -= 20;
  } else {
    for (const clausula of clausulas) {
      const titulo = wrapText(clausula.titulo, fontBold, 10.2, CONTENT_WIDTH - 4);
      const descricao = wrapText(clausula.descricao, font, 9.8, CONTENT_WIDTH - 4);
      const needed = titulo.length * 11.2 + descricao.length * 10.2 + 12;
      ensureSpace(needed);

      for (const line of titulo) {
        page.drawText(line, {
          x: MARGIN + 2,
          y: cursorY,
          size: 10.2,
          font: fontBold,
          color: COLOR_TEXT,
        });
        cursorY -= 11.2;
      }
      cursorY -= 2;

      for (let index = 0; index < descricao.length; index += 1) {
        const line = descricao[index];
        const isLastLine = index === descricao.length - 1;
        drawParagraphLine(page, font, {
          text: line,
          x: MARGIN + 2,
          y: cursorY,
          size: 9.8,
          maxWidth: CONTENT_WIDTH - 4,
          justify: !isLastLine,
        });
        cursorY -= 10.2;
      }
      cursorY -= 10;
    }
  }

  const cidadeAssinatura =
    payload.partes?.cidadeAssinatura ||
    pickString(contrato, ["cidade_assinatura", "cidade_nome", "cidade", "municipio_nome", "municipio"]) ||
    "LUIS EDUARDO MAGALHAES - BA";

  page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cursorY = PAGE_HEIGHT - MARGIN - 30;
  drawClosingSignaturesSection(page, font, fontBold, cursorY, {
    cidade: cidadeAssinatura,
    dataAssinatura: formatDateBr(pickString(contrato, ["dt_assinatura"])) || formatDateBr(new Date().toISOString()),
    compradorNome,
    vendedorNome,
    testemunha1: pickString(contrato, ["testemunha"]) || "TESTEMUNHA",
    testemunha2: pickString(contrato, ["testemunha2"]) || "TESTEMUNHA",
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

function buildSaidaIntroParagraph(params: {
  brand: BrandKind;
  tituloContrato: string;
  comprador: { nome: string; documento: string; rgIe: string; endereco: string };
  vendedor: { nome: string; documento: string; rgIe: string; endereco: string };
}): string {
  const compradorTxt = buildPartyIntroText({
    role: "comprador",
    brand: params.brand,
    nome: params.comprador.nome,
    documento: params.comprador.documento,
    rgIe: params.comprador.rgIe,
    endereco: params.comprador.endereco,
  });
  const vendedorTxt = buildPartyIntroText({
    role: "vendedor",
    brand: params.brand,
    nome: params.vendedor.nome,
    documento: params.vendedor.documento,
    rgIe: params.vendedor.rgIe,
    endereco: params.vendedor.endereco,
  });

  return (
    `Pelo presente instrumento particular, denominado de ${params.tituloContrato}, que fazem entre si, ` +
    `${compradorTxt}, doravante denominado COMPRADOR, e ${vendedorTxt}, doravante denominado VENDEDOR(a), ` +
    "fica justo e contratado o presente contrato de acordo com as cláusulas e condições a seguir:"
  );
}

function buildPartyIntroText(params: {
  role: "comprador" | "vendedor";
  brand: BrandKind;
  nome: string;
  documento: string;
  rgIe: string;
  endereco: string;
}): string {
  if (params.role === "comprador" && params.brand === "almir") {
    return (
      "ALMIR FRANCISCO DE MORAES FILHO, Pessoa Física de direito privado CPF no. 349.883.945-49, " +
      "I.E n. -, com sede em BR 242, KM 897, LUÍS EDUARDO MAGALHÃES-BA, CEP 47850-000"
    );
  }

  const nome = params.nome || "-";
  const documento = params.documento || "-";
  const endereco = params.endereco || "-";
  const pessoa = resolvePessoaTipo(documento);
  const rgIe = params.rgIe || "-";

  return `${nome}, ${pessoa}, com CPF/CNPJ no ${documento}, I.E n. ${rgIe}, com sede em ${endereco}`;
}

function resolvePessoaTipo(documento: string): string {
  const digits = String(documento || "").replace(/\D/g, "");
  if (digits.length > 0 && digits.length <= 11) return "Pessoa Física de direito privado";
  return "Pessoa Jurídica de direito privado";
}

function buildSaidaResumoRows(payload: ContratoPayload): SaidaResumoRow[] {
  const rows: SaidaResumoRow[] = [];
  const itens = payload.itens || [];
  const fretes = payload.fretes || [];
  const financeiros = payload.financeiro || [];
  const dadosGerais = readDadosGerais(payload.contrato);

  const primeiroItem = itens[0];
  const primeiroFrete = fretes[0];
  const primeiroFinanceiro = financeiros[0];
  const totalItens = itens.reduce((sum, item) => sum + parseNumber(pickRow(item, ["valorTotal"])), 0);
  const totalQuantidade = itens.reduce((sum, item) => sum + parseNumber(pickRow(item, ["quantidade", "qtd"])), 0);

  const pushIfValue = (label: string, value: string, fullWidth = false) => {
    const text = String(value || "").trim();
    if (!text || text === "-") return;
    rows.push({ label, value: text, fullWidth });
  };

  const produtosDescricao = resolveSaidaProdutosDescricao(itens);
  if (produtosDescricao.length > 0) {
    pushIfValue(produtosDescricao.length > 1 ? "Produtos" : "Produto", produtosDescricao.join(" | "), true);
  } else {
    const produto = resolveSaidaProdutoData(primeiroItem);
    pushIfValue("Produto", produto.descricao || produto.codigo || "-");
  }
  if (primeiroItem) pushIfValue("Preço (R$/Kg)", formatMoneyBr(pickRow(primeiroItem, ["valorUnitario"])));
  if (totalQuantidade > 0) {
    pushIfValue("Quantidade", formatDecimalBr(totalQuantidade));
  } else {
    pushIfValue("Quantidade", pickRow(primeiroItem, ["quantidade"]));
  }
  if (totalItens > 0) pushIfValue("Valor Previsto", formatMoneyBr(String(totalItens)));

  const banco = payload.partes?.vendedor?.banco || payload.partes?.comprador?.banco || "";
  const agencia = payload.partes?.vendedor?.agencia || payload.partes?.comprador?.agencia || "";
  const conta = payload.partes?.vendedor?.conta || payload.partes?.comprador?.conta || "";
  const digito = payload.partes?.vendedor?.digito || payload.partes?.comprador?.digito || "";
  if (banco || agencia || conta) {
    pushIfValue(
      "Dados Bancários para Pagamento",
      `Banco: ${banco || "-"} | Agência: ${agencia || "-"} | Conta: ${conta || "-"}${digito ? `-${digito}` : ""}`,
      true,
    );
  }

  const condicao = pickRow(primeiroFinanceiro, ["condicaoPagamento"]);
  const forma = pickRow(primeiroFinanceiro, ["formaPagamento"]);
  const descricaoFinanceiro = pickRow(primeiroFinanceiro, ["descricao"]);
  pushIfValue("Forma de Pagamento", [condicao, forma, descricaoFinanceiro].filter(Boolean).join(" | "), true);

  pushIfValue("Programação para Retirada", dadosGerais.programacaoRetirada, true);
  pushIfValue("Programação de Pagamento", dadosGerais.programacaoPagamento, true);

  if (primeiroFrete) {
    const freteTipo = pickRow(primeiroFrete, ["frete"]);
    const transportador = pickRow(primeiroFrete, ["transportador"]);
    const valor = pickRow(primeiroFrete, ["valor"]);
    const texto = [freteTipo, transportador, valor ? `Valor: ${formatMoneyBr(valor)}` : ""].filter(Boolean).join(" | ");
    pushIfValue("Frete", texto, true);
  }

  pushIfValue("Endereço para Entrega", dadosGerais.fazenda, true);
  if (dadosGerais.analises.length > 0) {
    pushIfValue("Classificação Limite", dadosGerais.analises.join(" | "), true);
  }

  return rows;
}

function drawSaidaHeader(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  params: {
    brand: BrandKind;
    logos: BrandLogoImages;
    numeroContrato: string;
    exercicio?: string;
    titulo: string;
    subtitulo: string;
  },
): number {
  const top = PAGE_HEIGHT - MARGIN;
  const logoX = MARGIN;
  const logoY = top - 54;
  const logoImage = params.brand === "almir" ? params.logos.almir : params.logos.captar;
  const logoDrawn = logoImage ? drawBrandImage(page, logoImage, logoX, logoY, 138, 54) : false;
  if (!logoDrawn) {
    if (params.brand === "almir") drawAlmirBrand(page, logoX, logoY, 138, 54, fontBold);
    else drawCaptarBrand(page, logoX, logoY, 172, 54, fontBold);
  }

  const numero = params.numeroContrato || "-";
  const exercicio = (params.exercicio || "").trim();
  const codigoCabecalho = exercicio ? `${numero}.${exercicio}` : numero;
  page.drawText(codigoCabecalho, {
    x: PAGE_WIDTH - MARGIN - fontBold.widthOfTextAtSize(codigoCabecalho, 10),
    y: top - 8,
    size: 10,
    font: fontBold,
    color: COLOR_TEXT,
  });

  drawCenteredText(page, fontBold, params.titulo, MARGIN, top - 28, CONTENT_WIDTH, 11);
  if (params.subtitulo) {
    drawCenteredText(page, fontBold, params.subtitulo, MARGIN, top - 48, CONTENT_WIDTH, 9.5);
  }

  return top - 92;
}

function drawSaidaSectionTitle(page: PDFPage, fontBold: PDFFont, y: number, title: string): number {
  page.drawText(title.toUpperCase(), {
    x: MARGIN,
    y,
    size: 10.8,
    font: fontBold,
    color: COLOR_TEXT,
  });
  const lineY = y - 6;
  page.drawLine({
    start: { x: MARGIN, y: lineY },
    end: { x: PAGE_WIDTH - MARGIN, y: lineY },
    thickness: 0.7,
    color: COLOR_LINE,
  });
  return lineY;
}

function readDadosGerais(contrato: JsonObject): {
  fazenda: string;
  programacaoRetirada: string;
  programacaoPagamento: string;
  analises: string[];
} {
  const meta = contrato?.dadosGerais;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return { fazenda: "", programacaoRetirada: "", programacaoPagamento: "", analises: [] };
  }
  const row = meta as Record<string, unknown>;
  const analisesRaw = Array.isArray(row.analises) ? row.analises : [];
  const analises = analisesRaw
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const current = item as Record<string, unknown>;
      const tipo = String(current.tipoAnalise || "").trim();
      const valor = String(current.valorMaximo || "").trim();
      if (!tipo && !valor) return "";
      if (!valor) return tipo;
      return `${tipo} (${valor})`;
    })
    .filter((item) => item.length > 0);
  return {
    fazenda: String(row.fazenda || "").trim(),
    programacaoRetirada: String(row.programacaoRetirada || "").trim(),
    programacaoPagamento: String(row.programacaoPagamento || "").trim(),
    analises,
  };
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
  const topLineRaw = `${(params.cidade || "Cidade não informada").toUpperCase()}, ${params.dataAssinatura || "-"}`;
  const topLine = fitTextToWidth(topLineRaw, font, 10, CONTENT_WIDTH - 16);
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

  const compradorNome = fitTextToWidth(normalizeSignatureName(params.compradorNome).toUpperCase(), fontBold, 9.2, lineWidth - 8);
  const vendedorNome = fitTextToWidth(normalizeSignatureName(params.vendedorNome).toUpperCase(), fontBold, 9.2, lineWidth - 8);
  drawCenteredText(page, fontBold, compradorNome, leftX, firstSignatureY - 14, lineWidth, 9.2);
  drawCenteredText(page, fontBold, vendedorNome, rightX, firstSignatureY - 14, lineWidth, 9.2);
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

  const testemunha1 = fitTextToWidth(normalizeSignatureName(params.testemunha1).toUpperCase(), fontBold, 9.2, lineWidth - 8);
  const testemunha2 = fitTextToWidth(normalizeSignatureName(params.testemunha2).toUpperCase(), fontBold, 9.2, lineWidth - 8);
  drawCenteredText(page, fontBold, testemunha1, leftX, witnessY - 14, lineWidth, 9.2);
  drawCenteredText(page, fontBold, testemunha2, rightX, witnessY - 14, lineWidth, 9.2);

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

function resolveSaidaProduto(item?: Row): string {
  return resolveSaidaProdutoData(item).descricao;
}

function resolveSaidaProdutosDescricao(itens: Row[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of itens) {
    const produto = resolveSaidaProdutoData(item);
    const descricao = (produto.descricao || produto.codigo || "").trim();
    if (!descricao) continue;
    const key = normalizeSearch(descricao);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(descricao);
  }
  return output;
}

function resolveSaidaProdutoData(item?: Row): { codigo: string; descricao: string } {
  if (!item) return { codigo: "", descricao: "" };

  const codeRaw =
    pickRow(item, ["itemId", "itemCodigo", "item_codigo_snapshot", "codigo"]) || "";
  const labelRaw =
    pickRow(item, ["item", "item_label_snapshot", "itemDescricao", "descricaoItem", "itemNome", "itemName"]) || "";
  const nameRaw =
    pickRow(item, ["item_nome_snapshot", "itemNome", "itemName", "itemDescricao", "descricaoItem"]) || "";

  const clean = (value: string) => value.replace(/^sap:[^:]+:/i, "").trim();
  let codigo = clean(codeRaw);
  let descricao = clean(nameRaw);
  const label = clean(labelRaw);

  if (label) {
    const separator = " - ";
    const separatorIndex = label.indexOf(separator);
    if (separatorIndex > 0) {
      const labelCode = label.slice(0, separatorIndex).trim();
      const labelDesc = label.slice(separatorIndex + separator.length).replace(/^\-\s*/, "").trim();
      if (!codigo) codigo = labelCode;
      if (!descricao) descricao = labelDesc;
    } else {
      if (!codigo) codigo = label;
      if (!descricao && label !== codigo) descricao = label;
    }
  }

  if (!descricao) descricao = codigo;
  return { codigo, descricao };
}

function formatDecimalBr(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function drawParagraphLine(
  page: PDFPage,
  font: PDFFont,
  params: {
    text: string;
    x: number;
    y: number;
    size: number;
    maxWidth: number;
    justify: boolean;
  },
) {
  const content = (params.text || "").trim();
  if (!content) return;

  if (!params.justify) {
    page.drawText(content, {
      x: params.x,
      y: params.y,
      size: params.size,
      font,
      color: COLOR_TEXT,
    });
    return;
  }

  const words = content.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    page.drawText(content, {
      x: params.x,
      y: params.y,
      size: params.size,
      font,
      color: COLOR_TEXT,
    });
    return;
  }

  const normalized = words.join(" ");
  const baseWidth = font.widthOfTextAtSize(normalized, params.size);
  if (baseWidth >= params.maxWidth - 0.3) {
    page.drawText(normalized, {
      x: params.x,
      y: params.y,
      size: params.size,
      font,
      color: COLOR_TEXT,
    });
    return;
  }

  const gapCount = words.length - 1;
  const spaceWidth = font.widthOfTextAtSize(" ", params.size);
  const extraPerGap = (params.maxWidth - baseWidth) / gapCount;
  let cursorX = params.x;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    page.drawText(word, {
      x: cursorX,
      y: params.y,
      size: params.size,
      font,
      color: COLOR_TEXT,
    });
    cursorX += font.widthOfTextAtSize(word, params.size);
    if (index < gapCount) {
      cursorX += spaceWidth + extraPerGap;
    }
  }
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

function fitTextToWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string {
  const content = String(text || "-").replace(/\s+/g, " ").trim() || "-";
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return content;
  if (font.widthOfTextAtSize(content, fontSize) <= maxWidth) return content;

  const ellipsis = "...";
  if (font.widthOfTextAtSize(ellipsis, fontSize) > maxWidth) return "";

  let low = 0;
  let high = content.length;
  let best = ellipsis;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${content.slice(0, mid).trimEnd()}${ellipsis}`;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function normalizeSignatureName(value: string | null | undefined): string {
  const raw = String(value || "-").replace(/\s+/g, " ").trim() || "-";
  const parts = raw.split(/\s*-\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return raw;

  const first = parts[0] || "";
  const last = parts[parts.length - 1] || "";
  const firstLooksCode = /^[a-z]?\d{2,}$/i.test(first) || /^[a-z]+\d+$/i.test(first);
  const lastDigits = last.replace(/\D/g, "");
  const lastLooksDocument = lastDigits.length >= 8;

  if (!firstLooksCode) return raw;
  const coreParts = parts.slice(1, lastLooksDocument ? -1 : undefined);
  const cleaned = coreParts.join(" - ").replace(/\s+/g, " ").trim();
  return cleaned || raw;
}

function normalizeSearch(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}


