"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import { preloadPnCatalog, queryPnCatalog } from "@/lib/pn-catalog-client";
import type { PesagemStatus } from "@/lib/types/pesagem";

type ContratoOption = { id: number; numero: string | null; descricao: string | null };
type ItemOption = { id: string; codigo: string | null; descricao: string };
type FazendaOption = { id: number; codigo: string | null; nome: string };
type ParceiroOption = { id: number; codigo: string | null; nome: string; documento: string | null };
type EquipamentoOption = { id: string; codigo: string | null; descricao: string };
type CatalogOption = { value: string; label: string };
type DocumentoFiscal = { documento: string };
type MotivoRow = { motivo: string; tempoMinutos: string };
type CalendarioRow = { data: string; dia: string; feriado: boolean; pago: boolean; valor: string };
type GtaRow = { gta: string; quantidadeMachos: string; quantidadeFemeas: string; quantidadeTotal: string };
type FechamentoState = {
  tabelaFrete: string;
  calculoFrete: string;
  unidadeMedidaFrete: string;
  valorUnitarioFrete: string;
  valorCombustivel: string;
  valorPedagio: string;
  outrasDespesas: string;
  litragem: string;
  valorCombLitro: string;
  valorDiaria: string;
  valorComissao: string;
  valorFrete: string;
  pesagemOrigem: string;
  dataVencimento: string;
  qtdAnimais: string;
  qtdAnimaisOrigem: string;
  mapaPesagem: string;
  cte: string;
  nfExterna: string;
};
type TabKey = "documento" | "atraso" | "espera" | "fechamento" | "calendario" | "gta";
type PnPickerTarget = "transportador" | "contratante" | "motorista";
type FluxoEtapa = "aguardando_entrada" | "aguardando_retorno" | "aguardando_finalizacao" | "peso_finalizado" | "fechado" | "cancelado" | "inconsistente";

type FormState = {
  status: PesagemStatus;
  contratoId: string;
  contratoReferencia: string;
  itemId: string;
  itemDescricao: string;
  fazendaId: string;
  fazendaNome: string;
  tipoFrete: string;
  responsavelFrete: string;
  transportadorId: string;
  transportadorNome: string;
  contratanteId: string;
  contratanteNome: string;
  motoristaId: string;
  motoristaNome: string;
  dataChegada: string;
  horaChegada: string;
  dataSaida: string;
  horaSaida: string;
  numeroTicket: string;
  placa: string;
  equipamentoId: string;
  equipamentoNome: string;
  viagem: string;
  dataInicio: string;
  dataFim: string;
  kmInicial: string;
  kmFinal: string;
  kmTotal: string;
  observacao: string;
  pesoBruto: string;
  pesoTara: string;
  pesoLiquido: string;
  operacao: string;
};

const EMPTY_FORM: FormState = {
  status: "disponivel",
  contratoId: "",
  contratoReferencia: "",
  itemId: "",
  itemDescricao: "",
  fazendaId: "",
  fazendaNome: "",
  tipoFrete: "interno",
  responsavelFrete: "empresa",
  transportadorId: "",
  transportadorNome: "",
  contratanteId: "",
  contratanteNome: "",
  motoristaId: "",
  motoristaNome: "",
  dataChegada: "",
  horaChegada: "",
  dataSaida: "",
  horaSaida: "",
  numeroTicket: "",
  placa: "",
  equipamentoId: "",
  equipamentoNome: "",
  viagem: "",
  dataInicio: "",
  dataFim: "",
  kmInicial: "0,00",
  kmFinal: "0,00",
  kmTotal: "0,00",
  observacao: "",
  pesoBruto: "0,00",
  pesoTara: "0,00",
  pesoLiquido: "0,00",
  operacao: "CAMINHAO AGUARDANDO ENTRADA",
};

const EMPTY_FECHAMENTO: FechamentoState = {
  tabelaFrete: "",
  calculoFrete: "",
  unidadeMedidaFrete: "",
  valorUnitarioFrete: "0,00",
  valorCombustivel: "0,00",
  valorPedagio: "0,00",
  outrasDespesas: "0,00",
  litragem: "0,00",
  valorCombLitro: "0,00",
  valorDiaria: "0,00",
  valorComissao: "0,00",
  valorFrete: "0,00",
  pesagemOrigem: "",
  dataVencimento: "",
  qtdAnimais: "0",
  qtdAnimaisOrigem: "0",
  mapaPesagem: "",
  cte: "",
  nfExterna: "",
};

const TABELA_FRETE_OPTIONS = ["Padrao", "Especial", "Safra"];
const CALCULO_FRETE_OPTIONS = ["Por Cabeca", "Por KM", "Por Viagem", "Fixo"];
const UNIDADE_MEDIDA_FRETE_OPTIONS = ["KG", "ARROBA", "TONELADA", "CAB", "VIAGEM"];
const PESAGEM_ORIGEM_OPTIONS = ["Nao", "Sim"];
const MAPA_PESAGEM_OPTIONS = ["Entrada de Animais", "Saida de Animais"];

