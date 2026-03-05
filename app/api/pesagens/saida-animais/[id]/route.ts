import { NextResponse } from "next/server";
import {
  getPesagemSaidaAnimaisById,
  updatePesagemSaidaAnimais,
} from "@/lib/repositories/pesagens-saida-animais-repo";
import type { PesagemStatus } from "@/lib/types/pesagem";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const validStatus = new Set<PesagemStatus>([
  "disponivel",
  "peso_finalizado",
  "fechado",
  "cancelado",
]);

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  try {
    const data = await getPesagemSaidaAnimaisById(parsedId);
    if (!data) {
      return NextResponse.json({ error: "Pesagem nao encontrada." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar pesagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

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

  try {
    const current = await getPesagemSaidaAnimaisById(parsedId);
    if (!current) {
      return NextResponse.json({ error: "Pesagem nao encontrada." }, { status: 404 });
    }

    const fluxo = resolveFluxoPesagem({
      status: status ?? current.status,
      pesoBruto: resolvePesoForFlow(pesoBruto, current.pesoBruto),
      pesoTara: resolvePesoForFlow(pesoTara, current.pesoTara),
      operacaoInformada: operacaoInformada ?? current.operacao,
    });
    const validationError = validatePesagemForm({
      pesoBruto: resolvePesoForFlow(pesoBruto, current.pesoBruto),
      pesoTara: resolvePesoForFlow(pesoTara, current.pesoTara),
      dataChegada: resolveOptionalString(dataChegada, current.dataChegada),
      horaChegada: resolveOptionalString(horaChegada, current.horaChegada),
      dataSaida: resolveOptionalString(dataSaida, current.dataSaida),
      horaSaida: resolveOptionalString(horaSaida, current.horaSaida),
      dataInicio: resolveOptionalString(dataInicio, current.dataInicio),
      dataFim: resolveOptionalString(dataFim, current.dataFim),
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const updated = await updatePesagemSaidaAnimais(parsedId, {
      status: fluxo.status,
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
      documentosFiscais: body.documentosFiscais !== undefined ? parseDocumentos(body.documentosFiscais) : undefined,
      motivosAtraso: body.motivosAtraso !== undefined ? parseMotivos(body.motivosAtraso) : undefined,
      motivosEspera: body.motivosEspera !== undefined ? parseMotivos(body.motivosEspera) : undefined,
      calendario: body.calendario !== undefined ? parseCalendario(body.calendario) : undefined,
      gtaRows: body.gtaRows !== undefined ? parseGtaRows(body.gtaRows) : undefined,
      fechamento: body.fechamento !== undefined ? parseFechamento(body.fechamento) : undefined,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar pesagem.";
    const normalized = message.toLowerCase();
    const code = normalized.includes("nao encontrada") ? 404 : normalized.includes("fluxo invalido") ? 400 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}

function parseOptionalNullableNonZeroInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return parsed;
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
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

function toOptionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
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
  if (value === null) return null;
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

function parseOptionalInteger(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function validatePesagemForm(args: {
  pesoBruto: number;
  pesoTara: number;
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

function resolveOptionalString(next: string | null | undefined, current: string | null): string | null {
  if (next === undefined) return current ?? null;
  return next;
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

function resolvePesoForFlow(next: number | null | undefined, current: number): number {
  if (next === undefined) return Math.max(0, Number(current ?? 0));
  if (next === null) return 0;
  return Math.max(0, Number(next));
}

function resolveFluxoPesagem(args: {
  status: PesagemStatus;
  pesoBruto: number;
  pesoTara: number;
  operacaoInformada: string | null | undefined;
}): { status: PesagemStatus; operacao: string } {
  const bruto = Math.max(0, Number(args.pesoBruto ?? 0));
  const tara = Math.max(0, Number(args.pesoTara ?? 0));
  const requestedStatus = args.status;
  const operacaoInformada = (args.operacaoInformada ?? "").trim();

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
      operacao: operacaoInformada || "CAMINHAO AGUARDANDO ENTRADA",
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



