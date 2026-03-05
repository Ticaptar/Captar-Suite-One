import { NextResponse } from "next/server";
import {
  createPesagemEntradaAnimais,
  listPesagensEntradaAnimais,
} from "@/lib/repositories/pesagens-entrada-animais-repo";
import type { PesagemStatus } from "@/lib/types/pesagem";

export const runtime = "nodejs";

const validStatus = new Set<PesagemStatus>([
  "disponivel",
  "peso_finalizado",
  "fechado",
  "cancelado",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(searchParams.get("pageSize"), 25), 100);
  const search = searchParams.get("search");
  const statusParam = searchParams.get("status");

  let status: PesagemStatus | null = null;
  if (statusParam) {
    if (!validStatus.has(statusParam as PesagemStatus)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }
    status = statusParam as PesagemStatus;
  }

  try {
    const data = await listPesagensEntradaAnimais({
      status,
      search,
      page,
      pageSize,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao listar pesagens.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Body invalido." }, { status: 400 });
  }

  const status = toOptionalString(body.status) as PesagemStatus | undefined;
  if (status && !validStatus.has(status)) {
    return NextResponse.json({ error: "Status invalido." }, { status: 400 });
  }

  const pesoBruto = parseOptionalNumber(body.pesoBruto);
  const pesoTara = parseOptionalNumber(body.pesoTara);
  const operacaoInformada = toOptionalNullableString(body.operacao);
  const dataChegada = toOptionalNullableString(body.dataChegada);
  const horaChegada = toOptionalNullableString(body.horaChegada);
  const dataSaida = toOptionalNullableString(body.dataSaida);
  const horaSaida = toOptionalNullableString(body.horaSaida);
  const dataInicio = toOptionalNullableString(body.dataInicio);
  const dataFim = toOptionalNullableString(body.dataFim);

  const validationError = validatePesagemForm({
    pesoBruto,
    pesoTara,
    dataChegada,
    horaChegada,
    dataSaida,
    horaSaida,
    dataInicio,
    dataFim,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  let fluxo: { status: PesagemStatus; operacao: string };
  try {
    fluxo = resolveFluxoPesagem({
      status: status ?? "disponivel",
      pesoBruto,
      pesoTara,
      operacaoInformada,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fluxo de pesagem invalido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const created = await createPesagemEntradaAnimais({
      status: fluxo.status,
      tipo: "entrada_animais",
      numeroTicket: toOptionalNullableString(body.numeroTicket),
      contratoId: parseOptionalNullableNonZeroInt(body.contratoId),
      contratoReferencia: toOptionalNullableString(body.contratoReferencia),
      itemId: parseOptionalNullableNonZeroInt(body.itemId),
      itemDescricao: toOptionalNullableString(body.itemDescricao),
      fazendaId: parseOptionalNullableNonZeroInt(body.fazendaId),
      fazendaNome: toOptionalNullableString(body.fazendaNome),
      tipoFrete: toOptionalNullableString(body.tipoFrete),
      responsavelFrete: toOptionalNullableString(body.responsavelFrete),
      transportadorId: parseOptionalNullableNonZeroInt(body.transportadorId),
      transportadorNome: toOptionalNullableString(body.transportadorNome),
      contratanteId: parseOptionalNullableNonZeroInt(body.contratanteId),
      contratanteNome: toOptionalNullableString(body.contratanteNome),
      motoristaId: parseOptionalNullableNonZeroInt(body.motoristaId),
      motoristaNome: toOptionalNullableString(body.motoristaNome),
      dataChegada,
      horaChegada,
      dataSaida,
      horaSaida,
      placa: toOptionalNullableString(body.placa),
      equipamentoId: parseOptionalNullableNonZeroInt(body.equipamentoId),
      equipamentoNome: toOptionalNullableString(body.equipamentoNome),
      viagem: toOptionalNullableString(body.viagem),
      dataInicio,
      dataFim,
      kmInicial: parseOptionalNumber(body.kmInicial),
      kmFinal: parseOptionalNumber(body.kmFinal),
      kmTotal: parseOptionalNumber(body.kmTotal),
      observacao: toOptionalNullableString(body.observacao),
      pesoBruto,
      pesoTara,
      pesoLiquido: parseOptionalNumber(body.pesoLiquido),
      operacao: fluxo.operacao,
      documentosFiscais: parseDocumentos(body.documentosFiscais),
      motivosAtraso: parseMotivos(body.motivosAtraso),
      motivosEspera: parseMotivos(body.motivosEspera),
      calendario: parseCalendario(body.calendario),
      gtaRows: parseGtaRows(body.gtaRows),
      fechamento: parseFechamento(body.fechamento),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar pesagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseOptionalNullableNonZeroInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return parsed;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function toOptionalNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseDocumentos(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return { documento: String(row.documento ?? "").trim() };
    });
}

function parseMotivos(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        motivo: String(row.motivo ?? "").trim(),
        tempoMinutos: Number.parseInt(String(row.tempoMinutos ?? 0), 10) || 0,
      };
    });
}

function parseCalendario(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        data: String(row.data ?? "").trim(),
        dia: String(row.dia ?? "").trim(),
        feriado: toBoolean(row.feriado),
        pago: toBoolean(row.pago),
        valor: parseOptionalNumber(row.valor) ?? 0,
      };
    });
}

function parseGtaRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        gta: String(row.gta ?? "").trim(),
        quantidadeMachos: parseOptionalInteger(row.quantidadeMachos) ?? 0,
        quantidadeFemeas: parseOptionalInteger(row.quantidadeFemeas) ?? 0,
        quantidadeTotal: parseOptionalInteger(row.quantidadeTotal) ?? 0,
      };
    });
}