export default function PesagemEntradaAnimaisFormPage() {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("documento");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [contratos, setContratos] = useState<ContratoOption[]>([]);
  const [itens, setItens] = useState<ItemOption[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [loadingItens, setLoadingItens] = useState(false);
  const [fazendas, setFazendas] = useState<FazendaOption[]>([]);
  const [parceiros, setParceiros] = useState<ParceiroOption[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [equipamentoSearch, setEquipamentoSearch] = useState("");
  const [loadingEquipamentos, setLoadingEquipamentos] = useState(false);
  const [loadingParceiros, setLoadingParceiros] = useState(false);
  const [parceiroSearch, setParceiroSearch] = useState("");
  const [pnPickerTarget, setPnPickerTarget] = useState<PnPickerTarget | null>(null);
  const [pesoManualLiberado, setPesoManualLiberado] = useState(false);
  const [documentosFiscais, setDocumentosFiscais] = useState<DocumentoFiscal[]>([]);
  const [motivosAtraso, setMotivosAtraso] = useState<MotivoRow[]>([]);
  const [motivosEspera, setMotivosEspera] = useState<MotivoRow[]>([]);
  const [calendario, setCalendario] = useState<CalendarioRow[]>([]);
  const [gtaRows, setGtaRows] = useState<GtaRow[]>([]);
  const [fechamento, setFechamento] = useState<FechamentoState>(EMPTY_FECHAMENTO);
  const itemCatalogOptions = useMemo(
    () =>
      itens.map((item) => ({
        value: item.id,
        label: `${item.codigo ? `${item.codigo} - ` : ""}${item.descricao}`,
      })),
    [itens],
  );
  const equipamentoCatalogOptions = useMemo(
    () =>
      equipamentos.map((item) => ({
        value: item.id,
        label: `${item.codigo ? `${item.codigo} - ` : ""}${item.descricao}`,
      })),
    [equipamentos],
  );
  const fluxoEtapa = useMemo(
    () => getFluxoEtapa(form.status, parseCurrency(form.pesoBruto), parseCurrency(form.pesoTara)),
    [form.status, form.pesoBruto, form.pesoTara],
  );
  const canCapturarBruto = fluxoEtapa === "aguardando_entrada";
  const canCapturarTara = fluxoEtapa === "aguardando_retorno";
  const canEditarStatusManual =
    fluxoEtapa === "aguardando_finalizacao" ||
    fluxoEtapa === "peso_finalizado" ||
    form.status === "fechado" ||
    form.status === "cancelado";
  const readOnlyPesoBruto = !pesoManualLiberado || fluxoEtapa !== "aguardando_entrada";
  const readOnlyPesoTara = !pesoManualLiberado || fluxoEtapa !== "aguardando_retorno";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number.parseInt(params.get("id") ?? "", 10);
    if (Number.isFinite(id) && id > 0) setEditingId(id);
  }, []);

  useEffect(() => {
    async function loadOpcoes() {
      try {
        const ts = Date.now();
        const [pesagemOpcoesRes, equipamentosRes, empresasRes] = await Promise.all([
          fetch(`/api/pesagens/entrada-animais/opcoes?_ts=${ts}`, { cache: "no-store" }),
          fetch(`/api/cadastros/contratos/item-opcoes?itemSearch=equip&limit=300&_ts=${ts}`, { cache: "no-store" }),
          fetch(`/api/cadastros/empresas?limit=3000&_ts=${ts}`, { cache: "no-store" }),
        ]);

        if (pesagemOpcoesRes.ok) {
          const pesagemOpcoes = (await pesagemOpcoesRes.json()) as { contratos?: ContratoOption[] };
          setContratos(Array.isArray(pesagemOpcoes.contratos) ? pesagemOpcoes.contratos : []);
        }

        if (equipamentosRes.ok) {
          const catalog = (await equipamentosRes.json()) as { itens?: CatalogOption[] };
          const mappedEquipamentos = mapCatalogOptions(catalog.itens ?? []);
          setEquipamentos(mappedEquipamentos);
        }

        if (empresasRes.ok) {
          const empresas = (await empresasRes.json()) as FazendaOption[];
          setFazendas(Array.isArray(empresas) ? empresas : []);
        }
      } catch {}
    }
    loadOpcoes().catch(() => undefined);
  }, []);

  useEffect(() => {
    const term = itemSearch.trim();
    if (term.length < 1) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoadingItens(true);
        const ts = Date.now();
        const response = await fetch(
          `/api/cadastros/contratos/item-opcoes?itemSearch=${encodeURIComponent(term)}&limit=3000&_ts=${ts}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { itens?: CatalogOption[] };
        const mapped = mapCatalogOptions(data.itens ?? []);
        const sapOnly = mapped.filter((item) => item.id.startsWith("sap:"));
        const loaded = sapOnly.length > 0 ? sapOnly : mapped;
        if (!active) return;
        setItens((prev) => {
          const selected = prev.find((item) => item.id === form.itemId);
          if (!selected) return loaded;
          const hasSelected = loaded.some((item) => item.id === selected.id);
          return hasSelected ? loaded : [selected, ...loaded];
        });
      } finally {
        if (active) setLoadingItens(false);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.itemId, itemSearch]);

  useEffect(() => {
    const term = equipamentoSearch.trim();
    if (term.length < 1) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoadingEquipamentos(true);
        const ts = Date.now();
        const response = await fetch(
          `/api/cadastros/contratos/item-opcoes?itemSearch=${encodeURIComponent(term)}&limit=1200&_ts=${ts}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { itens?: CatalogOption[] };
        const loaded = mapCatalogOptions(data.itens ?? []);
        if (!active) return;
        setEquipamentos((prev) => {
          const selected = prev.find((item) => item.id === form.equipamentoId);
          if (!selected) return loaded;
          const hasSelected = loaded.some((item) => item.id === selected.id);
          return hasSelected ? loaded : [selected, ...loaded];
        });
      } finally {
        if (active) setLoadingEquipamentos(false);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [equipamentoSearch, form.equipamentoId]);

  useEffect(() => {
    let active = true;
    async function preloadParceiros() {
      try {
        setLoadingParceiros(true);
        const data = (await preloadPnCatalog(false)).slice(0, 260) as ParceiroOption[];
        if (active) setParceiros(Array.isArray(data) ? data : []);
      } finally {
        if (active) setLoadingParceiros(false);
      }
    }

    preloadParceiros().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pnPickerTarget) return;
    const term = parceiroSearch.trim();
    if (term.length > 0 && term.length < 2) return;
    if (term.length === 0 && parceiros.length > 0) return;

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoadingParceiros(true);
        const data = (await queryPnCatalog(term, {
          emptyLimit: 180,
          searchLimit: 260,
        })) as ParceiroOption[];
        if (active) setParceiros(Array.isArray(data) ? data : []);
      } finally {
        if (active) setLoadingParceiros(false);
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pnPickerTarget, parceiroSearch, parceiros.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setPesoManualLiberado((prev) => !prev);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!editingId) return;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/pesagens/entrada-animais/${editingId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar pesagem.");
        const data = (await response.json()) as Record<string, unknown>;
        setForm((prev) => applyFluxoToForm({
          ...prev,
          status: normalizeStatus(String(data.status ?? "disponivel")),
          contratoId: toText(data.contratoId),
          contratoReferencia: toText(data.contratoReferencia),
          itemId: toText(data.itemId),
          itemDescricao: toText(data.itemDescricao),
          fazendaId: toText(data.fazendaId),
          fazendaNome: toText(data.fazendaNome),
          tipoFrete: toText(data.tipoFrete) || "interno",
          responsavelFrete: toText(data.responsavelFrete) || "empresa",
          transportadorId: toText(data.transportadorId),
          transportadorNome: toText(data.transportadorNome),
          contratanteId: toText(data.contratanteId),
          contratanteNome: toText(data.contratanteNome),
          motoristaId: toText(data.motoristaId),
          motoristaNome: toText(data.motoristaNome),
          dataChegada: toDateInput(data.dataChegada),
          horaChegada: toTimeInput(data.horaChegada),
          dataSaida: toDateInput(data.dataSaida),
          horaSaida: toTimeInput(data.horaSaida),
          numeroTicket: toText(data.numeroTicket),
          placa: toText(data.placa),
          equipamentoId: toText(data.equipamentoId),
          equipamentoNome: toText(data.equipamentoNome),
          viagem: toText(data.viagem),
          dataInicio: toDateInput(data.dataInicio),
          dataFim: toDateInput(data.dataFim),
          kmInicial: toCurrency(data.kmInicial),
          kmFinal: toCurrency(data.kmFinal),
          kmTotal: toCurrency(data.kmTotal),
          observacao: toText(data.observacao),
          pesoBruto: toCurrency(data.pesoBruto),
          pesoTara: toCurrency(data.pesoTara),
          pesoLiquido: toCurrency(data.pesoLiquido),
          operacao: toText(data.operacao),
        }));
        setDocumentosFiscais(parseDocumentosRows(data.documentosFiscais));
        setMotivosAtraso(parseMotivoRows(data.motivosAtraso));
        setMotivosEspera(parseMotivoRows(data.motivosEspera));
        setCalendario(parseCalendarioRows(data.calendario));
        setGtaRows(parseGtaRows(data.gtaRows));
        setFechamento(parseFechamentoState(data.fechamento));
        setParceiros((prev) => {
          let next = prev;
          next = upsertParceiroOption(next, {
            id: Number.parseInt(String(data.transportadorId ?? ""), 10),
            nome: toText(data.transportadorNome),
          });
          next = upsertParceiroOption(next, {
            id: Number.parseInt(String(data.contratanteId ?? ""), 10),
            nome: toText(data.contratanteNome),
          });
          next = upsertParceiroOption(next, {
            id: Number.parseInt(String(data.motoristaId ?? ""), 10),
            nome: toText(data.motoristaNome),
          });
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar pesagem.");
      } finally {
        setLoading(false);
      }
    }
    loadData().catch(() => undefined);
  }, [editingId]);

  useEffect(() => {
    if (editingId) return;
    if (form.numeroTicket) return;
    gerarNumeroTicket();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  useEffect(() => {
    const total = Math.max(parseCurrency(form.kmFinal) - parseCurrency(form.kmInicial), 0);
    const text = formatCurrency(total);
    if (text !== form.kmTotal) setForm((prev) => ({ ...prev, kmTotal: text }));
  }, [form.kmInicial, form.kmFinal, form.kmTotal]);

  useEffect(() => {
    const liquido = Math.max(parseCurrency(form.pesoBruto) - parseCurrency(form.pesoTara), 0);
    const text = formatCurrency(liquido);
    if (text !== form.pesoLiquido) setForm((prev) => ({ ...prev, pesoLiquido: text }));
  }, [form.pesoBruto, form.pesoTara, form.pesoLiquido]);

  async function capturarPeso(target: "pesoBruto" | "pesoTara") {
    setError("");
    if (target === "pesoBruto" && !canCapturarBruto) {
      setError("Fluxo invalido: o peso bruto so pode ser capturado quando o caminhao esta em chegada.");
      return;
    }
    if (target === "pesoTara" && !canCapturarTara) {
      setError("Fluxo invalido: capture o peso bruto na chegada antes de capturar a tara no retorno.");
      return;
    }
    try {
      const response = await fetch("/api/pesagens/entrada-animais/capturar-peso", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao capturar peso.");
      }
      const data = (await response.json()) as { peso?: number };
      setForm((prev) => applyFluxoToForm({ ...prev, [target]: formatCurrency(Number(data.peso ?? 0)) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao capturar peso.");
    }
  }

  function gerarNumeroTicket() {
    const now = new Date();
    const dateCode = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const timeCode = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const randomCode = String(Math.floor(Math.random() * 900) + 100);
    const ticket = `TK-${dateCode}-${timeCode}-${randomCode}`;
    setForm((prev) => ({ ...prev, numeroTicket: ticket }));
  }

  function openPnPicker(target: PnPickerTarget) {
    setPnPickerTarget(target);
    setParceiroSearch("");
  }

  function closePnPicker() {
    setPnPickerTarget(null);
    setParceiroSearch("");
  }

  function handleSelectPn(option: ParceiroOption) {
    const id = String(option.id);
    if (pnPickerTarget === "transportador") {
      setForm((prev) => ({ ...prev, transportadorId: id, transportadorNome: option.nome }));
    } else if (pnPickerTarget === "contratante") {
      setForm((prev) => ({ ...prev, contratanteId: id, contratanteNome: option.nome }));
    } else if (pnPickerTarget === "motorista") {
      setForm((prev) => ({ ...prev, motoristaId: id, motoristaNome: option.nome }));
    }
    closePnPicker();
  }

  async function salvar() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const fluxo = getFluxoEtapa(form.status, parseCurrency(form.pesoBruto), parseCurrency(form.pesoTara));
      if (fluxo === "inconsistente") {
        throw new Error("Fluxo invalido: a tara nao pode ser informada sem o peso bruto de chegada.");
      }
      const syncedForm = applyFluxoToForm(form);
      if (syncedForm !== form) setForm(syncedForm);

      const payload = {
        ...syncedForm,
        tipo: "entrada_animais",
        contratoId: toNullableInt(syncedForm.contratoId),
        itemId: toNullableInt(syncedForm.itemId),
        fazendaId: toNullableInt(syncedForm.fazendaId),
        transportadorId: toNullableInt(syncedForm.transportadorId),
        contratanteId: toNullableInt(syncedForm.contratanteId),
        motoristaId: toNullableInt(syncedForm.motoristaId),
        equipamentoId: toNullableInt(syncedForm.equipamentoId),
        kmInicial: parseCurrency(syncedForm.kmInicial),
        kmFinal: parseCurrency(syncedForm.kmFinal),
        kmTotal: parseCurrency(syncedForm.kmTotal),
        pesoBruto: parseCurrency(syncedForm.pesoBruto),
        pesoTara: parseCurrency(syncedForm.pesoTara),
        pesoLiquido: parseCurrency(syncedForm.pesoLiquido),
        documentosFiscais,
        motivosAtraso: motivosAtraso.map((item) => ({ motivo: item.motivo, tempoMinutos: Number(item.tempoMinutos || 0) })),
        motivosEspera: motivosEspera.map((item) => ({ motivo: item.motivo, tempoMinutos: Number(item.tempoMinutos || 0) })),
        calendario: calendario.map((item) => ({ ...item, valor: parseCurrency(item.valor) })),
        gtaRows: gtaRows
          .map((item) => ({
            gta: item.gta.trim(),
            quantidadeMachos: parseInteger(item.quantidadeMachos),
            quantidadeFemeas: parseInteger(item.quantidadeFemeas),
            quantidadeTotal: parseInteger(item.quantidadeTotal),
          }))
          .filter((item) => item.gta.length > 0 || item.quantidadeMachos > 0 || item.quantidadeFemeas > 0 || item.quantidadeTotal > 0),
        fechamento: {
          tabelaFrete: fechamento.tabelaFrete || null,
          calculoFrete: fechamento.calculoFrete || null,
          unidadeMedidaFrete: fechamento.unidadeMedidaFrete || null,
          valorUnitarioFrete: parseCurrency(fechamento.valorUnitarioFrete),
          valorCombustivel: parseCurrency(fechamento.valorCombustivel),
          valorPedagio: parseCurrency(fechamento.valorPedagio),
          outrasDespesas: parseCurrency(fechamento.outrasDespesas),
          litragem: parseCurrency(fechamento.litragem),
          valorCombLitro: parseCurrency(fechamento.valorCombLitro),
          valorDiaria: parseCurrency(fechamento.valorDiaria),
          valorComissao: parseCurrency(fechamento.valorComissao),
          valorFrete: parseCurrency(fechamento.valorFrete),
          pesagemOrigem: fechamento.pesagemOrigem || null,
          dataVencimento: fechamento.dataVencimento || null,
          qtdAnimais: parseInteger(fechamento.qtdAnimais),
          qtdAnimaisOrigem: parseInteger(fechamento.qtdAnimaisOrigem),
          mapaPesagem: fechamento.mapaPesagem || null,
          cte: fechamento.cte || null,
          nfExterna: fechamento.nfExterna || null,
        },
      };
      const response = await fetch(editingId ? `/api/pesagens/entrada-animais/${editingId}` : "/api/pesagens/entrada-animais", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Falha ao salvar pesagem.");
      const data = (await response.json()) as { id?: number };
      setSuccess("Pesagem salva com sucesso.");
      setTimeout(() => router.push(`/pesagens/entrada-animais?${editingId ? "updated" : "created"}=${data.id ?? editingId ?? ""}`), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar pesagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <FormPageHeader title={editingId ? `Pesagem #${editingId}` : "Pesagem de Caminhao de Entrada de Animal"} subtitle="Cadastro de entrada de animais com pesos e eventos." backHref="/pesagens/entrada-animais" backLabel="Pesagens" />
        <ModuleHeader />
        <section className="card p-3">
          <div className="legacy-actions"><button type="button" className="legacy-btn primary" onClick={salvar} disabled={saving || loading}>{saving ? "Salvando..." : "Salvar"}</button><button type="button" className="legacy-btn" onClick={() => router.push("/pesagens/entrada-animais")}>Cancelar</button></div>
          {error && <p className="legacy-message error">{error}</p>}
          {success && <p className="legacy-message success">{success}</p>}

          <div className="legacy-form mt-2">
            <div className="legacy-grid cols-4">
              <label className="legacy-field"><span>Contrato</span><select className="legacy-select" value={form.contratoId} onChange={(e) => { const v = e.target.value; const c = contratos.find((x) => String(x.id) === v); setForm((p) => ({ ...p, contratoId: v, contratoReferencia: c?.descricao ?? p.contratoReferencia })); }}><option value="">Selecione...</option>{contratos.map((c) => <option key={c.id} value={c.id}>#{c.id} | {c.numero || "S/N"} | {c.descricao || "-"}</option>)}</select></label>
              <CatalogAutocompleteField
                label="Item (SAP)"
                className="legacy-field"
                options={itemCatalogOptions}
                value={form.itemId}
                listId="pesagem-item"
                loading={loadingItens}
                fallbackLabel={form.itemDescricao}
                onSearchTextChange={setItemSearch}
                onValueChange={(value) => {
                  const selected = itens.find((item) => item.id === value);
                  setForm((prev) => ({
                    ...prev,
                    itemId: value,
                    itemDescricao: selected?.descricao ?? prev.itemDescricao,
                  }));
                }}
              />
              <label className="legacy-field"><span>Fazenda (Empresa)</span><select className="legacy-select" value={form.fazendaId} onChange={(e) => { const v = e.target.value; const empresa = fazendas.find((x) => String(x.id) === v); setForm((p) => ({ ...p, fazendaId: v, fazendaNome: empresa?.nome ?? p.fazendaNome })); }}><option value="">Selecione...</option>{fazendas.map((fazenda) => <option key={fazenda.id} value={fazenda.id}>{fazenda.codigo ? `${fazenda.codigo} - ` : ""}{fazenda.nome}</option>)}</select></label>
              <label className="legacy-field"><span>Tipo de Frente</span><select className="legacy-select" value={form.tipoFrete} onChange={(e) => setForm((p) => ({ ...p, tipoFrete: e.target.value }))}><option value="interno">Interno</option><option value="externo">Externo</option></select></label>
              <label className="legacy-field"><span>Responsavel Frete</span><select className="legacy-select" value={form.responsavelFrete} onChange={(e) => setForm((p) => ({ ...p, responsavelFrete: e.target.value }))}><option value="empresa">Empresa</option><option value="parceiro">Parceiro</option><option value="terceiro">Terceiro</option></select></label>
              <PickerTriggerField label="Transportador (PN)" valueLabel={optionLabel(parceiros, form.transportadorId)} onOpen={() => openPnPicker("transportador")} loading={loadingParceiros} />
              <PickerTriggerField label="Contratante (PN)" valueLabel={optionLabel(parceiros, form.contratanteId)} onOpen={() => openPnPicker("contratante")} loading={loadingParceiros} />
              <PickerTriggerField label="Motorista (PN)" valueLabel={optionLabel(parceiros, form.motoristaId)} onOpen={() => openPnPicker("motorista")} loading={loadingParceiros} />
              <label className="legacy-field"><span>Data Chegada</span><input type="date" className="legacy-input" value={form.dataChegada} onChange={(e) => setForm((p) => ({ ...p, dataChegada: e.target.value }))} /></label>
              <label className="legacy-field"><span>Hora Chegada</span><input type="time" className="legacy-input" value={form.horaChegada} onChange={(e) => setForm((p) => ({ ...p, horaChegada: e.target.value }))} /></label>
              <label className="legacy-field"><span>Data Saida</span><input type="date" className="legacy-input" value={form.dataSaida} onChange={(e) => setForm((p) => ({ ...p, dataSaida: e.target.value }))} /></label>
              <label className="legacy-field"><span>Hora Saida</span><input type="time" className="legacy-input" value={form.horaSaida} onChange={(e) => setForm((p) => ({ ...p, horaSaida: e.target.value }))} /></label>
              <div className="legacy-field"><span>N Ticket</span><div className="legacy-inline"><input className="legacy-input" value={form.numeroTicket} onChange={(e) => setForm((p) => ({ ...p, numeroTicket: e.target.value }))} /><button type="button" className="legacy-btn" onClick={gerarNumeroTicket}>Gerar</button></div></div>
              <label className="legacy-field"><span>Placa</span><input className="legacy-input" value={form.placa} onChange={(e) => setForm((p) => ({ ...p, placa: e.target.value.toUpperCase() }))} /></label>
              <CatalogAutocompleteField
                label="Equipamento (SAP)"
                className="legacy-field"
                options={equipamentoCatalogOptions}
                value={form.equipamentoId}
                listId="pesagem-equipamento"
                loading={loadingEquipamentos}
                fallbackLabel={form.equipamentoNome}
                onSearchTextChange={setEquipamentoSearch}
                onValueChange={(value) => {
                  const selected = equipamentos.find((item) => item.id === value);
                  setForm((prev) => ({
                    ...prev,
                    equipamentoId: value,
                    equipamentoNome: selected?.descricao ?? prev.equipamentoNome,
                  }));
                }}
              />
              <label className="legacy-field"><span>Viagem</span><input className="legacy-input" value={form.viagem} onChange={(e) => setForm((p) => ({ ...p, viagem: e.target.value }))} /></label>
              <label className="legacy-field"><span>Data Inicio</span><input type="date" className="legacy-input" value={form.dataInicio} onChange={(e) => setForm((p) => ({ ...p, dataInicio: e.target.value }))} /></label>
              <label className="legacy-field"><span>Data Fim</span><input type="date" className="legacy-input" value={form.dataFim} onChange={(e) => setForm((p) => ({ ...p, dataFim: e.target.value }))} /></label>
              <label className="legacy-field"><span>Fluxo Caminhao</span><input className="legacy-input" value={form.operacao} readOnly /></label>
              <label className="legacy-field"><span>KM Inicial</span><input className="legacy-input" value={form.kmInicial} onChange={(e) => setForm((p) => ({ ...p, kmInicial: sanitizeDecimal(e.target.value) }))} /></label>
              <label className="legacy-field"><span>KM Final</span><input className="legacy-input" value={form.kmFinal} onChange={(e) => setForm((p) => ({ ...p, kmFinal: sanitizeDecimal(e.target.value) }))} /></label>
              <label className="legacy-field"><span>KM Total</span><input className="legacy-input" value={form.kmTotal} readOnly /></label>
              <label className="legacy-field col-span-2"><span>Observacao</span><textarea className="legacy-textarea" value={form.observacao} onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} /></label>
              <label className="legacy-field"><span>Peso Bruto</span><input className="legacy-input" value={form.pesoBruto} readOnly={readOnlyPesoBruto} onChange={(e) => setForm((p) => applyFluxoToForm({ ...p, pesoBruto: sanitizeDecimal(e.target.value) }))} /></label>
              <div className="legacy-field"><span>&nbsp;</span><button type="button" className="legacy-btn capture-btn capture-btn-bruto" onClick={() => capturarPeso("pesoBruto")} disabled={!canCapturarBruto || saving || loading}>Capturar Bruto</button></div>
              <label className="legacy-field"><span>Peso Tara</span><input className="legacy-input" value={form.pesoTara} readOnly={readOnlyPesoTara} onChange={(e) => setForm((p) => applyFluxoToForm({ ...p, pesoTara: sanitizeDecimal(e.target.value) }))} /></label>
              <div className="legacy-field"><span>&nbsp;</span><button type="button" className="legacy-btn capture-btn capture-btn-tara" onClick={() => capturarPeso("pesoTara")} disabled={!canCapturarTara || saving || loading}>Capturar Tara</button></div>
              <label className="legacy-field"><span>Peso Liquido</span><input className="legacy-input" value={form.pesoLiquido} readOnly /></label>
              <label className="legacy-field"><span>Status</span><select className="legacy-select" value={form.status} disabled={!canEditarStatusManual} onChange={(e) => setForm((p) => applyFluxoToForm({ ...p, status: normalizeStatus(e.target.value) }))}><option value="disponivel">Disponivel</option>{(fluxoEtapa === "aguardando_finalizacao" || fluxoEtapa === "peso_finalizado" || form.status === "peso_finalizado") && <option value="peso_finalizado">Peso Finalizado</option>}<option value="fechado">Fechado</option><option value="cancelado">Cancelado</option></select></label>
              <label className="legacy-field col-span-2"><span>Etapa Atual</span><input className="legacy-input" value={getFluxoLabel(fluxoEtapa)} readOnly /></label>
            </div>
            {fluxoEtapa === "inconsistente" && <p className="legacy-message error mt-2">Fluxo invalido: a tara foi informada sem peso bruto de chegada.</p>}
            {fluxoEtapa === "aguardando_finalizacao" && <p className="legacy-message mt-2">Tara capturada. Clique em salvar para finalizar a pesagem.</p>}
            <div className="legacy-tabs mt-3">
              <button type="button" className={`legacy-tab ${activeTab === "documento" ? "active" : ""}`} onClick={() => setActiveTab("documento")}>Documento Fiscal</button>
              <button type="button" className={`legacy-tab ${activeTab === "atraso" ? "active" : ""}`} onClick={() => setActiveTab("atraso")}>Motivo Atraso</button>
              <button type="button" className={`legacy-tab ${activeTab === "espera" ? "active" : ""}`} onClick={() => setActiveTab("espera")}>Motivo Espera</button>
              <button type="button" className={`legacy-tab ${activeTab === "fechamento" ? "active" : ""}`} onClick={() => setActiveTab("fechamento")}>Fechamento</button>
              <button type="button" className={`legacy-tab ${activeTab === "calendario" ? "active" : ""}`} onClick={() => setActiveTab("calendario")}>Calendario</button>
              <button type="button" className={`legacy-tab ${activeTab === "gta" ? "active" : ""}`} onClick={() => setActiveTab("gta")}>GTA</button>
            </div>

            {activeTab === "documento" && <SimpleListEditor rows={documentosFiscais} setRows={setDocumentosFiscais} keyName="documento" label="Documento" />}
            {activeTab === "atraso" && <MotivoListEditor rows={motivosAtraso} setRows={setMotivosAtraso} />}
            {activeTab === "espera" && <MotivoListEditor rows={motivosEspera} setRows={setMotivosEspera} />}
            {activeTab === "fechamento" && <FechamentoEditor state={fechamento} onChange={setFechamento} />}
            {activeTab === "calendario" && <CalendarioEditor rows={calendario} setRows={setCalendario} />}
            {activeTab === "gta" && <GtaListEditor rows={gtaRows} setRows={setGtaRows} />}
          </div>
        </section>

        {pnPickerTarget && (
          <LegacyModal title="Pesquisar Parceiro (PN)" onClose={closePnPicker} zIndex={220}>
            <label className="legacy-field">
              <span>Pesquisar por nome, codigo ou documento</span>
              <input
                className="legacy-input"
                placeholder="Digite para buscar..."
                value={parceiroSearch}
                onChange={(event) => setParceiroSearch(event.target.value)}
                autoFocus
              />
            </label>
            {loadingParceiros && <p className="legacy-message">Carregando opcoes...</p>}
            {!loadingParceiros && (
              <div className="legacy-table-wrap mt-2">
                <table className="legacy-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nome</th>
                      <th>Documento</th>
                      <th>Acao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parceiros.length === 0 && (
                      <tr>
                        <td colSpan={4} className="legacy-empty">Nenhum parceiro encontrado.</td>
                      </tr>
                    )}
                    {parceiros.slice(0, 200).map((item) => (
                      <tr key={`${item.id}-${item.nome}`}>
                        <td>{item.codigo ?? "-"}</td>
                        <td className="left">{item.nome}</td>
                        <td>{item.documento ? formatCpfCnpj(item.documento) : "-"}</td>
                        <td>
                          <button type="button" className="legacy-btn" onClick={() => handleSelectPn(item)}>
                            Selecionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LegacyModal>
        )}
      </main>
    </div>
  );
}

function FechamentoEditor({
  state,
  onChange,
}: {
  state: FechamentoState;
  onChange: (next: FechamentoState) => void;
}) {
  return (
    <div className="mt-2">
      <div className="legacy-grid cols-6">
        <label className="legacy-field">
          <span>Tabela de Frete</span>
          <select className="legacy-select" value={state.tabelaFrete} onChange={(event) => onChange({ ...state, tabelaFrete: event.target.value })}>
            <option value="">Selecione...</option>
            {TABELA_FRETE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            {state.tabelaFrete && !TABELA_FRETE_OPTIONS.includes(state.tabelaFrete) && <option value={state.tabelaFrete}>{state.tabelaFrete}</option>}
          </select>
        </label>
        <label className="legacy-field">
          <span>Calculo Frete</span>
          <select className="legacy-select" value={state.calculoFrete} onChange={(event) => onChange({ ...state, calculoFrete: event.target.value })}>
            <option value="">Selecione...</option>
            {CALCULO_FRETE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            {state.calculoFrete && !CALCULO_FRETE_OPTIONS.includes(state.calculoFrete) && <option value={state.calculoFrete}>{state.calculoFrete}</option>}
          </select>
        </label>
        <label className="legacy-field">
          <span>Unidade Medida Frete</span>
          <select className="legacy-select" value={state.unidadeMedidaFrete} onChange={(event) => onChange({ ...state, unidadeMedidaFrete: event.target.value })}>
            <option value="">Selecione...</option>
            {UNIDADE_MEDIDA_FRETE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            {state.unidadeMedidaFrete && !UNIDADE_MEDIDA_FRETE_OPTIONS.includes(state.unidadeMedidaFrete) && <option value={state.unidadeMedidaFrete}>{state.unidadeMedidaFrete}</option>}
          </select>
        </label>
        <label className="legacy-field"><span>Valor Unitario Frete</span><input className="legacy-input" value={state.valorUnitarioFrete} onChange={(event) => onChange({ ...state, valorUnitarioFrete: sanitizeDecimal(event.target.value) })} /></label>
        <label className="legacy-field"><span>Valor de Combustivel</span><input className="legacy-input" value={state.valorCombustivel} onChange={(event) => onChange({ ...state, valorCombustivel: sanitizeDecimal(event.target.value) })} /></label>
        <label className="legacy-field"><span>Valor Pedagio</span><input className="legacy-input" value={state.valorPedagio} onChange={(event) => onChange({ ...state, valorPedagio: sanitizeDecimal(event.target.value) })} /></label>

        <label className="legacy-field"><span>Outras Despesas</span><input className="legacy-input" value={state.outrasDespesas} onChange={(event) => onChange({ ...state, outrasDespesas: sanitizeDecimal(event.target.value) })} /></label>
        <label className="legacy-field"><span>Litragem</span><input className="legacy-input" value={state.litragem} onChange={(event) => onChange({ ...state, litragem: sanitizeDecimal(event.target.value) })} /></label>
        <label className="legacy-field"><span>Valor Comb(L)</span><input className="legacy-input" value={state.valorCombLitro} onChange={(event) => onChange({ ...state, valorCombLitro: sanitizeDecimal(event.target.value) })} /></label>
        <label className="legacy-field"><span>Valor Diaria</span><input className="legacy-input" value={state.valorDiaria} onChange={(event) => onChange({ ...state, valorDiaria: sanitizeDecimal(event.target.value) })} /></label>
        <label className="legacy-field"><span>Valor Comissao</span><input className="legacy-input" value={state.valorComissao} onChange={(event) => onChange({ ...state, valorComissao: sanitizeDecimal(event.target.value) })} /></label>
        <label className="legacy-field"><span>Valor Frete</span><input className="legacy-input" value={state.valorFrete} onChange={(event) => onChange({ ...state, valorFrete: sanitizeDecimal(event.target.value) })} /></label>

        <label className="legacy-field">
          <span>Pesagem Origem</span>
          <select className="legacy-select" value={state.pesagemOrigem} onChange={(event) => onChange({ ...state, pesagemOrigem: event.target.value })}>
            <option value="">Selecione...</option>
            {PESAGEM_ORIGEM_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            {state.pesagemOrigem && !PESAGEM_ORIGEM_OPTIONS.includes(state.pesagemOrigem) && <option value={state.pesagemOrigem}>{state.pesagemOrigem}</option>}
          </select>
        </label>
        <label className="legacy-field"><span>Data Vencimento</span><input type="date" className="legacy-input" value={state.dataVencimento} onChange={(event) => onChange({ ...state, dataVencimento: event.target.value })} /></label>
        <label className="legacy-field"><span>Qtd Animais</span><input className="legacy-input" value={state.qtdAnimais} onChange={(event) => onChange({ ...state, qtdAnimais: sanitizeInteger(event.target.value) })} /></label>
        <label className="legacy-field"><span>Qtd Animais Origem</span><input className="legacy-input" value={state.qtdAnimaisOrigem} onChange={(event) => onChange({ ...state, qtdAnimaisOrigem: sanitizeInteger(event.target.value) })} /></label>
        <label className="legacy-field col-span-2">
          <span>Mapa Pesagem</span>
          <select className="legacy-select" value={state.mapaPesagem} onChange={(event) => onChange({ ...state, mapaPesagem: event.target.value })}>
            <option value="">Selecione...</option>
            {MAPA_PESAGEM_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            {state.mapaPesagem && !MAPA_PESAGEM_OPTIONS.includes(state.mapaPesagem) && <option value={state.mapaPesagem}>{state.mapaPesagem}</option>}
          </select>
        </label>

        <label className="legacy-field"><span>CTE</span><input className="legacy-input" value={state.cte} onChange={(event) => onChange({ ...state, cte: event.target.value.toUpperCase() })} /></label>
        <label className="legacy-field"><span>NF Externa</span><input className="legacy-input" value={state.nfExterna} onChange={(event) => onChange({ ...state, nfExterna: event.target.value.toUpperCase() })} /></label>
      </div>
    </div>
  );
}

function SimpleListEditor({ rows, setRows, keyName, label }: { rows: DocumentoFiscal[]; setRows: (rows: DocumentoFiscal[]) => void; keyName: "documento"; label: string }) {
  return <div className="mt-2 space-y-2"><button type="button" className="legacy-btn" onClick={() => setRows([...rows, { documento: "" }])}>Adicionar</button>{rows.map((row, i) => <div key={i} className="legacy-inline"><input className="legacy-input" placeholder={label} value={row[keyName]} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, [keyName]: e.target.value } : x))} /><button type="button" className="legacy-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remover</button></div>)}</div>;
}

function MotivoListEditor({ rows, setRows }: { rows: MotivoRow[]; setRows: (rows: MotivoRow[]) => void }) {
  return <div className="mt-2 space-y-2"><button type="button" className="legacy-btn" onClick={() => setRows([...rows, { motivo: "", tempoMinutos: "0" }])}>Adicionar</button>{rows.map((row, i) => <div key={i} className="legacy-inline"><input className="legacy-input" placeholder="Motivo" value={row.motivo} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, motivo: e.target.value } : x))} /><input className="legacy-input short" placeholder="Min" value={row.tempoMinutos} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, tempoMinutos: e.target.value.replace(/[^0-9]/g, "") } : x))} /><button type="button" className="legacy-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remover</button></div>)}</div>;
}

function CalendarioEditor({ rows, setRows }: { rows: CalendarioRow[]; setRows: (rows: CalendarioRow[]) => void }) {
  return <div className="mt-2 space-y-2"><button type="button" className="legacy-btn" onClick={() => setRows([...rows, { data: "", dia: "", feriado: false, pago: false, valor: "0,00" }])}>Adicionar Dia</button>{rows.map((row, i) => <div key={i} className="card p-2"><div className="legacy-grid cols-4"><label className="legacy-field"><span>Data</span><input type="date" className="legacy-input" value={row.data} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, data: e.target.value } : x))} /></label><label className="legacy-field"><span>Dia</span><input className="legacy-input" value={row.dia} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, dia: e.target.value } : x))} /></label><label className="legacy-field"><span>Valor</span><input className="legacy-input" value={row.valor} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, valor: sanitizeDecimal(e.target.value) } : x))} /></label><div className="legacy-field"><span>&nbsp;</span><button type="button" className="legacy-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remover</button></div><label className="legacy-check"><input type="checkbox" checked={row.feriado} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, feriado: e.target.checked } : x))} />Feriado</label><label className="legacy-check"><input type="checkbox" checked={row.pago} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, pago: e.target.checked } : x))} />Pago</label></div></div>)}</div>;
}