function parseFechamento(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return {
    tabelaFrete: toOptionalNullableString(row.tabelaFrete),
    calculoFrete: toOptionalNullableString(row.calculoFrete),
    periodoProducaoAgricola: toOptionalNullableString(row.periodoProducaoAgricola),
    unidadeMedidaFrete: toOptionalNullableString(row.unidadeMedidaFrete),
    valorUnitarioFrete: parseOptionalNumber(row.valorUnitarioFrete) ?? 0,
    valorCombustivel: parseOptionalNumber(row.valorCombustivel) ?? 0,
    valorPedagio: parseOptionalNumber(row.valorPedagio) ?? 0,
    outrasDespesas: parseOptionalNumber(row.outrasDespesas) ?? 0,
    litragem: parseOptionalNumber(row.litragem) ?? 0,
    valorCombLitro: parseOptionalNumber(row.valorCombLitro) ?? 0,
    valorDiaria: parseOptionalNumber(row.valorDiaria) ?? 0,
    valorComissao: parseOptionalNumber(row.valorComissao) ?? 0,
    valorFrete: parseOptionalNumber(row.valorFrete) ?? 0,
    pesagemOrigem: toOptionalNullableString(row.pesagemOrigem),
    dataVencimento: toOptionalNullableString(row.dataVencimento),
    qtdAnimais: parseOptionalInteger(row.qtdAnimais) ?? 0,
    qtdAnimaisOrigem: parseOptionalInteger(row.qtdAnimaisOrigem) ?? 0,
    mapaPesagem: toOptionalNullableString(row.mapaPesagem),
    cte: toOptionalNullableString(row.cte),
    nfExterna: toOptionalNullableString(row.nfExterna),
  };
}

function parseOptionalInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function validatePesagemForm(args: {
  pesoBruto: number | null;
  pesoTara: number | null;
  dataChegada: string | null;
  horaChegada: string | null;
  dataSaida: string | null;
  horaSaida: string | null;
  dataInicio: string | null;
  dataFim: string | null;
}): string | null {
  const pesoBruto = Math.max(0, Number(args.pesoBruto ?? 0));
  const pesoTara = Math.max(0, Number(args.pesoTara ?? 0));

  if (pesoBruto > 0 && pesoTara > pesoBruto) {
    return "Peso tara nao pode ser maior que peso bruto.";
  }

  const chegada = combineDateTime(args.dataChegada, args.horaChegada);
  const saida = combineDateTime(args.dataSaida, args.horaSaida);
  if (chegada && saida && saida.getTime() < chegada.getTime()) {
    return "Data/Hora de saida nao pode ser anterior a Data/Hora de chegada.";
  }

  const inicio = parseDateOnly(args.dataInicio);
  const fim = parseDateOnly(args.dataFim);
  if (inicio && fim && fim.getTime() < inicio.getTime()) {
    return "Data fim nao pode ser anterior a data inicio.";
  }

  return null;
}

function parseDateOnly(value: string | null): Date | null {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function combineDateTime(dateValue: string | null, timeValue: string | null): Date | null {
  const dateText = String(dateValue ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const timeText = String(timeValue ?? "").trim();
  const normalizedTime = /^\d{2}:\d{2}$/.test(timeText) ? `${timeText}:00` : "00:00:00";
  const parsed = new Date(`${dateText}T${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveFluxoPesagem(args: {
  status: PesagemStatus;
  pesoBruto: number | null;
  pesoTara: number | null;
  operacaoInformada: string | null;
}): { status: PesagemStatus; operacao: string } {
  const bruto = Math.max(0, Number(args.pesoBruto ?? 0));
  const tara = Math.max(0, Number(args.pesoTara ?? 0));
  const requestedStatus = args.status;
  const operacaoInformada = args.operacaoInformada;

  if (tara > 0 && bruto <= 0) {
    throw new Error("Fluxo invalido: capture o peso bruto antes da tara.");
  }

  if (requestedStatus === "cancelado") {
    return { status: "cancelado", operacao: "PESAGEM CANCELADA" };
  }

  if (requestedStatus === "fechado") {
    return { status: "fechado", operacao: "PESAGEM FECHADA" };
  }

  if (bruto <= 0 && tara <= 0) {
    return {
      status: "disponivel",
      operacao: operacaoInformada?.trim() || "CAMINHAO AGUARDANDO ENTRADA",
    };
  }

  if (bruto > 0 && tara <= 0) {
    return {
      status: "disponivel",
      operacao: "CAMINHAO EM RETORNO PARA TARA",
    };
  }

  return {
    status: "peso_finalizado",
    operacao: "CAMINHAO RETORNOU - PESO FINALIZADO",
  };
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").toLowerCase().trim();
  return normalized === "true" || normalized === "1" || normalized === "sim";
}