function GtaListEditor({ rows, setRows }: { rows: GtaRow[]; setRows: (rows: GtaRow[]) => void }) {
  function addRow() {
    setRows([
      ...rows,
      {
        gta: "",
        quantidadeMachos: "0",
        quantidadeFemeas: "0",
        quantidadeTotal: "0",
      },
    ]);
  }

  function updateQuantidade(index: number, field: "quantidadeMachos" | "quantidadeFemeas", rawValue: string) {
    setRows(
      rows.map((row, i) => {
        if (i !== index) return row;
        const next = {
          ...row,
          [field]: sanitizeInteger(rawValue),
        };
        const total = parseInteger(next.quantidadeMachos) + parseInteger(next.quantidadeFemeas);
        return {
          ...next,
          quantidadeTotal: String(total),
        };
      }),
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="itens-title">GTA</p>
      <button type="button" className="legacy-btn" onClick={addRow}>Adicionar</button>
      <div className="legacy-table-wrap">
        <table className="legacy-table">
          <thead>
            <tr>
              <th>GTA</th>
              <th>Quantidade Machos</th>
              <th>Quantidade Femeas</th>
              <th>Quantidade Total</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="legacy-empty">Nenhum registro adicionado.</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={`${row.gta || "gta"}-${index}`}>
                <td className="left">
                  <input
                    className="legacy-input"
                    value={row.gta}
                    placeholder="GTA"
                    onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, gta: event.target.value } : item)))}
                  />
                </td>
                <td>
                  <input
                    className="legacy-input"
                    value={row.quantidadeMachos}
                    onChange={(event) => updateQuantidade(index, "quantidadeMachos", event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="legacy-input"
                    value={row.quantidadeFemeas}
                    onChange={(event) => updateQuantidade(index, "quantidadeFemeas", event.target.value)}
                  />
                </td>
                <td>{row.quantidadeTotal || "0"}</td>
                <td>
                  <button
                    type="button"
                    className="legacy-btn"
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LegacyModal({
  title,
  onClose,
  children,
  zIndex,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
}) {
  return (
    <div className="legacy-modal-backdrop" role="dialog" aria-modal="true" style={zIndex ? { zIndex } : undefined}>
      <div className="legacy-modal">
        <div className="legacy-modal-header"><h3>{title}</h3><button type="button" className="legacy-btn" onClick={onClose}>X</button></div>
        <div className="legacy-modal-body">{children}</div>
      </div>
    </div>
  );
}

function PickerTriggerField({
  label,
  valueLabel,
  onOpen,
  loading,
}: {
  label: string;
  valueLabel: string;
  onOpen: () => void;
  loading?: boolean;
}) {
  return (
    <label className="legacy-field">
      <span>{label}</span>
      <div className="legacy-inline">
        <input className="legacy-input" value={valueLabel || ""} placeholder="Nenhum selecionado" readOnly />
        <button type="button" className="legacy-btn" onClick={onOpen}>Pesquisar</button>
      </div>
      {loading && <small className="mt-1 block text-xs text-[#6b7394]">Carregando opcoes...</small>}
    </label>
  );
}

function CatalogAutocompleteField({
  label,
  options,
  value,
  onValueChange,
  onSearchTextChange,
  listId,
  className,
  loading,
  fallbackLabel,
}: {
  label: string;
  options: CatalogOption[];
  value: string;
  onValueChange: (value: string) => void;
  onSearchTextChange?: (value: string) => void;
  listId: string;
  className?: string;
  loading?: boolean;
  fallbackLabel?: string;
}) {
  const selectedOption = findCatalogOptionByValue(options, value);
  const selectedLabel = selectedOption?.label ?? (fallbackLabel?.trim() || "");
  const [text, setText] = useState(selectedLabel);
  const [isFocused, setIsFocused] = useState(false);
  const stableSelectedLabel = selectedLabel || normalizeItemDisplayLabel(value) || text;
  const inputValue = isFocused ? text : value ? stableSelectedLabel : text;
  const filteredOptions = filterCatalogOptions(options, inputValue, value);

  function handleChange(nextText: string) {
    setText(nextText);
    onSearchTextChange?.(nextText);

    const term = normalizeSearchTerm(nextText);
    if (!term) {
      onValueChange("");
      return;
    }

    const exact = options.find((option) => {
      const labelTerm = normalizeSearchTerm(option.label);
      const valueTerm = normalizeSearchTerm(stripSapPrefix(option.value));
      return labelTerm === term || valueTerm === term;
    });

    if (exact) {
      onValueChange(exact.value);
      return;
    }

    onValueChange("");
  }

  return (
    <label className={className ?? "legacy-field"}>
      <span>{label}</span>
      <input
        className="legacy-input"
        list={`catalog-${listId}`}
        placeholder="Digite para pesquisar..."
        value={inputValue}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => {
          setIsFocused(true);
          const startText = value && selectedLabel ? selectedLabel : text;
          setText(startText);
          onSearchTextChange?.(startText);
        }}
        onBlur={() => {
          setIsFocused(false);
          if (value) setText(stableSelectedLabel);
        }}
      />
      <datalist id={`catalog-${listId}`}>
        {filteredOptions.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.label} />
        ))}
      </datalist>
      {isFocused && loading && <small className="mt-1 block text-xs text-[#6b7394]">Carregando opcoes...</small>}
    </label>
  );
}

function mapCatalogOptions(options: CatalogOption[]): ItemOption[] {
  return options.map((option, index) => {
    const rawLabel = String(option.label ?? "").trim();
    const [maybeCode, ...rest] = rawLabel.split(" - ");
    const hasCode = rest.length > 0;
    return {
      id: String(option.value ?? `catalog-${index}`),
      codigo: hasCode ? maybeCode.trim() : null,
      descricao: hasCode ? rest.join(" - ").trim() : rawLabel,
    };
  });
}

function optionLabel(options: ParceiroOption[], value: string): string {
  if (!value) return "";
  const option = options.find((item) => String(item.id) === String(value));
  if (!option) return "";
  const documento = option.documento ? ` - ${formatCpfCnpj(option.documento)}` : "";
  return `${option.codigo ?? "SEM-COD"} - ${option.nome}${documento}`;
}

function upsertParceiroOption(current: ParceiroOption[], patch: { id: number; nome: string }): ParceiroOption[] {
  if (!Number.isFinite(patch.id) || patch.id <= 0 || !patch.nome.trim()) return current;
  const exists = current.some((item) => item.id === patch.id);
  if (exists) return current;
  return [
    ...current,
    {
      id: patch.id,
      codigo: null,
      nome: patch.nome.trim(),
      documento: null,
    },
  ];
}

function formatCpfCnpj(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return digits || value;
}

function findCatalogOptionByValue(options: CatalogOption[], value: string): CatalogOption | undefined {
  if (!value) return undefined;
  return options.find((option) => option.value === value);
}

function filterCatalogOptions(options: CatalogOption[], search: string, selectedValue?: string): CatalogOption[] {
  const term = normalizeSearchTerm(search);
  if (!term) {
    if (!selectedValue) return options.slice(0, 240);
    const selected = options.find((option) => option.value === selectedValue);
    if (!selected) return options.slice(0, 240);
    return [selected, ...options.filter((option) => option.value !== selectedValue).slice(0, 239)];
  }

  const filtered = options.filter((option) => {
    const label = normalizeSearchTerm(option.label);
    const value = normalizeSearchTerm(stripSapPrefix(option.value));
    return label.includes(term) || value.includes(term);
  });

  if (!selectedValue) return filtered.slice(0, 240);
  const selected = options.find((option) => option.value === selectedValue);
  if (!selected || filtered.some((option) => option.value === selectedValue)) return filtered.slice(0, 240);
  return [selected, ...filtered].slice(0, 240);
}

function normalizeSearchTerm(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function stripSapPrefix(value: string): string {
  const text = String(value ?? "").trim();
  const match = text.match(/^sap:[^:]+:(.+)$/i);
  return match ? match[1] : text;
}

function normalizeItemDisplayLabel(value: string): string {
  const text = stripSapPrefix(value);
  if (!text) return "";
  return text.replace(/_/g, " ").trim();
}

function getFluxoEtapa(status: PesagemStatus, pesoBruto: number, pesoTara: number): FluxoEtapa {
  if (status === "cancelado") return "cancelado";
  if (status === "fechado") return "fechado";
  const bruto = Number.isFinite(pesoBruto) ? pesoBruto : 0;
  const tara = Number.isFinite(pesoTara) ? pesoTara : 0;
  if (tara > 0 && bruto <= 0) return "inconsistente";
  if (bruto <= 0 && tara <= 0) return "aguardando_entrada";
  if (bruto > 0 && tara <= 0) return "aguardando_retorno";
  if (status !== "peso_finalizado") return "aguardando_finalizacao";
  return "peso_finalizado";
}

function getFluxoOperacao(etapa: FluxoEtapa): string {
  if (etapa === "cancelado") return "PESAGEM CANCELADA";
  if (etapa === "fechado") return "PESAGEM FECHADA";
  if (etapa === "aguardando_entrada") return "CAMINHAO AGUARDANDO ENTRADA";
  if (etapa === "aguardando_retorno") return "CAMINHAO EM RETORNO PARA TARA";
  if (etapa === "aguardando_finalizacao") return "CAMINHAO RETORNOU - AGUARDANDO FINALIZACAO";
  if (etapa === "peso_finalizado") return "CAMINHAO RETORNOU - PESO FINALIZADO";
  return "FLUXO INCONSISTENTE";
}

function getFluxoLabel(etapa: FluxoEtapa): string {
  if (etapa === "cancelado") return "Cancelado";
  if (etapa === "fechado") return "Fechado";
  if (etapa === "aguardando_entrada") return "Chegada - capturar bruto";
  if (etapa === "aguardando_retorno") return "Retorno - capturar tara";
  if (etapa === "aguardando_finalizacao") return "Tara capturada - salvar para finalizar";
  if (etapa === "peso_finalizado") return "Peso finalizado";
  return "Inconsistente (tara sem bruto)";
}

function applyFluxoToForm(current: FormState): FormState {
  const etapa = getFluxoEtapa(current.status, parseCurrency(current.pesoBruto), parseCurrency(current.pesoTara));
  const nextOperacao = getFluxoOperacao(etapa);
  if (current.operacao === nextOperacao) return current;
  return {
    ...current,
    operacao: nextOperacao,
  };
}

function normalizeStatus(value: string): PesagemStatus { const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); if (normalized === "peso_finalizado") return "peso_finalizado"; if (normalized === "fechado") return "fechado"; if (normalized === "cancelado") return "cancelado"; return "disponivel"; }
function parseCurrency(value: string): number { const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
function parseInteger(value: string): number { const parsed = Number.parseInt(String(value ?? "").replace(/\D/g, ""), 10); return Number.isFinite(parsed) ? Math.max(0, parsed) : 0; }
function formatCurrency(value: number): string { return (Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function sanitizeDecimal(value: string): string { return value.replace(/[^0-9,.-]/g, ""); }
function sanitizeInteger(value: string): string { return value.replace(/\D/g, ""); }
function toText(value: unknown): string { return String(value ?? "").trim(); }
function toNullableInt(value: string): number | null { const parsed = Number.parseInt(value, 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function toCurrency(value: unknown): string { const parsed = Number(value); return Number.isFinite(parsed) ? formatCurrency(parsed) : "0,00"; }
function toDateInput(value: unknown): string { const text = toText(value); const m = text.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(text); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); }
function toTimeInput(value: unknown): string { const text = toText(value); const m = text.match(/^(\d{2}:\d{2})/); return m?.[1] ?? ""; }
function parseDocumentosRows(value: unknown): DocumentoFiscal[] { if (!Array.isArray(value)) return []; return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => ({ documento: toText((item as Record<string, unknown>).documento) })); }
function parseMotivoRows(value: unknown): MotivoRow[] { if (!Array.isArray(value)) return []; return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => { const row = item as Record<string, unknown>; return { motivo: toText(row.motivo), tempoMinutos: String(Number.parseInt(String(row.tempoMinutos ?? 0), 10) || 0) }; }); }
function parseCalendarioRows(value: unknown): CalendarioRow[] { if (!Array.isArray(value)) return []; return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => { const row = item as Record<string, unknown>; return { data: toDateInput(row.data), dia: toText(row.dia), feriado: toBool(row.feriado), pago: toBool(row.pago), valor: toCurrency(row.valor) }; }); }
function parseGtaRows(value: unknown): GtaRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      const quantidadeMachos = String(parseInteger(String(row.quantidadeMachos ?? "0")));
      const quantidadeFemeas = String(parseInteger(String(row.quantidadeFemeas ?? "0")));
      const quantidadeTotalRaw = String(parseInteger(String(row.quantidadeTotal ?? "0")));
      const quantidadeTotal = parseInteger(quantidadeTotalRaw) > 0
        ? quantidadeTotalRaw
        : String(parseInteger(quantidadeMachos) + parseInteger(quantidadeFemeas));
      return {
        gta: toText(row.gta),
        quantidadeMachos,
        quantidadeFemeas,
        quantidadeTotal,
      };
    });
}
function parseFechamentoState(value: unknown): FechamentoState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_FECHAMENTO };
  const row = value as Record<string, unknown>;
  return {
    tabelaFrete: toText(row.tabelaFrete),
    calculoFrete: toText(row.calculoFrete),
    unidadeMedidaFrete: toText(row.unidadeMedidaFrete),
    valorUnitarioFrete: toCurrency(row.valorUnitarioFrete),
    valorCombustivel: toCurrency(row.valorCombustivel),
    valorPedagio: toCurrency(row.valorPedagio),
    outrasDespesas: toCurrency(row.outrasDespesas),
    litragem: toCurrency(row.litragem),
    valorCombLitro: toCurrency(row.valorCombLitro),
    valorDiaria: toCurrency(row.valorDiaria),
    valorComissao: toCurrency(row.valorComissao),
    valorFrete: toCurrency(row.valorFrete),
    pesagemOrigem: toText(row.pesagemOrigem),
    dataVencimento: toDateInput(row.dataVencimento),
    qtdAnimais: String(parseInteger(String(row.qtdAnimais ?? "0"))),
    qtdAnimaisOrigem: String(parseInteger(String(row.qtdAnimaisOrigem ?? "0"))),
    mapaPesagem: toText(row.mapaPesagem),
    cte: toText(row.cte),
    nfExterna: toText(row.nfExterna),
  };
}
function toBool(value: unknown): boolean { if (typeof value === "boolean") return value; const normalized = String(value ?? "").trim().toLowerCase(); return normalized === "1" || normalized === "true" || normalized === "sim" || normalized === "s"; }
