"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import { queryPnCatalog } from "@/lib/pn-catalog-client";
import type { ContratoStatus } from "@/lib/types/contrato";

const RESPONSAVEL_JURIDICO_FIXO = "CAMILA CARMO DE CARVALHO - 05500424580";

type TabKey = "dados" | "itens" | "frete" | "financeiro" | "notas" | "clausulas" | "previsoes" | "entrada_saida" | "sap_b1";
type ModalType = "item" | "frete" | "financeiro" | "nota" | "previsao" | "analise" | "clausula" | null;
type PnPickerTarget = "parceiro" | "comissionado" | "emissor" | "transportador";

type EmpresaOption = {
  id: number;
  codigo: string | null;
  nome: string;
  cnpj?: string | null;
  sapOnly?: boolean;
  sapExternalId?: string | null;
};
type ParceiroOption = {
  id: number;
  codigo: string | null;
  nome: string;
  documento: string | null;
  sapOnly?: boolean;
  sapExternalId?: string | null;
};
type CatalogOption = { value: string; label: string };
type ItemCatalog = {
  itens: CatalogOption[];
  unidades: CatalogOption[];
  condicoesPagamento: CatalogOption[];
  formasPagamento: CatalogOption[];
  depositos: CatalogOption[];
  centrosCusto: CatalogOption[];
  utilizacoes: CatalogOption[];
  moedas: CatalogOption[];
};

type ItemDraft = {
  itemId: string;
  undMedidaId: string;
  valorUnitario: string;
  quantidade: string;
  valorComissao: string;
  prazoEntrega: string;
  condicaoPagamentoId: string;
  depositoId: string;
  centroCustoId: string;
  utilizacaoId: string;
  moedaId: string;
};

type ItemRow = {
  itemId: string;
  item: string;
  undMedidaId: string;
  undMedida: string;
  valorUnitario: string;
  quantidade: string;
  valorTotal: string;
  valorComissao: string;
  prazoEntrega: string;
  condicaoPagamentoId: string;
  condicaoPagamento: string;
  depositoId: string;
  deposito: string;
  centroCustoId: string;
  centroCusto: string;
  utilizacaoId: string;
  utilizacao: string;
  moedaId: string;
  moeda: string;
};

type FinanceiroRow = {
  descricao: string;
  data: string;
  valor: string;
  taxaJuros: string;
  diasReferencia: string;
  condicaoPagamento: string;
  formaPagamento: string;
};

type ClausulaCatalogoItem = {
  id: string;
  codigo: string;
  titulo: string;
};

type ModeloClausulaDetalhe = {
  id: string;
  codigo: string;
  titulo: string;
  clausulas: Array<{
    codigo: string;
    referencia: string;
    descricao: string;
  }>;
};

type BasicForm = {
  tipoContrato: "saida_insumos" | "entrada_insumos";
  empresaId: string;
  exercicio: string;
  numero: string;
  parceiroId: string;
  contratoCedenteId: string;
  contratoAnteriorId: string;
  contratoPermutaId: string;
  referenciaContrato: string;
  inicioEm: string;
  vencimentoEm: string;
  assinaturaEm: string;
  prazoEntregaEm: string;
  permuta: boolean;
  aditivo: boolean;
  tipoAditivo: "nenhum" | "valor" | "prazo" | "quantidade" | "misto";
  valor: string;
  valorMaoObra: string;
  responsavelFrete: "empresa" | "parceiro" | "terceiro";
  calculoFrete: "fixo" | "por_tonelada" | "por_unidade" | "por_km" | "sem_frete" | "km_rodado" | "peso";
  valorUnitarioFrete: string;
  emissorNotaId: string;
  comissionadoId: string;
  valorComissao: string;
  assinaturaParceiro: string;
  assinaturaEmpresa: string;
  responsavelJuridicoNome: string;
  testemunha1Nome: string;
  testemunha1Cpf: string;
  testemunha2Nome: string;
  testemunha2Cpf: string;
  objeto: string;
  execucao: string;
};

type ContratoLoadResponse = {
  contrato?: Record<string, unknown>;
  itens?: Record<string, unknown>[];
  fretes?: Record<string, unknown>[];
  financeiro?: Record<string, unknown>[];
  notas?: Record<string, unknown>[];
  clausulas?: Record<string, unknown>[];
  previsoes?: Record<string, unknown>[];
};

type ContratoListResponse = {
  items?: Array<{
    id?: number | string | null;
    numero?: string | number | null;
    referenciaContrato?: string | null;
    parceiro?: string | null;
    tipoContrato?: string | null;
  }>;
};

type EntradaSaidaForm = {
  periodoProducao: string;
  fazenda: string;
  distanciaRaioKm: string;
  programacaoRetirada: string;
  programacaoPagamento: string;
};

type AnaliseRow = {
  tipoAnalise: string;
  valorMaximo: string;
};

const EMPTY_ITEM_CATALOG: ItemCatalog = {
  itens: [],
  unidades: [],
  condicoesPagamento: [],
  formasPagamento: [],
  depositos: [],
  centrosCusto: [],
  utilizacoes: [],
  moedas: [],
};

const FORMA_PAGAMENTO_FALLBACK: CatalogOption[] = [
  { value: "BOLETO", label: "BOLETO" },
  { value: "TRANSFERENCIA", label: "TRANSFERÊNCIA" },
  { value: "PIX", label: "PIX" },
  { value: "DINHEIRO", label: "DINHEIRO" },
  { value: "CARTAO", label: "CARTÃO" },
];

const STATUS_STEPS: Array<{ value: ContratoStatus; label: string }> = [
  { value: "aguardando_aprovacao", label: "Aguardando Aprovação" },
  { value: "ativo", label: "Ativo" },
  { value: "contendo_parc", label: "Conferido Parcialmente" },
  { value: "encerrado", label: "Encerrado" },
  { value: "inativo_cancelado", label: "Inativo/Cancelado" },
];

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "dados", label: "Dados Básicos" },
  { key: "itens", label: "Itens" },
  { key: "frete", label: "Frete" },
  { key: "financeiro", label: "Financeiro" },
  { key: "notas", label: "Notas" },
  { key: "clausulas", label: "Cláusulas" },
  { key: "previsoes", label: "Previsões" },
  { key: "entrada_saida", label: "Entrada/Saída de Insumos" },
  { key: "sap_b1", label: "SAP B1" },
];

const RESPONSAVEL_FRETE_OPTIONS: Array<{ value: BasicForm["responsavelFrete"]; label: string }> = [
  { value: "empresa", label: "Empresa" },
  { value: "parceiro", label: "Parceiro" },
  { value: "terceiro", label: "Terceiro" },
];

const CALCULO_FRETE_OPTIONS: Array<{ value: BasicForm["calculoFrete"]; label: string }> = [
  { value: "km_rodado", label: "KM rodado" },
  { value: "peso", label: "Peso" },
  { value: "fixo", label: "Fixo" },
  { value: "por_km", label: "Por KM" },
  { value: "por_tonelada", label: "Por tonelada" },
  { value: "por_unidade", label: "Por unidade" },
  { value: "sem_frete", label: "Sem frete" },
];

const TIPO_ADITIVO_OPTIONS: Array<{ value: BasicForm["tipoAditivo"]; label: string }> = [
  { value: "nenhum", label: "Nenhum" },
  { value: "valor", label: "Valor" },
  { value: "prazo", label: "Prazo" },
  { value: "quantidade", label: "Quantidade" },
  { value: "misto", label: "Misto" },
];

const TIPO_CONTRATO_OPTIONS: Array<{ value: BasicForm["tipoContrato"]; label: string }> = [
  { value: "saida_insumos", label: "Saída de Insumos" },
  { value: "entrada_insumos", label: "Entrada de Insumos" },
];

const PERIODO_PRODUCAO_OPTIONS = ["None", "Agrícola"];

const ANALISE_TIPO_OPTIONS = [
  "UMIDADE (FOB) ATÉ 14%",
  "IMPUREZA (FOB) ATÉ 1%",
  "AVARIADO (FOB) ATÉ 6%",
  "IMPUREZA (CIF) ATÉ 1%",
  "AVARIADO (CIF) ATÉ 6%",
  "UMIDADE SORGO E MILHETO (FOB) - ATÉ 13%",
  "UMIDADE SORGO E MILHETO (CIF) - ATÉ 13%",
  "MATÉRIA SECA (FOB)",
  "NDT",
  "PB",
  "EE",
  "FDN",
  "UMIDADE (CIF) ATÉ 14%",
  "PDR",
  "CA",
  "P",
  "MS",
  "MATÉRIA SECA (CIF)",
];

export default function NovoContratoSaidaInsumosPage() {
  const router = useRouter();
  const pathname = usePathname();
  const tipoContratoFixo: BasicForm["tipoContrato"] = pathname.includes("/entrada-insumos")
    ? "entrada_insumos"
    : "saida_insumos";
  const basePath = tipoContratoFixo === "entrada_insumos" ? "/contratos/entrada-insumos" : "/contratos/saida-insumos";
  const [editingContratoId, setEditingContratoId] = useState<number | null>(null);
  const isEditMode = editingContratoId !== null;
  const [activeTab, setActiveTab] = useState<TabKey>("dados");
  const [modalType, setModalType] = useState<ModalType>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingContrato, setLoadingContrato] = useState(false);
  const [savedContratoId, setSavedContratoId] = useState<number | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [loadingParceiros, setLoadingParceiros] = useState(true);
  const [pnPickerTarget, setPnPickerTarget] = useState<PnPickerTarget | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentStatus, setCurrentStatus] = useState<ContratoStatus>("aguardando_aprovacao");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [parceiros, setParceiros] = useState<ParceiroOption[]>([]);
  const [parceiroSearch, setParceiroSearch] = useState("");
  const [contratosRelacionados, setContratosRelacionados] = useState<CatalogOption[]>([]);
  const [contratosRelacionadosSearch, setContratosRelacionadosSearch] = useState("");
  const [loadingContratosRelacionados, setLoadingContratosRelacionados] = useState(false);
  const parceiroCatalogOptions = useMemo(
    () =>
      parceiros.map((parceiro) => ({
        value: String(parceiro.id),
        label: `${parceiro.codigo ?? "SEM-CÓD"} - ${parceiro.nome}${parceiro.documento ? ` - ${formatCpfCnpj(parceiro.documento)}` : ""}`,
      })),
    [parceiros],
  );
  const empresaCatalogOptions = useMemo(
    () =>
      empresas.map((empresa) => ({
        value: String(empresa.id),
        label: `${empresa.codigo ?? "SEM-CÓD"} - ${empresa.nome}`,
      })),
    [empresas],
  );
  const [itemCatalog, setItemCatalog] = useState<ItemCatalog>(EMPTY_ITEM_CATALOG);
  const [baseItemOptions, setBaseItemOptions] = useState<CatalogOption[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [loadingItensSap, setLoadingItensSap] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(createEmptyItemDraft(EMPTY_ITEM_CATALOG));
  const [itemSelecionados, setItemSelecionados] = useState<number[]>([]);
  const [parceiroFormaPagamentoOptions, setParceiroFormaPagamentoOptions] = useState<CatalogOption[]>([]);
  const formaPagamentoOptions = useMemo(
    () =>
      normalizeCatalogOptions([
        ...parceiroFormaPagamentoOptions,
        ...(itemCatalog.formasPagamento.length > 0 ? itemCatalog.formasPagamento : FORMA_PAGAMENTO_FALLBACK),
      ]),
    [itemCatalog.formasPagamento, parceiroFormaPagamentoOptions],
  );
  const [clausulasCatalogo, setClausulasCatalogo] = useState<ClausulaCatalogoItem[]>([]);

  const [itens, setItens] = useState<ItemRow[]>([]);
  const [fretes, setFretes] = useState<Record<string, string>[]>([]);
  const [financeiros, setFinanceiros] = useState<FinanceiroRow[]>([]);
  const [notas, setNotas] = useState<Record<string, string>[]>([]);
  const [clausulas, setClausulas] = useState<Record<string, string>[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingClausulaIndex, setEditingClausulaIndex] = useState<number | null>(null);
  const [previsoes, setPrevisoes] = useState<Record<string, string>[]>([]);
  const [entradaSaida, setEntradaSaida] = useState<EntradaSaidaForm>({
    periodoProducao: "",
    fazenda: "",
    distanciaRaioKm: "0,00",
    programacaoRetirada: "",
    programacaoPagamento: "",
  });
  const [analises, setAnalises] = useState<AnaliseRow[]>([]);
  const [clausulaCodigo, setClausulaCodigo] = useState("");
  const [clausulaTitulo, setClausulaTitulo] = useState("");

  const [form, setForm] = useState<BasicForm>({
    tipoContrato: tipoContratoFixo,
    empresaId: "",
    exercicio: String(new Date().getFullYear()),
    numero: "",
    parceiroId: "",
    contratoCedenteId: "",
    contratoAnteriorId: "",
    contratoPermutaId: "",
    referenciaContrato: "",
    inicioEm: "",
    vencimentoEm: "",
    assinaturaEm: "",
    prazoEntregaEm: "",
    permuta: false,
    aditivo: false,
    tipoAditivo: "nenhum",
    valor: "",
    valorMaoObra: "0,00",
    responsavelFrete: "empresa",
    calculoFrete: "km_rodado",
    valorUnitarioFrete: "0,00",
    emissorNotaId: "",
    comissionadoId: "",
    valorComissao: "0,00",
    assinaturaParceiro: "VENDEDOR(a)",
    assinaturaEmpresa: "COMPRADOR",
    responsavelJuridicoNome: RESPONSAVEL_JURIDICO_FIXO,
    testemunha1Nome: "",
    testemunha1Cpf: "",
    testemunha2Nome: "",
    testemunha2Cpf: "",
    objeto: "",
    execucao: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) {
      setEditingContratoId(null);
      return;
    }
    const parsed = Number.parseInt(idParam, 10);
    setEditingContratoId(Number.isNaN(parsed) || parsed <= 0 ? null : parsed);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingEmpresas(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "2000");
        if (empresaSearch.trim()) params.set("search", empresaSearch.trim());
        const response = await fetch(`/api/cadastros/empresas?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Falha ao carregar empresas.");
        const data = (await response.json()) as EmpresaOption[];
        if (!active) return;
        setEmpresas((prev) => {
          const selected = prev.find((item) => String(item.id) === form.empresaId);
          if (!selected || data.some((item) => item.id === selected.id)) return data;
          return [selected, ...data];
        });
        setForm((prev) => {
          if (prev.empresaId) return prev;
          return { ...prev, empresaId: String(data.find((item) => item.id > 0)?.id ?? data[0]?.id ?? "") };
        });
      } catch (loadError) {
        if (!active) return;
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar empresas.");
      } finally {
        if (active) {
          setLoadingEmpresas(false);
          setLoadingOptions(false);
        }
      }
    }, 250);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [empresaSearch, form.empresaId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingParceiros(true);
      try {
        const term = parceiroSearch.trim();
        const data = (await queryPnCatalog(term, {
          emptyLimit: 1500,
          searchLimit: 5000,
        })) as ParceiroOption[];
        if (active) {
          setParceiros((prev) => {
            if (term) return data;
            const selectedIds = new Set(
              [form.parceiroId, form.emissorNotaId, form.comissionadoId, draft.transportadorId]
                .map((item) => String(item ?? "").trim())
                .filter((item) => item.length > 0),
            );
            const selectedFromPrev = prev.filter(
              (item) => selectedIds.has(String(item.id)) && !data.some((next) => next.id === item.id),
            );
            if (selectedFromPrev.length === 0) return data;
            return [...selectedFromPrev, ...data];
          });
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        if (active) setError(loadError instanceof Error ? loadError.message : "Falha ao carregar parceiros.");
      } finally {
        if (active) setLoadingParceiros(false);
      }
    }, 180);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [draft.transportadorId, form.comissionadoId, form.emissorNotaId, form.parceiroId, parceiroSearch]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingContratosRelacionados(true);
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "300");
        const term = contratosRelacionadosSearch.trim();
        if (term) params.set("search", term);
        const [entradaResponse, saidaResponse] = await Promise.all([
          fetch(`/api/contratos/entrada-animais?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/contratos/saida-insumos?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        if (!entradaResponse.ok || !saidaResponse.ok) {
          throw new Error("Falha ao carregar lista de contratos relacionados.");
        }
        const [entradaData, saidaData] = (await Promise.all([
          entradaResponse.json(),
          saidaResponse.json(),
        ])) as [ContratoListResponse, ContratoListResponse];
        if (!active) return;
        const allItems = [...(entradaData.items ?? []), ...(saidaData.items ?? [])];
        const fetched = allItems
          .map((item) => {
            const id = String(item.id ?? "").trim();
            if (!id) return null;
            const numero = String(item.numero ?? "").trim();
            const referencia = String(item.referenciaContrato ?? "").trim();
            const parceiro = String(item.parceiro ?? "").trim();
            const tipo = normalizeSearchTerm(String(item.tipoContrato ?? "")).includes("entrada")
              ? "ENTRADA"
              : normalizeSearchTerm(String(item.tipoContrato ?? "")).includes("saida")
                ? "SAÍDA"
                : "CONTRATO";
            const base = [tipo, `#${id}`, numero || "S/N", referencia || "Sem referência"];
            if (parceiro) base.push(parceiro);
            return {
              value: id,
              label: base.join(" | "),
            };
          })
          .filter((item): item is CatalogOption => item !== null)
          .filter((item) => !editingContratoId || item.value !== String(editingContratoId));

        setContratosRelacionados((prev) => {
          const selectedIds = [form.contratoPermutaId, form.contratoCedenteId, form.contratoAnteriorId]
            .map((item) => String(item ?? "").trim())
            .filter((item) => item.length > 0);

          const selectedFallback = selectedIds.map((id) => {
            const fromFetched = fetched.find((option) => option.value === id);
            if (fromFetched) return fromFetched;
            const fromPrev = prev.find((option) => option.value === id);
            if (fromPrev) return fromPrev;
            return { value: id, label: `#${id}` };
          });

          return normalizeCatalogOptions([...selectedFallback, ...fetched]);
        });
      } catch (loadError) {
        if (!active) return;
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar contratos relacionados.");
      } finally {
        if (active) setLoadingContratosRelacionados(false);
      }
    }, 220);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [
    contratosRelacionadosSearch,
    editingContratoId,
    form.contratoAnteriorId,
    form.contratoCedenteId,
    form.contratoPermutaId,
  ]);

  function openPnPicker(target: PnPickerTarget) {
    setPnPickerTarget(target);
    setParceiroSearch("");
  }

  function closePnPicker() {
    setPnPickerTarget(null);
  }

  function handleSelectPn(option: ParceiroOption) {
    if (pnPickerTarget === "parceiro") {
      setForm((prev) => ({ ...prev, parceiroId: String(option.id) }));
      setParceiros((prev) => upsertParceiroOption(prev, option));
    } else if (pnPickerTarget === "comissionado") {
      setForm((prev) => ({ ...prev, comissionadoId: String(option.id) }));
      setParceiros((prev) => upsertParceiroOption(prev, option));
    } else if (pnPickerTarget === "emissor") {
      setForm((prev) => ({ ...prev, emissorNotaId: String(option.id) }));
      setParceiros((prev) => upsertParceiroOption(prev, option));
    } else if (pnPickerTarget === "transportador") {
      setDraft((prev) => ({ ...prev, transportadorId: String(option.id) }));
      setParceiros((prev) => upsertParceiroOption(prev, option));
    }
    closePnPicker();
  }

  useEffect(() => {
    let active = true;
    async function loadItemCatalog() {
      try {
        const response = await fetch("/api/cadastros/contratos/item-opcoes", { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar opções da aba de itens.");
        const data = (await response.json()) as Partial<ItemCatalog>;
        if (!active) return;
        const normalized = normalizeItemCatalog(data);
        setBaseItemOptions(normalized.itens);
        setItemCatalog(normalized);
        setItemDraft((prev) => hydrateItemDraft(prev, normalized));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar opções da aba de itens.");
      }
    }
    loadItemCatalog().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadClausulasCatalogo() {
      try {
        const response = await fetch("/api/cadastros/contratos/modelos-clausulas", { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar modelos de cláusulas.");
        const data = (await response.json()) as ClausulaCatalogoItem[];
        if (!active) return;
        setClausulasCatalogo(sortClausulasCatalogo(data));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar modelos de cláusulas.");
      }
    }
    loadClausulasCatalogo().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (modalType !== "financeiro") {
      setParceiroFormaPagamentoOptions([]);
      return;
    }
    if (!form.parceiroId) {
      setParceiroFormaPagamentoOptions([]);
      return;
    }

    const parceiroSelecionado = parceiros.find((item) => String(item.id) === form.parceiroId);
    const referencia =
      parceiroSelecionado?.sapExternalId?.trim() ||
      parceiroSelecionado?.codigo?.trim() ||
      parceiroSelecionado?.nome?.trim() ||
      "";
    if (!referencia) return;

    let active = true;
    const controller = new AbortController();
    setParceiroFormaPagamentoOptions([]);

    async function loadParceiroFinanceiroPadrao() {
      try {
        const params = new URLSearchParams({ referencia });
        const response = await fetch(`/api/cadastros/parceiros/financeiro?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          condicaoPagamento?: string;
          formaPagamento?: string;
          formasPagamento?: CatalogOption[];
        };
        if (!active) return;
        const formasPagamento = normalizeCatalogOptions(payload.formasPagamento);
        setParceiroFormaPagamentoOptions(formasPagamento);
        setDraft((prev) => {
          const hasCondicao = (prev.condicaoPagamento ?? "").trim().length > 0;
          const hasForma = (prev.formaPagamento ?? "").trim().length > 0;
          return {
            ...prev,
            condicaoPagamento: hasCondicao ? prev.condicaoPagamento ?? "" : (payload.condicaoPagamento ?? "").trim(),
            formaPagamento: hasForma ? prev.formaPagamento ?? "" : (payload.formaPagamento ?? "").trim(),
          };
        });
      } catch (loadError) {
        if (!active) return;
        if ((loadError as { name?: string })?.name === "AbortError") return;
      }
    }

    loadParceiroFinanceiroPadrao().catch(() => undefined);
    return () => {
      active = false;
      controller.abort();
    };
  }, [form.parceiroId, modalType, parceiros]);

  useEffect(() => {
    if (modalType !== "item" && modalType !== "frete") return;
    const term = itemSearch.trim();
    const selectedCatalogId = modalType === "frete" ? (draft.equipamentoId ?? "") : itemDraft.itemId;
    if (!term) {
      setItemCatalog((prev) => {
        const selectedFromPrev = prev.itens.find((option) => option.value === selectedCatalogId);
        const selectedFromBase = baseItemOptions.find((option) => option.value === selectedCatalogId);
        const selected = selectedFromPrev ?? selectedFromBase;
        return {
          ...prev,
          itens: normalizeCatalogOptions([
            ...(selected ? [selected] : []),
            ...baseItemOptions,
          ]),
        };
      });
      setLoadingItensSap(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingItensSap(true);
      try {
        const params = new URLSearchParams();
        params.set("itemSearch", term);
        params.set("limit", "all");
        const response = await fetch(`/api/cadastros/contratos/item-opcoes?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Falha ao pesquisar itens no SAP.");
        const data = (await response.json()) as Partial<ItemCatalog>;
        if (!active) return;
        const itensEncontrados = normalizeCatalogOptions(data.itens);
        setItemCatalog((prev) => {
          const selectedFromPrev = prev.itens.find((option) => option.value === selectedCatalogId);
          const selectedFromBase = baseItemOptions.find((option) => option.value === selectedCatalogId);
          const selected = selectedFromPrev ?? selectedFromBase;
          return {
            ...prev,
            itens: normalizeCatalogOptions([
              ...(selected ? [selected] : []),
              ...itensEncontrados,
            ]),
          };
        });
      } catch (loadError) {
        if (!active) return;
        if ((loadError as { name?: string })?.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao pesquisar itens.");
      } finally {
        if (active) setLoadingItensSap(false);
      }
    }, 180);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [baseItemOptions, draft.equipamentoId, itemDraft.itemId, itemSearch, modalType]);

  useEffect(() => {
    if (!isEditMode || !editingContratoId || Number.isNaN(editingContratoId)) return;
    let active = true;

    async function loadContrato() {
      setLoadingContrato(true);
      setError("");
      setSuccess("");
      try {
        const response = await fetch(`/api/contratos/saida-insumos/${editingContratoId}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Falha ao carregar contrato para edição.");
        }

        const payload = (await response.json()) as ContratoLoadResponse;
        if (!active) return;

        const contrato = (payload.contrato ?? {}) as Record<string, unknown>;
        const parceiroCodigoBase = asText(contrato.parceiro_codigo_base) || asText(contrato.parceiro_codigo_snapshot);
        const parceiroNomeBase = asText(contrato.parceiro_nome_base) || asText(contrato.parceiro_nome_snapshot);
        const parceiroDocumentoBase = asText(contrato.parceiro_documento_base) || asText(contrato.parceiro_documento_snapshot);
        const empresaCodigoBase = asText(contrato.empresa_codigo) || asText(contrato.empresa_codigo_snapshot);
        const empresaNomeBase = asText(contrato.empresa_nome) || asText(contrato.empresa_nome_snapshot);
        const empresaCnpjBase = asText(contrato.empresa_cnpj) || asText(contrato.empresa_cnpj_snapshot);
        const parceiroId = asPositiveString(contrato.parceiro_id);
        const empresaId = asPositiveString(contrato.empresa_id);
        const contratoBaseId = editingContratoId ?? 0;
        const parceiroSyntheticId =
          !parceiroId && parceiroNomeBase
            ? String(-(contratoBaseId + 2_000_000))
            : null;
        const empresaSyntheticId =
          !empresaId && empresaNomeBase
            ? String(-(contratoBaseId + 1_000_000))
            : null;

        setSavedContratoId(editingContratoId);
        setCurrentStatus(normalizeStatusValue(asText(contrato.status)));
        setSuccess(`Contrato #${editingContratoId} carregado para edição.`);

        setForm((prev) => ({
          ...prev,
          tipoContrato:
            tipoContratoFixo === "entrada_insumos"
              ? "entrada_insumos"
              : normalizeTipoContrato(asText(contrato.tp_contrato) || asText(contrato.tipoContrato)),
          empresaId: empresaId ?? empresaSyntheticId ?? prev.empresaId,
          exercicio: asText(contrato.ano) || prev.exercicio,
          numero: asText(contrato.numero) || "",
          parceiroId: parceiroId ?? parceiroSyntheticId ?? "",
          contratoCedenteId: asPositiveString(contrato.contrato_cedente_id) ?? "",
          contratoAnteriorId: asPositiveString(contrato.contrato_anterior_id) ?? "",
          contratoPermutaId: asPositiveString(contrato.contrato_permuta_id) ?? "",
          referenciaContrato: asText(contrato.descricao) || "",
          inicioEm: toDateInputValue(contrato.dt_inicio),
          vencimentoEm: toDateInputValue(contrato.dt_vencimento),
          assinaturaEm: toDateInputValue(contrato.dt_assinatura),
          prazoEntregaEm: toDateInputValue(contrato.prazo_entrega),
          permuta: asBoolean(contrato.permuta),
          aditivo: asBoolean(contrato.aditivo),
          tipoAditivo: "nenhum",
          valor: formatCurrencyFromUnknown(contrato.vl),
          valorMaoObra: formatCurrencyFromUnknown(contrato.vl_mao_obra),
          responsavelFrete: normalizeResponsavelFrete(asText(contrato.frete)),
          calculoFrete: normalizeCalculoFrete(asText(contrato.calculo_frete)),
          valorUnitarioFrete: formatCurrencyFromUnknown(contrato.vl_unit_frete),
          emissorNotaId: asPositiveString(contrato.emissorNotaId) ?? asPositiveString(contrato.emissor_nota_id) ?? "",
          comissionadoId: asPositiveString(contrato.comissionadoId) ?? asPositiveString(contrato.comissionado_id) ?? "",
          valorComissao: formatCurrencyFromUnknown(contrato.vl_comissao),
          assinaturaParceiro: asText(contrato.assinatura_parceiro) || "VENDEDOR(a)",
          assinaturaEmpresa: asText(contrato.assinatura_empresa) || "COMPRADOR",
          responsavelJuridicoNome: asText(contrato.responsavel_juridico) || RESPONSAVEL_JURIDICO_FIXO,
          testemunha1Nome: asText(contrato.testemunha) || "",
          testemunha1Cpf: formatCpf(asText(contrato.cpf_testemunha)),
          testemunha2Nome: asText(contrato.testemunha2) || "",
          testemunha2Cpf: formatCpf(asText(contrato.cpf_testemunha2)),
          objeto: asText(contrato.objeto) || "",
          execucao: asText(contrato.execucao) || "",
        }));

        setItens((payload.itens ?? []).map((row) => mapItemRowFromApi(row, EMPTY_ITEM_CATALOG)));
        setItemSelecionados([]);
        setFretes((payload.fretes ?? []).map(mapGenericRowFromApi));
        setFinanceiros((payload.financeiro ?? []).map((row) => mapFinanceiroRowFromApi(row)));
        setNotas((payload.notas ?? []).map(mapGenericRowFromApi));
        setClausulas((payload.clausulas ?? []).map(mapGenericRowFromApi));
        setPrevisoes((payload.previsoes ?? []).map(mapPrevisaoRowFromApi));
        setClausulaCodigo(
          asPositiveString(contrato.clausulaModeloId) ??
            asPositiveString(contrato.clausula_id) ??
            "",
        );
        setClausulaTitulo(
          asText(contrato.clausulaTitulo) ||
            asText(contrato.titulo_clausula) ||
            "",
        );

        const dadosGerais = asObject(contrato.dadosGerais);
        setEntradaSaida({
          periodoProducao: asText(dadosGerais.periodoProducao),
          fazenda: asText(dadosGerais.fazenda),
          distanciaRaioKm: formatCurrencyFromUnknown(dadosGerais.distanciaRaioKm),
          programacaoRetirada: asText(dadosGerais.programacaoRetirada),
          programacaoPagamento: asText(dadosGerais.programacaoPagamento),
        });
        setAnalises(
          Array.isArray(dadosGerais.analises)
            ? dadosGerais.analises
                .filter((item) => item && typeof item === "object" && !Array.isArray(item))
                .map((item) => {
                  const row = item as Record<string, unknown>;
                  return {
                    tipoAnalise: asText(row.tipoAnalise),
                    valorMaximo: formatCurrencyFromUnknown(row.valorMaximo),
                  };
                })
            : [],
        );

        const parceiroOptionId = parceiroId ?? parceiroSyntheticId;
        const parceiroSnapshot: ParceiroOption | null =
          parceiroOptionId && parceiroNomeBase
            ? {
                id: Number(parceiroOptionId),
                codigo: parceiroCodigoBase || null,
                nome: parceiroNomeBase,
                documento: parceiroDocumentoBase || null,
                sapOnly: !parceiroId,
                sapExternalId: parceiroCodigoBase || null,
              }
            : null;
        if (parceiroSnapshot) setParceiros((prev) => upsertParceiroOption(prev, parceiroSnapshot));

        const empresaOptionId = empresaId ?? empresaSyntheticId;
        const empresaSnapshot: EmpresaOption | null =
          empresaOptionId && empresaNomeBase
            ? {
                id: Number(empresaOptionId),
                codigo: empresaCodigoBase || null,
                nome: empresaNomeBase,
                cnpj: empresaCnpjBase || null,
                sapOnly: !empresaId,
                sapExternalId: empresaCodigoBase || null,
              }
            : null;
        if (empresaSnapshot) setEmpresas((prev) => upsertEmpresaOption(prev, empresaSnapshot));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar contrato.");
      } finally {
        if (active) setLoadingContrato(false);
      }
    }

    loadContrato().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [editingContratoId, isEditMode]);

  async function ensureSapEmpresaCache(empresa: EmpresaOption): Promise<EmpresaOption> {
    const response = await fetch("/api/cadastros/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sapExternalId: empresa.sapExternalId ?? empresa.codigo ?? empresa.nome,
        codigo: empresa.codigo ?? null,
        nome: empresa.nome,
        cnpj: empresa.cnpj ?? null,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Falha ao mapear filial SAP no banco local.");
    }

    return (await response.json()) as EmpresaOption;
  }

  async function ensureSapParceiroCache(parceiro: ParceiroOption): Promise<ParceiroOption> {
    const response = await fetch("/api/cadastros/parceiros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sapExternalId: parceiro.sapExternalId ?? parceiro.codigo ?? parceiro.nome,
        codigo: parceiro.codigo ?? null,
        nome: parceiro.nome,
        documento: parceiro.documento ?? null,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Falha ao mapear parceiro SAP no banco local.");
    }

    return (await response.json()) as ParceiroOption;
  }

  async function ensureParceiroFieldId(selectedId: string): Promise<string> {
    const trimmed = String(selectedId ?? "").trim();
    if (!trimmed) return "";
    const parceiroSelecionado = parceiros.find((item) => String(item.id) === trimmed);
    if (!parceiroSelecionado?.sapOnly) return trimmed;
    const ensured = await ensureSapParceiroCache(parceiroSelecionado);
    setParceiros((prev) => upsertParceiroOption(prev, ensured));
    return String(ensured.id);
  }

  function openModal(type: ModalType) {
    setError("");
    setEditingClausulaIndex(null);
    setEditingItemIndex(null);
    setModalType(type);
    if (type === "item") {
      setItemSearch("");
      setLoadingItensSap(false);
      setItemCatalog((prev) => ({ ...prev, itens: baseItemOptions.length > 0 ? baseItemOptions : prev.itens }));
      setItemDraft(createEmptyItemDraft(itemCatalog));
    }
    if (type === "frete") {
      setDraft({
        frete: "CIF",
        transportadorId: "",
        transportador: "",
        placa: "",
        motorista: "",
        cpfMotorista: "",
        observacao: "",
        valor: "0,00",
        qtd: "0,00",
        qtdChegada: "0,00",
        km: "0,00",
        dataEmbarque: "",
        dataEntrega: "",
        equipamentoId: "",
        equipamento: "",
      });
    }
    if (type === "financeiro") {
      setDraft({
        descricao: "",
        data: "",
        valor: "0,00",
        taxaJuros: "0,00",
        diasReferencia: "",
        condicaoPagamento: "",
        formaPagamento: "",
      });
    }
    if (type === "nota") setDraft({ nf: "" });
    if (type === "previsao") setDraft({ dataInicio: "", quantidade: "0,00" });
    if (type === "analise") setDraft({ tipoAnalise: "", valorMaximo: "0,00" });
    if (type === "clausula") {
      setEditingClausulaIndex(null);
      setDraft({
        codigo: "",
        referencia: clausulaTitulo.trim(),
        descricao: "",
      });
    }
  }

  async function saveModal() {
    if (!modalType) return;
    if (modalType === "item") {
      const valorUnitario = parseDecimal(itemDraft.valorUnitario);
      const quantidade = parseDecimal(itemDraft.quantidade);
      const valorComissao = parseDecimal(itemDraft.valorComissao);
      const valorTotal = valorUnitario * quantidade;
      const currentItemRow = editingItemIndex !== null ? itens[editingItemIndex] : null;
      const selectedItemLabel =
        optionLabelByItemValue(itemCatalog.itens, itemDraft.itemId) ||
        optionLabelByItemValue(baseItemOptions, itemDraft.itemId) ||
        currentItemRow?.item ||
        itemDraft.itemId;

      const row: ItemRow = {
        itemId: itemDraft.itemId,
        item: normalizeItemDisplayLabel(selectedItemLabel),
        undMedidaId: itemDraft.undMedidaId,
        undMedida: optionLabel(itemCatalog.unidades, itemDraft.undMedidaId),
        valorUnitario: toDecimal(valorUnitario),
        quantidade: toDecimal(quantidade),
        valorTotal: toDecimal(valorTotal),
        valorComissao: toDecimal(valorComissao),
        prazoEntrega: itemDraft.prazoEntrega,
        condicaoPagamentoId: itemDraft.condicaoPagamentoId,
        condicaoPagamento: optionLabel(itemCatalog.condicoesPagamento, itemDraft.condicaoPagamentoId),
        depositoId: itemDraft.depositoId,
        deposito: optionLabel(itemCatalog.depositos, itemDraft.depositoId),
        centroCustoId: itemDraft.centroCustoId,
        centroCusto: optionLabel(itemCatalog.centrosCusto, itemDraft.centroCustoId),
        utilizacaoId: itemDraft.utilizacaoId,
        utilizacao: optionLabel(itemCatalog.utilizacoes, itemDraft.utilizacaoId),
        moedaId: itemDraft.moedaId,
        moeda: optionLabel(itemCatalog.moedas, itemDraft.moedaId),
      };

      setItens((prev) => {
        if (editingItemIndex === null) return [...prev, row];
        if (editingItemIndex < 0 || editingItemIndex >= prev.length) return [...prev, row];
        return prev.map((item, index) => (index === editingItemIndex ? row : item));
      });
      setEditingItemIndex(null);
      setItemSelecionados([]);
      setModalType(null);
      return;
    }
    if (modalType === "frete") {
      const transportadorSelecionado = parceiroCatalogOptions.find((option) => option.value === draft.transportadorId);
      const equipamentoSelecionado = itemCatalog.itens.find((option) => option.value === draft.equipamentoId);
      const row = {
        ...draft,
        transportador: transportadorSelecionado?.label ?? draft.transportador ?? "",
        equipamento: equipamentoSelecionado?.label ?? draft.equipamento ?? "",
      };
      setFretes((prev) => [...prev, row]);
      setModalType(null);
      return;
    }
    if (modalType === "financeiro") {
      const row: FinanceiroRow = {
        descricao: draft.descricao?.trim() ?? "",
        data: draft.data ?? "",
        valor: draft.valor ?? "0,00",
        taxaJuros: draft.taxaJuros ?? "0,00",
        diasReferencia: draft.diasReferencia ?? "",
        condicaoPagamento: draft.condicaoPagamento?.trim() ?? "",
        formaPagamento: draft.formaPagamento?.trim() ?? "",
      };
      setFinanceiros((prev) => [...prev, row]);
      setModalType(null);
      return;
    }
    if (modalType === "clausula") {
      const descricao = (draft.descricao ?? "").trim();
      if (!descricao) {
        setError("Informe a descrição da cláusula.");
        return;
      }
      const row = {
        codigo: (draft.codigo ?? "").trim(),
        referencia: (draft.referencia ?? "").trim() || clausulaTitulo.trim(),
        descricao,
      };
      setClausulas((prev) => {
        const next = [...prev];
        if (editingClausulaIndex !== null && editingClausulaIndex >= 0 && editingClausulaIndex < next.length) {
          next[editingClausulaIndex] = row;
        } else {
          next.push(row);
        }
        return sortClausulasRows(next);
      });
      setEditingClausulaIndex(null);
      setModalType(null);
      return;
    }
    if (modalType === "nota") {
      if (!draft.nf?.trim()) return setError("Informe a NF.");
      return setNotas((prev) => [...prev, draft]), setModalType(null);
    }
    if (modalType === "previsao") {
      if (!draft.dataInicio?.trim()) return setError("Informe a data de início.");
      return setPrevisoes((prev) => [...prev, { dataInicio: draft.dataInicio, quantidade: draft.quantidade ?? "0,00" }]), setModalType(null);
    }
    if (modalType === "analise") {
      if (!draft.tipoAnalise?.trim()) return setError("Informe o tipo de análise.");
      return setAnalises((prev) => [...prev, { tipoAnalise: draft.tipoAnalise, valorMaximo: draft.valorMaximo ?? "0,00" }]), setModalType(null);
    }
  }

  function toggleItemSelecionado(index: number) {
    setItemSelecionados((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index].sort((a, b) => a - b),
    );
  }

  function toggleTodosItens(checked: boolean) {
    if (!checked) {
      setItemSelecionados([]);
      return;
    }
    setItemSelecionados(itens.map((_, index) => index));
  }

  function handleEditarItem(index: number) {
    const row = itens[index];
    if (!row) return;

    const itemOptions = normalizeCatalogOptions([
      { value: row.itemId, label: row.item || row.itemId },
      ...baseItemOptions,
      ...itemCatalog.itens,
    ]);
    const matchedValue = findCatalogValueByItem(itemOptions, row.itemId) ?? row.itemId;

    setError("");
    setEditingItemIndex(index);
    setItemSearch("");
    setLoadingItensSap(false);
    setBaseItemOptions((prev) =>
      normalizeCatalogOptions([{ value: matchedValue, label: row.item || row.itemId }, ...prev]),
    );
    setItemCatalog((prev) => ({ ...prev, itens: itemOptions }));
    setItemDraft({
      itemId: matchedValue,
      undMedidaId: row.undMedidaId,
      valorUnitario: row.valorUnitario,
      quantidade: row.quantidade,
      valorComissao: row.valorComissao,
      prazoEntrega: row.prazoEntrega,
      condicaoPagamentoId: row.condicaoPagamentoId,
      depositoId: row.depositoId,
      centroCustoId: row.centroCustoId,
      utilizacaoId: row.utilizacaoId,
      moedaId: row.moedaId,
    });
    setModalType("item");
  }

  function handleRemoverItem(index: number) {
    setItens((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setItemSelecionados((prev) =>
      prev
        .filter((selectedIndex) => selectedIndex !== index)
        .map((selectedIndex) => (selectedIndex > index ? selectedIndex - 1 : selectedIndex)),
    );
    setEditingItemIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }

  function handleRemoverItensSelecionados() {
    if (itemSelecionados.length === 0) return;
    const selectedSet = new Set(itemSelecionados);
    setItens((prev) => prev.filter((_, index) => !selectedSet.has(index)));
    setItemSelecionados([]);
    setEditingItemIndex(null);
  }

  async function applyClausulasDoModelo(clausulaId: string, options?: { replace?: boolean }) {
    const selected = clausulasCatalogo.find((item) => item.id === clausulaId);
    if (!selected) {
      setError("Selecione um modelo de contrato.");
      return;
    }

    try {
      const response = await fetch(`/api/cadastros/contratos/modelos-clausulas/${selected.id}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao carregar cláusulas do modelo selecionado.");
      }

      const detalhe = (await response.json()) as ModeloClausulaDetalhe;
      const linhas = Array.isArray(detalhe.clausulas) ? detalhe.clausulas : [];
      if (linhas.length === 0) {
        setError("O modelo selecionado não possui cláusulas cadastradas.");
        return;
      }

      const referenciaPadrao = clausulaTitulo.trim() || detalhe.titulo || selected.titulo;
      if (!referenciaPadrao) {
        setError("Informe o título do contrato para aplicar o modelo.");
        return;
      }

      const linhasMapeadas = sortClausulasRows(
        linhas
        .map((linha) => ({
          codigo: String(linha.codigo ?? "").trim(),
          referencia: String(linha.referencia ?? "").trim() || referenciaPadrao,
          descricao: String(linha.descricao ?? "").trim(),
        }))
        .filter((linha) => linha.descricao.length > 0),
      );

      if (linhasMapeadas.length === 0) {
        setError("O modelo selecionado não possui cláusulas válidas para inserção.");
        return;
      }

      setClausulaTitulo(referenciaPadrao);
      if (options?.replace) {
        setClausulas(linhasMapeadas);
        return;
      }
      setClausulas((prev) => {
        const seen = new Set(
          prev.map((row) => `${row.codigo ?? ""}|${row.referencia ?? ""}|${row.descricao ?? ""}`.toUpperCase()),
        );
        const merged = [...prev];
        for (const linha of linhasMapeadas) {
          const key = `${linha.codigo}|${linha.referencia}|${linha.descricao}`.toUpperCase();
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(linha);
        }
        return sortClausulasRows(merged);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao inserir cláusulas do modelo.");
      return;
    }
  }

  function handleSelectClausulaCatalogo(clausulaId: string) {
    setError("");
    setClausulaCodigo(clausulaId);
    const selected = clausulasCatalogo.find((item) => item.id === clausulaId);
    if (selected) {
      setClausulaTitulo(selected.titulo);
    }
    if (!clausulaId) return;
    void applyClausulasDoModelo(clausulaId, { replace: true });
  }

  async function handleAddClausulaContrato() {
    if (!clausulaCodigo) {
      setError("Selecione um modelo de contrato.");
      return;
    }
    await applyClausulasDoModelo(clausulaCodigo);
  }

  function handleNovaClausulaContrato() {
    setError("");
    setEditingClausulaIndex(null);
    setDraft({
      codigo: "",
      referencia: clausulaTitulo.trim(),
      descricao: "",
    });
    setModalType("clausula");
  }

  function handleEditarClausulaContrato(index: number) {
    const row = clausulas[index];
    if (!row) return;
    setError("");
    setEditingClausulaIndex(index);
    setDraft({
      codigo: row.codigo ?? "",
      referencia: row.referencia ?? "",
      descricao: row.descricao ?? "",
    });
    setModalType("clausula");
  }

  async function handleSaveContract(options?: { gerarPdf?: boolean; silent?: boolean }): Promise<number | null> {
    setError("");
    if (!options?.silent) {
      setSuccess("");
    }
    if (!form.empresaId) {
      setError("Selecione a empresa/filial.");
      return null;
    }
    const empresaSelecionadaBase = empresas.find((item) => String(item.id) === form.empresaId);
    let empresaSelecionada = empresaSelecionadaBase;
    let empresaId = toOptionalInt(form.empresaId);
    let empresaSap:
      | {
          sapExternalId: string | null;
          codigo: string | null;
          nome: string;
          cnpj: string | null;
        }
      | undefined;

    if (empresaSelecionada?.sapOnly) {
      const ensured = await ensureSapEmpresaCache(empresaSelecionada);
      empresaSelecionada = ensured;
      empresaSap = {
        sapExternalId: ensured.sapExternalId ?? empresaSelecionada.sapExternalId ?? null,
        codigo: ensured.codigo ?? empresaSelecionada.codigo ?? null,
        nome: ensured.nome || empresaSelecionada.nome,
        cnpj: ensured.cnpj ?? empresaSelecionada.cnpj ?? null,
      };
      empresaId = undefined;
      setEmpresas((prev) => upsertEmpresaOption(prev, ensured));
      setForm((prev) => ({ ...prev, empresaId: String(ensured.id) }));
    }
    if (!empresaSap?.nome && empresaSelecionada?.nome) {
      empresaSap = {
        sapExternalId: empresaSelecionada.sapExternalId ?? empresaSelecionada.codigo ?? null,
        codigo: empresaSelecionada.codigo ?? null,
        nome: empresaSelecionada.nome,
        cnpj: empresaSelecionada.cnpj ?? null,
      };
    }

    if (!form.parceiroId) {
      setError("Selecione o parceiro (PN) para continuar.");
      return null;
    }
    const parceiroSelecionadoBase = parceiros.find((item) => String(item.id) === form.parceiroId);
    let parceiroSelecionado = parceiroSelecionadoBase;
    let parceiroId = toOptionalInt(form.parceiroId);
    let parceiroSap:
      | {
          sapExternalId: string | null;
          codigo: string | null;
          nome: string;
          documento: string | null;
        }
      | undefined;

    if (parceiroSelecionado?.sapOnly) {
      const ensured = await ensureSapParceiroCache(parceiroSelecionado);
      parceiroSelecionado = ensured;
      parceiroSap = {
        sapExternalId: ensured.sapExternalId ?? parceiroSelecionado.sapExternalId ?? null,
        codigo: ensured.codigo ?? parceiroSelecionado.codigo ?? null,
        nome: ensured.nome || parceiroSelecionado.nome,
        documento: ensured.documento ?? parceiroSelecionado.documento ?? null,
      };
      parceiroId = undefined;
      setParceiros((prev) => upsertParceiroOption(prev, ensured));
      setForm((prev) => ({ ...prev, parceiroId: String(ensured.id) }));
    }
    if (!parceiroSap?.nome && parceiroSelecionado?.nome) {
      parceiroSap = {
        sapExternalId: parceiroSelecionado.sapExternalId ?? parceiroSelecionado.codigo ?? null,
        codigo: parceiroSelecionado.codigo ?? null,
        nome: parceiroSelecionado.nome,
        documento: parceiroSelecionado.documento ?? null,
      };
    }

    if (!parceiroId && !parceiroSap?.nome) {
      setError("Selecione o parceiro (PN) para continuar.");
      return null;
    }
    if (!isEditMode && !toOptionalInt(form.numero)) {
      setError("Informe o número do contrato.");
      return null;
    }
    if (!form.referenciaContrato.trim()) {
      setError("Referência do contrato é obrigatória.");
      return null;
    }
    const currentContratoId = isEditMode && editingContratoId ? editingContratoId : savedContratoId;
    const method = currentContratoId ? "PATCH" : "POST";
    const endpoint = currentContratoId
      ? `/api/contratos/saida-insumos/${currentContratoId}`
      : "/api/contratos/saida-insumos";

    setSaving(true);
    try {
      const emissorNotaIdResolved = await ensureParceiroFieldId(form.emissorNotaId);
      const comissionadoIdResolved = await ensureParceiroFieldId(form.comissionadoId);
      if (emissorNotaIdResolved !== form.emissorNotaId || comissionadoIdResolved !== form.comissionadoId) {
        setForm((prev) => ({
          ...prev,
          emissorNotaId: emissorNotaIdResolved,
          comissionadoId: comissionadoIdResolved,
        }));
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoContrato: form.tipoContrato,
          empresaId,
          empresaSap,
          parceiroId,
          parceiroSap,
          exercicio: toOptionalInt(form.exercicio),
          numero: toOptionalInt(form.numero),
          referenciaContrato: form.referenciaContrato.trim(),
          assinaturaEm: toOptionalString(form.assinaturaEm),
          prazoEntregaEm: toOptionalString(form.prazoEntregaEm),
          inicioEm: toOptionalString(form.inicioEm),
          vencimentoEm: toOptionalString(form.vencimentoEm),
          permuta: form.permuta,
          contratoPermutaId: toOptionalInt(form.contratoPermutaId),
          aditivo: form.aditivo,
          tipoAditivo: form.tipoAditivo,
          contratoCedenteId: toOptionalInt(form.contratoCedenteId),
          contratoAnteriorId: toOptionalInt(form.contratoAnteriorId),
          valor: toOptionalNumber(form.valor),
          valorMaoObra: toOptionalNumber(form.valorMaoObra),
          responsavelFrete: form.responsavelFrete,
          calculoFrete: form.calculoFrete,
          valorUnitarioFrete: toOptionalNumber(form.valorUnitarioFrete),
          emissorNotaId: toOptionalInt(emissorNotaIdResolved),
          comissionadoId: toOptionalInt(comissionadoIdResolved),
          valorComissao: toOptionalNumber(form.valorComissao),
          assinaturaParceiro: toOptionalString(form.assinaturaParceiro),
          assinaturaEmpresa: toOptionalString(form.assinaturaEmpresa),
          responsavelJuridicoNome: toOptionalString(form.responsavelJuridicoNome),
          testemunha1Nome: toOptionalString(form.testemunha1Nome),
          testemunha1Cpf: toOptionalString(form.testemunha1Cpf),
          testemunha2Nome: toOptionalString(form.testemunha2Nome),
          testemunha2Cpf: toOptionalString(form.testemunha2Cpf),
          objeto: toOptionalString(form.objeto),
          execucao: toOptionalString(form.execucao),
          itens,
          fretes,
          financeiros,
          notas,
          clausulas,
          clausulaModeloId: toOptionalInt(clausulaCodigo),
          clausulaTitulo: toOptionalString(clausulaTitulo),
          previsoes,
          dadosGerais: {
            periodoProducao: toOptionalString(entradaSaida.periodoProducao),
            fazenda: toOptionalString(entradaSaida.fazenda),
            distanciaRaioKm: toOptionalNumber(entradaSaida.distanciaRaioKm),
            programacaoRetirada: toOptionalString(entradaSaida.programacaoRetirada),
            programacaoPagamento: toOptionalString(entradaSaida.programacaoPagamento),
            analises: analises.map((item) => ({
              tipoAnalise: toOptionalString(item.tipoAnalise) ?? null,
              valorMaximo: toOptionalNumber(item.valorMaximo) ?? null,
            })),
          },
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao salvar contrato.");
      }
      const result = (await response.json()) as ContratoLoadResponse;
      const responseContratoId = Number(result?.contrato?.id ?? 0);
      const contratoId = currentContratoId ?? (Number.isNaN(responseContratoId) || responseContratoId <= 0 ? null : responseContratoId);
      if (contratoId) {
        setSavedContratoId(contratoId);
        setCurrentStatus(normalizeStatusValue(asText(result?.contrato?.status) || currentStatus));
        if (!options?.silent) {
          setSuccess(method === "POST" ? `Contrato #${contratoId} salvo com sucesso.` : `Contrato #${contratoId} atualizado com sucesso.`);
        }
        router.replace(`${basePath}/novo?id=${contratoId}`);
        if (options?.gerarPdf) {
          window.open(`/api/contratos/saida-insumos/${contratoId}/pdf`, "_blank", "noopener,noreferrer");
          return contratoId;
        }
        return contratoId;
      }
      router.push(basePath);
      return null;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado ao salvar.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(nextStatus: ContratoStatus, options?: { gerarPedido?: boolean }) {
    const shouldGenerate = options?.gerarPedido === true;
    setError("");
    setSuccess("");

    let contratoId = savedContratoId ?? editingContratoId ?? null;
    if (shouldGenerate) {
      const persistedContratoId = await handleSaveContract({ silent: true });
      if (!persistedContratoId || Number.isNaN(persistedContratoId)) {
        return;
      }
      contratoId = persistedContratoId;
    }

    if (!contratoId || Number.isNaN(contratoId)) {
      setError("Salve o contrato antes de atualizar o status.");
      return;
    }

    setStatusUpdating(true);
    try {
      const response = await fetch(`/api/contratos/saida-insumos/${contratoId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          gerarPedido: shouldGenerate,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        sapPedido?: {
          docEntry?: number | null;
          docNum?: number | null;
          jaExistente?: boolean;
        } | null;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Falha ao atualizar status.");
      }

      setCurrentStatus(nextStatus);
      if (shouldGenerate) {
        if (body?.sapPedido?.jaExistente) {
          const docNum = body.sapPedido.docNum ?? body.sapPedido.docEntry ?? null;
          setSuccess(docNum ? `Pedido SAP ja existente (#${docNum}). Status atualizado.` : "Pedido SAP ja existente. Status atualizado.");
        } else {
          const docNum = body?.sapPedido?.docNum ?? body?.sapPedido?.docEntry ?? null;
          setSuccess(docNum ? `Pedido de compra SAP #${docNum} gerado com sucesso.` : "Pedido de compra SAP gerado com sucesso.");
        }
      } else {
        setSuccess(`Status atualizado para "${statusLabel(nextStatus)}".`);
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Erro inesperado ao atualizar status.");
    } finally {
      setStatusUpdating(false);
    }
  }

  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <FormPageHeader
          title={
            isEditMode
              ? `Editar Contrato de ${tipoContratoLabel(form.tipoContrato)}`
              : `Novo Contrato de ${tipoContratoLabel(form.tipoContrato)}`
          }
          subtitle="Use as abas para preencher Dados Básicos, itens, frete, financeiro e validações do contrato."
          backHref="/contratos/saida-insumos"
        />
        <ModuleHeader />
        <section className="card p-3">
          <div className="legacy-toolbar">
            <div className="legacy-toolbar-left">
            <h1 className="legacy-title">
                Contrato de {tipoContratoLabel(form.tipoContrato)} / {isEditMode ? `(ID ${editingContratoId})` : "(Novo)"}
            </h1>
              <div className="legacy-actions">
                <button type="button" className="legacy-btn primary" onClick={() => handleSaveContract()} disabled={saving || loadingOptions || loadingContrato}>{saving ? "Salvando..." : "Salvar"}</button>
                <Link href="/contratos/saida-insumos" className="legacy-btn">Descartar</Link>
                <button type="button" className="legacy-btn" disabled>Ação</button>
                <button
                  type="button"
                  className="legacy-btn"
                  onClick={() => {
                    if (savedContratoId) {
                      window.open(`/api/contratos/saida-insumos/${savedContratoId}/pdf`, "_blank", "noopener,noreferrer");
                      return;
                    }
                    handleSaveContract({ gerarPdf: true }).catch(() => undefined);
                  }}
                  disabled={saving || loadingOptions || loadingContrato}
                >
                  Imprimir
                </button>
              </div>
            </div>
            <div className="legacy-stepper">
              {STATUS_STEPS.map((step) => (
                <span key={step.value} className={`step ${currentStatus === step.value ? "active" : ""}`}>
                  {step.label}
                </span>
              ))}
            </div>
          </div>
          <div className="legacy-actions mt-2">
            <button
              type="button"
              className="legacy-btn"
              onClick={() => handleChangeStatus("ativo", { gerarPedido: true })}
              disabled={saving || statusUpdating || loadingContrato || currentStatus === "ativo"}
            >
              {statusUpdating ? "Atualizando..." : currentStatus === "ativo" ? "Pedido ja gerado" : "Aprovar/Gerar Pedido"}
            </button>
          </div>
          {loadingContrato && <p className="legacy-message">Carregando contrato...</p>}
          {success && <p className="legacy-message success">{success}</p>}
          {error && <p className="legacy-message error">{error}</p>}

          <div className="legacy-form mt-2">
            <div className="legacy-grid cols-4">
              <label className="legacy-field col-span-2">
                <span>Empresa</span>
                <div className="legacy-inline">
                  <select className="legacy-select" value={form.empresaId} disabled={isEditMode} onChange={(event) => setForm((prev) => ({ ...prev, empresaId: event.target.value }))}>
                    <option value="">Selecione...</option>
                    {empresas.map((e, idx) => <option key={`empresa-${idx}`} value={e.id}>{e.codigo} - {e.nome}</option>)}
                  </select>
                  <input
                    className="legacy-input search"
                    placeholder="Buscar empresa..."
                    value={empresaSearch}
                    disabled={isEditMode}
                    onChange={(event) => setEmpresaSearch(event.target.value)}
                  />
                </div>
                {loadingEmpresas && <small className="mt-1 block text-xs text-[#6b7394]">Carregando opções...</small>}
              </label>
              <label className="legacy-field">
                <span>Tipo de Contrato</span>
                <select
                  className="legacy-select"
                  value={form.tipoContrato}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      tipoContrato: event.target.value as BasicForm["tipoContrato"],
                    }))
                  }
                  disabled={isEditMode || tipoContratoFixo === "entrada_insumos"}
                >
                  {TIPO_CONTRATO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="legacy-field"><span>Exercício</span><input className="legacy-input" value={form.exercicio} readOnly disabled /></label>
              <label className="legacy-field">
                <span>Número</span>
                <input
                  className="legacy-input"
                  value={form.numero}
                  onChange={(event) => setForm((prev) => ({ ...prev, numero: onlyNumber(event.target.value) }))}
                  readOnly={isEditMode}
                  disabled={isEditMode}
                />
              </label>
            </div>

            <div className="legacy-tabs">{tabs.map((tab) => <button key={tab.key} type="button" className={`legacy-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</div>

            {activeTab === "dados" && (
              <div className="legacy-grid cols-4 mt-2">
                <PickerTriggerField
                  label="Parceiro"
                  className="col-span-2"
                  valueLabel={optionLabel(parceiroCatalogOptions, form.parceiroId)}
                  onOpen={() => openPnPicker("parceiro")}
                  disabled={isEditMode}
                  loading={loadingParceiros}
                />
                <label className="legacy-field col-span-2"><span>Referência do Contrato</span><input className="legacy-input" value={form.referenciaContrato} onChange={(event) => setForm((prev) => ({ ...prev, referenciaContrato: event.target.value }))} /></label>
                <label className="legacy-field"><span>Início</span><input type="date" className="legacy-input" value={form.inicioEm} onChange={(event) => setForm((prev) => ({ ...prev, inicioEm: event.target.value }))} /></label>
                <label className="legacy-field"><span>Vencimento</span><input type="date" className="legacy-input" value={form.vencimentoEm} onChange={(event) => setForm((prev) => ({ ...prev, vencimentoEm: event.target.value }))} /></label>
                <label className="legacy-field"><span>Assinatura</span><input type="date" className="legacy-input" value={form.assinaturaEm} onChange={(event) => setForm((prev) => ({ ...prev, assinaturaEm: event.target.value }))} /></label>
                <label className="legacy-field"><span>Prazo Entrega</span><input type="date" className="legacy-input" value={form.prazoEntregaEm} onChange={(event) => setForm((prev) => ({ ...prev, prazoEntregaEm: event.target.value }))} /></label>

                <label className="legacy-field">
                  <span>Permuta</span>
                  <div className="legacy-check">
                    <input
                      type="checkbox"
                      checked={form.permuta}
                      onChange={(event) => setForm((prev) => ({ ...prev, permuta: event.target.checked }))}
                    />
                    Indica se o contrato permuta
                  </div>
                </label>
                <CatalogAutocompleteField
                  label="Contrato Permuta"
                  options={contratosRelacionados}
                  value={form.contratoPermutaId}
                  listId="saida-contrato-permuta-id"
                  loading={loadingContratosRelacionados}
                  onSearchTextChange={setContratosRelacionadosSearch}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, contratoPermutaId: value }))}
                />
                <label className="legacy-field">
                  <span>Aditivo</span>
                  <div className="legacy-check">
                    <input
                      type="checkbox"
                      checked={form.aditivo}
                      onChange={(event) => setForm((prev) => ({ ...prev, aditivo: event.target.checked }))}
                    />
                    Indica se o contrato aditiva
                  </div>
                </label>
                <label className="legacy-field">
                  <span>Tipo Aditivo</span>
                  <select
                    className="legacy-select"
                    value={form.tipoAditivo}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, tipoAditivo: event.target.value as BasicForm["tipoAditivo"] }))
                    }
                  >
                    {TIPO_ADITIVO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <CatalogAutocompleteField
                  label="Contrato Cedente"
                  options={contratosRelacionados}
                  value={form.contratoCedenteId}
                  listId="saida-contrato-cedente-id"
                  loading={loadingContratosRelacionados}
                  onSearchTextChange={setContratosRelacionadosSearch}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, contratoCedenteId: value }))}
                />
                <CatalogAutocompleteField
                  label="Contrato Anterior"
                  options={contratosRelacionados}
                  value={form.contratoAnteriorId}
                  listId="saida-contrato-anterior-id"
                  loading={loadingContratosRelacionados}
                  onSearchTextChange={setContratosRelacionadosSearch}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, contratoAnteriorId: value }))}
                />
                <label className="legacy-field"><span>Valor</span><input className="legacy-input" value={form.valor} onChange={(event) => setForm((prev) => ({ ...prev, valor: formatCurrencyBr(event.target.value) }))} /></label>
                <label className="legacy-field"><span>Mão de Obra</span><input className="legacy-input" value={form.valorMaoObra} onChange={(event) => setForm((prev) => ({ ...prev, valorMaoObra: formatCurrencyBr(event.target.value) }))} /></label>

                <label className="legacy-field">
                  <span>Responsável Frete</span>
                  <select
                    className="legacy-select"
                    value={form.responsavelFrete}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, responsavelFrete: event.target.value as BasicForm["responsavelFrete"] }))
                    }
                  >
                    {RESPONSAVEL_FRETE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="legacy-field">
                  <span>Cálculo Frete</span>
                  <select
                    className="legacy-select"
                    value={form.calculoFrete}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, calculoFrete: event.target.value as BasicForm["calculoFrete"] }))
                    }
                  >
                    {CALCULO_FRETE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="legacy-field"><span>Valor Unitário Frete</span><input className="legacy-input" value={form.valorUnitarioFrete} onChange={(event) => setForm((prev) => ({ ...prev, valorUnitarioFrete: formatCurrencyBr(event.target.value) }))} /></label>

                <PickerTriggerField
                  label="Emissor Nota"
                  className="col-span-2"
                  valueLabel={optionLabel(parceiroCatalogOptions, form.emissorNotaId)}
                  onOpen={() => openPnPicker("emissor")}
                  loading={loadingParceiros}
                />
                <label className="legacy-field"><span>Assinatura Parceiro</span><input className="legacy-input" value={form.assinaturaParceiro} onChange={(event) => setForm((prev) => ({ ...prev, assinaturaParceiro: event.target.value }))} /></label>
                <label className="legacy-field"><span>Assinatura Empresa</span><input className="legacy-input" value={form.assinaturaEmpresa} onChange={(event) => setForm((prev) => ({ ...prev, assinaturaEmpresa: event.target.value }))} /></label>
                <PickerTriggerField
                  label="Comissionado"
                  className="col-span-2"
                  valueLabel={optionLabel(parceiroCatalogOptions, form.comissionadoId)}
                  onOpen={() => openPnPicker("comissionado")}
                  loading={loadingParceiros}
                />
                <label className="legacy-field"><span>Valor Comissão</span><input className="legacy-input" value={form.valorComissao} onChange={(event) => setForm((prev) => ({ ...prev, valorComissao: formatCurrencyBr(event.target.value) }))} /></label>

                <h2 className="section-title mt-4 col-span-4">Informações Legais</h2>
                <label className="legacy-field"><span>Responsável Jurídico</span><input className="legacy-input" value={form.responsavelJuridicoNome} readOnly /></label>
                <label className="legacy-field"><span>Testemunha</span><input className="legacy-input" value={form.testemunha1Nome} onChange={(event) => setForm((prev) => ({ ...prev, testemunha1Nome: event.target.value }))} /></label>
                <label className="legacy-field"><span>CPF</span><input className="legacy-input" value={form.testemunha1Cpf} onChange={(event) => setForm((prev) => ({ ...prev, testemunha1Cpf: formatCpf(event.target.value) }))} /></label>
                <label className="legacy-field"><span>Segunda Testemunha</span><input className="legacy-input" value={form.testemunha2Nome} onChange={(event) => setForm((prev) => ({ ...prev, testemunha2Nome: event.target.value }))} /></label>
                <label className="legacy-field"><span>CPF</span><input className="legacy-input" value={form.testemunha2Cpf} onChange={(event) => setForm((prev) => ({ ...prev, testemunha2Cpf: formatCpf(event.target.value) }))} /></label>
                <label className="legacy-field col-span-2"><span>Objeto</span><textarea className="legacy-textarea" value={form.objeto} onChange={(event) => setForm((prev) => ({ ...prev, objeto: event.target.value }))} /></label>
                <label className="legacy-field col-span-2"><span>Execução</span><textarea className="legacy-textarea" value={form.execucao} onChange={(event) => setForm((prev) => ({ ...prev, execucao: event.target.value }))} /></label>
              </div>
            )}

            {activeTab === "itens" && (
              <ItensTab
                rows={itens}
                selecionados={itemSelecionados}
                onAdd={() => openModal("item")}
                onEdit={handleEditarItem}
                onRemove={handleRemoverItem}
                onRemoveSelecionados={handleRemoverItensSelecionados}
                onToggle={toggleItemSelecionado}
                onToggleTodos={toggleTodosItens}
              />
            )}
            {activeTab === "frete" && (
              <FreteTab
                rows={fretes}
                onAdd={() => openModal("frete")}
                onRemove={(index) => setFretes((prev) => prev.filter((_, i) => i !== index))}
              />
            )}
            {activeTab === "financeiro" && (
              <FinanceiroTab
                rows={financeiros}
                onAdd={() => openModal("financeiro")}
                onRemove={(index) => setFinanceiros((prev) => prev.filter((_, i) => i !== index))}
              />
            )}
            {activeTab === "notas" && (
              <TabTable
                onAdd={() => openModal("nota")}
                rows={notas}
                onRemove={(index) => setNotas((prev) => prev.filter((_, i) => i !== index))}
              />
            )}
            {activeTab === "clausulas" && (
              <ClausulasTab
                catalogo={clausulasCatalogo}
                clausulaSelecionadaId={clausulaCodigo}
                titulo={clausulaTitulo}
                rows={clausulas}
                onSelecionar={handleSelectClausulaCatalogo}
                onChangeTitulo={setClausulaTitulo}
                onAdicionar={handleAddClausulaContrato}
                onNova={handleNovaClausulaContrato}
                onEditar={handleEditarClausulaContrato}
                onRemove={(index) => setClausulas((prev) => prev.filter((_, i) => i !== index))}
              />
            )}
            {activeTab === "previsoes" && (
              <section className="mt-2">
                <div className="legacy-actions"><button type="button" className="legacy-btn" onClick={() => openModal("previsao")}>Adicionar</button></div>
                <div className="legacy-table-wrap mt-2">
                  <table className="legacy-table">
                    <thead>
                      <tr>
                        <th style={{ width: "36px" }}><input type="checkbox" disabled /></th>
                        <th>Data Início</th>
                        <th>Quantidade Prevista</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previsoes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="legacy-empty">Nenhum registro adicionado.</td>
                        </tr>
                      )}
                      {previsoes.map((row, index) => (
                        <tr key={`prev-${index}`}>
                          <td><input type="checkbox" disabled /></td>
                          <td>{row.dataInicio || "-"}</td>
                          <td>{row.quantidade || "0,00"}</td>
                          <td><button type="button" className="legacy-btn" onClick={() => setPrevisoes((prev) => prev.filter((_, i) => i !== index))}>Remover</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {activeTab === "entrada_saida" && (
              <section className="mt-2">
                <div className="legacy-grid cols-4">
                  <label className="legacy-field">
                    <span>Período Produção</span>
                    <select
                      className="legacy-select"
                      value={entradaSaida.periodoProducao}
                      onChange={(event) => setEntradaSaida((prev) => ({ ...prev, periodoProducao: event.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {PERIODO_PRODUCAO_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <CatalogAutocompleteField
                    label="Empresa"
                    options={empresaCatalogOptions}
                    value={entradaSaida.fazenda}
                    onValueChange={(value) => setEntradaSaida((prev) => ({ ...prev, fazenda: value }))}
                    onSearchTextChange={setEmpresaSearch}
                    listId="saida-insumos-empresa-entrada-saida"
                    loading={loadingEmpresas}
                  />
                  <label className="legacy-field">
                    <span>Distância (Raio-KM)</span>
                    <input
                      className="legacy-input"
                      value={entradaSaida.distanciaRaioKm}
                      onChange={(event) =>
                        setEntradaSaida((prev) => ({ ...prev, distanciaRaioKm: formatCurrencyBr(event.target.value) }))
                      }
                    />
                  </label>
                  <div />
                  <label className="legacy-field col-span-2">
                    <span>Programação Retirada</span>
                    <textarea
                      className="legacy-textarea"
                      value={entradaSaida.programacaoRetirada}
                      onChange={(event) =>
                        setEntradaSaida((prev) => ({ ...prev, programacaoRetirada: event.target.value }))
                      }
                    />
                  </label>
                  <label className="legacy-field col-span-2">
                    <span>Programação Pagamento</span>
                    <textarea
                      className="legacy-textarea"
                      value={entradaSaida.programacaoPagamento}
                      onChange={(event) =>
                        setEntradaSaida((prev) => ({ ...prev, programacaoPagamento: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="legacy-actions mt-2">
                  <button type="button" className="legacy-btn" onClick={() => openModal("analise")}>Adicionar</button>
                </div>
                <div className="legacy-table-wrap mt-2">
                  <table className="legacy-table">
                    <thead>
                      <tr>
                        <th style={{ width: "36px" }}><input type="checkbox" disabled /></th>
                        <th>Tipo Análise</th>
                        <th>Valor Máximo</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analises.length === 0 && (
                        <tr>
                          <td colSpan={4} className="legacy-empty">Nenhum registro adicionado.</td>
                        </tr>
                      )}
                      {analises.map((row, index) => (
                        <tr key={`analise-${index}`}>
                          <td><input type="checkbox" disabled /></td>
                          <td className="left">{row.tipoAnalise || "-"}</td>
                          <td>{row.valorMaximo || "0,00"}</td>
                          <td><button type="button" className="legacy-btn" onClick={() => setAnalises((prev) => prev.filter((_, i) => i !== index))}>Remover</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {activeTab === "sap_b1" && <Placeholder text="Aba pronta para receber o fluxo de integração SAP B1." />}
          </div>
        </section>
      </main>

      {pnPickerTarget && (
        <LegacyModal title="Pesquisar Parceiro (PN)" onClose={closePnPicker} zIndex={220}>
          <label className="legacy-field">
            <span>Pesquisar por nome, código ou documento</span>
            <input
              className="legacy-input"
              placeholder="Digite para buscar..."
              value={parceiroSearch}
              onChange={(event) => setParceiroSearch(event.target.value)}
              autoFocus
            />
          </label>
          {loadingParceiros && <p className="legacy-message">Carregando opções...</p>}
          {!loadingParceiros && (
            <div className="legacy-table-wrap mt-2">
              <table className="legacy-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Documento</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {parceiros.length === 0 && (
                    <tr>
                      <td colSpan={4} className="legacy-empty">Nenhum parceiro encontrado.</td>
                    </tr>
                  )}
                  {parceiros.slice(0, 200).map((item, index) => (
                    <tr key={`${item.id}-${index}`}>
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

      {modalType && (
        <LegacyModal
          title={`${modalType === "item" && editingItemIndex !== null ? "Editar" : "Adicionar"} ${
            modalType === "item"
              ? "Item"
              : modalType === "frete"
                ? "Frete"
                : modalType === "financeiro"
                ? "Financeiro"
                : modalType === "nota"
                  ? "Nota"
                  : modalType === "previsao"
                    ? "Previsão"
                    : modalType === "clausula"
                      ? "Cláusula"
                      : "Análise"
          }`}
          onClose={() => {
            setModalType(null);
            setEditingItemIndex(null);
            setEditingClausulaIndex(null);
          }}
        >
          {modalType === "item" ? (
            <div className="legacy-grid cols-4">
              <CatalogAutocompleteField
                label="Item"
                className="col-span-2"
                options={itemCatalog.itens}
                value={itemDraft.itemId}
                listId="saida-item-id"
                loading={loadingItensSap}
                onSearchTextChange={setItemSearch}
                onValueChange={(value) => setItemDraft((prev) => ({ ...prev, itemId: value }))}
              />
              <CatalogAutocompleteField
                label="Und Medida"
                className="col-span-2"
                options={itemCatalog.unidades}
                value={itemDraft.undMedidaId}
                listId="saida-und-medida-id"
                onValueChange={(value) => setItemDraft((prev) => ({ ...prev, undMedidaId: value }))}
              />
              <label className="legacy-field">
                <span>Valor Unitário</span>
                <input className="legacy-input" value={itemDraft.valorUnitario} onChange={(event) => setItemDraft((prev) => ({ ...prev, valorUnitario: formatCurrencyBr(event.target.value) }))} />
              </label>
              <label className="legacy-field">
                <span>Quantidade</span>
                <input className="legacy-input" value={itemDraft.quantidade} onChange={(event) => setItemDraft((prev) => ({ ...prev, quantidade: formatCurrencyBr(event.target.value) }))} />
              </label>
              <label className="legacy-field">
                <span>Valor Total</span>
                <input className="legacy-input" value={toDecimal(parseDecimal(itemDraft.valorUnitario) * parseDecimal(itemDraft.quantidade))} readOnly />
              </label>
              <label className="legacy-field">
                <span>Valor Comissão</span>
                <input className="legacy-input" value={itemDraft.valorComissao} onChange={(event) => setItemDraft((prev) => ({ ...prev, valorComissao: formatCurrencyBr(event.target.value) }))} />
              </label>
              <label className="legacy-field">
                <span>Prazo Entrega</span>
                <input type="date" className="legacy-input" value={itemDraft.prazoEntrega} onChange={(event) => setItemDraft((prev) => ({ ...prev, prazoEntrega: event.target.value }))} />
              </label>
              <CatalogAutocompleteField
                label="Condição de Pagamento"
                className="col-span-2"
                options={itemCatalog.condicoesPagamento}
                value={itemDraft.condicaoPagamentoId}
                listId="saida-condicao-pagamento-id"
                onValueChange={(value) => setItemDraft((prev) => ({ ...prev, condicaoPagamentoId: value }))}
              />
              <CatalogAutocompleteField
                label="Depósito"
                className="col-span-2"
                options={itemCatalog.depositos}
                value={itemDraft.depositoId}
                listId="saida-deposito-id"
                onValueChange={(value) => setItemDraft((prev) => ({ ...prev, depositoId: value }))}
              />
              <CatalogAutocompleteField
                label="Centro de Custo"
                className="col-span-2"
                options={itemCatalog.centrosCusto}
                value={itemDraft.centroCustoId}
                listId="saida-centro-custo-id"
                onValueChange={(value) => setItemDraft((prev) => ({ ...prev, centroCustoId: value }))}
              />
              <CatalogAutocompleteField
                label="Utilização"
                className="col-span-2"
                options={itemCatalog.utilizacoes}
                value={itemDraft.utilizacaoId}
                listId="saida-utilizacao-id"
                onValueChange={(value) => setItemDraft((prev) => ({ ...prev, utilizacaoId: value }))}
              />
              <CatalogAutocompleteField
                label="Moeda"
                className="col-span-2"
                options={itemCatalog.moedas}
                value={itemDraft.moedaId}
                listId="saida-moeda-id"
                onValueChange={(value) => setItemDraft((prev) => ({ ...prev, moedaId: value }))}
              />
            </div>
          ) : modalType === "frete" ? (
            <div className="legacy-grid cols-4">
              <label className="legacy-field col-span-2">
                <span>Frete</span>
                <select
                  className="legacy-select"
                  value={draft.frete ?? "CIF"}
                  onChange={(event) => setDraft((prev) => ({ ...prev, frete: event.target.value }))}
                >
                  <option value="CIF">CIF</option>
                  <option value="FOB">FOB</option>
                </select>
              </label>
              <PickerTriggerField
                label="Transportador"
                className="col-span-2"
                valueLabel={optionLabel(parceiroCatalogOptions, draft.transportadorId ?? "")}
                onOpen={() => openPnPicker("transportador")}
                loading={loadingParceiros}
              />
              <label className="legacy-field">
                <span>CPF Motorista</span>
                <input
                  className="legacy-input"
                  value={draft.cpfMotorista ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, cpfMotorista: formatCpf(event.target.value) }))}
                />
              </label>
              <label className="legacy-field">
                <span>Placa</span>
                <input
                  className="legacy-input"
                  value={draft.placa ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, placa: event.target.value.toUpperCase() }))}
                />
              </label>
              <label className="legacy-field col-span-2">
                <span>Observação</span>
                <textarea
                  className="legacy-textarea"
                  value={draft.observacao ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, observacao: event.target.value }))}
                />
              </label>
              <label className="legacy-field">
                <span>Valor</span>
                <input
                  className="legacy-input"
                  value={draft.valor ?? "0,00"}
                  onChange={(event) => setDraft((prev) => ({ ...prev, valor: formatCurrencyBr(event.target.value) }))}
                />
              </label>
              <label className="legacy-field">
                <span>Qtd</span>
                <input
                  className="legacy-input"
                  value={draft.qtd ?? "0,00"}
                  onChange={(event) => setDraft((prev) => ({ ...prev, qtd: formatCurrencyBr(event.target.value) }))}
                />
              </label>
              <label className="legacy-field">
                <span>Qtd Chegada</span>
                <input
                  className="legacy-input"
                  value={draft.qtdChegada ?? "0,00"}
                  onChange={(event) => setDraft((prev) => ({ ...prev, qtdChegada: formatCurrencyBr(event.target.value) }))}
                />
              </label>
              <label className="legacy-field">
                <span>KM</span>
                <input
                  className="legacy-input"
                  value={draft.km ?? "0,00"}
                  onChange={(event) => setDraft((prev) => ({ ...prev, km: formatCurrencyBr(event.target.value) }))}
                />
              </label>
              <label className="legacy-field">
                <span>Data Embarque</span>
                <input
                  type="date"
                  className="legacy-input"
                  value={draft.dataEmbarque ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, dataEmbarque: event.target.value }))}
                />
              </label>
              <label className="legacy-field">
                <span>Data Entrega</span>
                <input
                  type="date"
                  className="legacy-input"
                  value={draft.dataEntrega ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, dataEntrega: event.target.value }))}
                />
              </label>
              <CatalogAutocompleteField
                label="Equipamento"
                className="col-span-2"
                options={itemCatalog.itens}
                value={draft.equipamentoId ?? ""}
                listId="saida-frete-equipamento-id"
                loading={loadingItensSap}
                onSearchTextChange={setItemSearch}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, equipamentoId: value }))}
              />
            </div>
          ) : modalType === "financeiro" ? (
            <div className="legacy-grid cols-4">
              <label className="legacy-field col-span-2">
                <span>Descrição</span>
                <input
                  className="legacy-input"
                  value={draft.descricao ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, descricao: event.target.value }))}
                />
              </label>
              <label className="legacy-field">
                <span>Data</span>
                <input
                  type="date"
                  className="legacy-input"
                  value={draft.data ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, data: event.target.value }))}
                />
              </label>
              <label className="legacy-field">
                <span>Valor</span>
                <input
                  className="legacy-input"
                  value={draft.valor ?? "0,00"}
                  onChange={(event) => setDraft((prev) => ({ ...prev, valor: formatCurrencyBr(event.target.value) }))}
                />
              </label>
              <label className="legacy-field">
                <span>Taxa Juros</span>
                <input
                  className="legacy-input"
                  value={draft.taxaJuros ?? "0,00"}
                  onChange={(event) => setDraft((prev) => ({ ...prev, taxaJuros: formatCurrencyBr(event.target.value) }))}
                />
              </label>
              <label className="legacy-field">
                <span>Dias Referência</span>
                <input
                  className="legacy-input"
                  value={draft.diasReferencia ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, diasReferencia: onlyNumber(event.target.value) }))}
                />
              </label>
              <label className="legacy-field col-span-2">
                <span>Condição de Pagamento</span>
                <input
                  className="legacy-input"
                  list="saida-financeiro-condicao-pagamento-list"
                  placeholder="Digite para buscar..."
                  value={draft.condicaoPagamento ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, condicaoPagamento: event.target.value }))}
                />
                <datalist id="saida-financeiro-condicao-pagamento-list">
                  {itemCatalog.condicoesPagamento.map((option) => (
                    <option key={`saida-cond-${option.value}`} value={formatCatalogDisplayLabel(option)} />
                  ))}
                </datalist>
              </label>
              <label className="legacy-field col-span-2">
                <span>Forma de Pagamento</span>
                <select
                  className="legacy-select"
                  value={draft.formaPagamento ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, formaPagamento: event.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {formaPagamentoOptions.map((option) => (
                    <option key={`saida-forma-${option.value}`} value={formatCatalogDisplayLabel(option)}>
                      {formatCatalogDisplayLabel(option)}
                    </option>
                  ))}
                  {draft.formaPagamento &&
                    !formaPagamentoOptions.some(
                      (option) => formatCatalogDisplayLabel(option) === draft.formaPagamento,
                    ) && (
                      <option value={draft.formaPagamento}>{draft.formaPagamento}</option>
                    )}
                </select>
              </label>
            </div>
          ) : modalType === "nota" ? (
            <div className="legacy-grid cols-4">
              <label className="legacy-field col-span-2">
                <span>NF</span>
                <input
                  className="legacy-input"
                  value={draft.nf ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, nf: event.target.value }))}
                />
              </label>
            </div>
          ) : modalType === "previsao" ? (
            <div className="legacy-grid cols-4">
              <label className="legacy-field">
                <span>Data Início</span>
                <input
                  type="date"
                  className="legacy-input"
                  value={draft.dataInicio ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, dataInicio: event.target.value }))}
                />
              </label>
              <label className="legacy-field">
                <span>Quantidade Prevista</span>
                <input
                  className="legacy-input"
                  value={draft.quantidade ?? "0,00"}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, quantidade: formatCurrencyBr(event.target.value) }))
                  }
                />
              </label>
            </div>
          ) : modalType === "clausula" ? (
            <div className="legacy-grid cols-4">
              <label className="legacy-field">
                <span>Código</span>
                <input
                  className="legacy-input"
                  value={draft.codigo ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, codigo: event.target.value }))}
                />
              </label>
              <label className="legacy-field col-span-3">
                <span>Referência</span>
                <input
                  className="legacy-input"
                  value={draft.referencia ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, referencia: event.target.value }))}
                />
              </label>
              <label className="legacy-field col-span-4">
                <span>Descrição da Cláusula</span>
                <textarea
                  className="legacy-textarea"
                  value={draft.descricao ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, descricao: event.target.value }))}
                />
              </label>
            </div>
          ) : modalType === "analise" ? (
            <div className="legacy-grid cols-4">
              <label className="legacy-field col-span-2">
                <span>Tipo Análise</span>
                <select
                  className="legacy-select"
                  value={draft.tipoAnalise ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, tipoAnalise: event.target.value }))}
                >
                  <option value="">Selecione...</option>
                  {ANALISE_TIPO_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="legacy-field">
                <span>Valor Máximo</span>
                <input
                  className="legacy-input"
                  value={draft.valorMaximo ?? "0,00"}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, valorMaximo: formatCurrencyBr(event.target.value) }))
                  }
                />
              </label>
            </div>
          ) : (
            <div className="legacy-grid cols-4" />
          )}
          <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => { setModalType(null); setEditingItemIndex(null); setEditingClausulaIndex(null); }}>Descartar</button></div>
        </LegacyModal>
      )}
    </div>
  );
}

function TabTable({
  rows,
  onAdd,
  onRemove,
}: {
  rows: Record<string, string>[];
  onAdd?: () => void;
  onRemove: (index: number) => void;
}) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return (
    <section className="mt-2">
      {onAdd && <div className="legacy-actions"><button type="button" className="legacy-btn" onClick={onAdd}>Adicionar</button></div>}
      <div className="legacy-table-wrap mt-2">
        <table className="legacy-table">
          <thead><tr>{headers.length === 0 ? <th>Registro</th> : headers.map((header) => <th key={header}>{header}</th>)}<th>Ações</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={headers.length + 1} className="legacy-empty">Nenhum registro adicionado.</td></tr>}
            {rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.length === 0 ? <td>-</td> : headers.map((header) => <td key={header} className={header === "item" || header === "descricao" ? "left" : ""}>{row[header] || "-"}</td>)}<td><button type="button" className="legacy-btn" onClick={() => onRemove(rowIndex)}>Remover</button></td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ItensTab({
  rows,
  selecionados,
  onAdd,
  onEdit,
  onRemove,
  onRemoveSelecionados,
  onToggle,
  onToggleTodos,
}: {
  rows: ItemRow[];
  selecionados: number[];
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onRemoveSelecionados: () => void;
  onToggle: (index: number) => void;
  onToggleTodos: (checked: boolean) => void;
}) {
  const todosSelecionados = rows.length > 0 && selecionados.length === rows.length;

  return (
    <section className="mt-2">
      <p className="itens-title">Itens</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={onAdd}>Adicionar</button>
        <button type="button" className="legacy-btn itens-add-btn" onClick={onRemoveSelecionados} disabled={selecionados.length === 0}>
          Remover selecionados
        </button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <colgroup>
            <col style={{ width: "34px" }} />
            <col style={{ minWidth: "190px" }} />
            <col style={{ minWidth: "110px" }} />
            <col style={{ minWidth: "120px" }} />
            <col style={{ minWidth: "105px" }} />
            <col style={{ minWidth: "120px" }} />
            <col style={{ minWidth: "125px" }} />
            <col style={{ minWidth: "115px" }} />
            <col style={{ minWidth: "190px" }} />
            <col style={{ minWidth: "110px" }} />
            <col style={{ minWidth: "145px" }} />
            <col style={{ minWidth: "130px" }} />
            <col style={{ minWidth: "90px" }} />
            <col style={{ minWidth: "120px" }} />
          </colgroup>
          <thead>
            <tr>
              <th><input type="checkbox" checked={todosSelecionados} onChange={(event) => onToggleTodos(event.target.checked)} /></th>
              <th>Item</th>
              <th>Und Medida</th>
              <th>Valor Unitário</th>
              <th>Quantidade</th>
              <th>Valor Total</th>
              <th>Valor Comissão</th>
              <th>Prazo Entrega</th>
              <th>Condição de Pagamento</th>
              <th>Depósito</th>
              <th>Centro de Custo</th>
              <th>Utilização</th>
              <th>Moeda</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={14} className="itens-empty">&nbsp;</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={`${row.itemId}-${row.condicaoPagamentoId}-${index}`}>
                <td><input type="checkbox" checked={selecionados.includes(index)} onChange={() => onToggle(index)} /></td>
                <td className="left">{row.item || "-"}</td>
                <td>{row.undMedida || "-"}</td>
                <td>{row.valorUnitario || "0,00"}</td>
                <td>{row.quantidade || "0,00"}</td>
                <td>{row.valorTotal || "0,00"}</td>
                <td>{row.valorComissao || "0,00"}</td>
                <td>{row.prazoEntrega || "-"}</td>
                <td className="left">{row.condicaoPagamento || "-"}</td>
                <td className="left">{row.deposito || "-"}</td>
                <td className="left">{row.centroCusto || "-"}</td>
                <td className="left">{row.utilizacao || "-"}</td>
                <td>{row.moeda || "-"}</td>
                <td>
                  <button type="button" className="legacy-btn mr-1" onClick={() => onEdit(index)}>Editar</button>
                  <button type="button" className="legacy-btn" onClick={() => onRemove(index)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function findCatalogValueByItem(options: CatalogOption[], value: string): string | null {
  const exact = options.find((option) => option.value === value);
  if (exact) return exact.value;
  const normalizedValue = stripSapPrefix(value).toUpperCase();
  if (!normalizedValue) return null;
  const fuzzy = options.find((option) => stripSapPrefix(option.value).toUpperCase() === normalizedValue);
  return fuzzy?.value ?? null;
}

function optionLabelByItemValue(options: CatalogOption[], value: string): string {
  const exact = options.find((option) => option.value === value);
  if (exact) return exact.label;
  const normalizedValue = stripSapPrefix(value).toUpperCase();
  if (!normalizedValue) return "";
  const fuzzy = options.find((option) => stripSapPrefix(option.value).toUpperCase() === normalizedValue);
  return fuzzy?.label ?? "";
}

function normalizeItemDisplayLabel(value: string): string {
  const stripped = stripSapPrefix(value);
  if (!stripped) return "";
  return stripped.replace(/\s*-\s*-\s*/g, " - ").trim();
}

function stripSapPrefix(value: string): string {
  return String(value ?? "").replace(/^sap:[^:]+:/i, "").trim();
}

function FreteTab({
  rows,
  onAdd,
  onRemove,
}: {
  rows: Record<string, string>[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="mt-2">
      <p className="itens-title">Frete contrato</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={onAdd}>Adicionar</button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <thead>
            <tr>
              <th>Frete</th>
              <th>Placa</th>
              <th>Motorista</th>
              <th>Valor</th>
              <th>Qtd</th>
              <th>Data Embarque</th>
              <th>Data Entrega</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="itens-empty">&nbsp;</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={`${row.transportadorId ?? row.transportador ?? "frete"}-${index}`}>
                <td>{row.frete || "-"}</td>
                <td>{row.placa || "-"}</td>
                <td className="left">{row.transportador || "-"}</td>
                <td>{row.valor || "0,00"}</td>
                <td>{row.qtd || "0,00"}</td>
                <td>{row.dataEmbarque || "-"}</td>
                <td>{row.dataEntrega || "-"}</td>
                <td>
                  <button type="button" className="legacy-btn" onClick={() => onRemove(index)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FinanceiroTab({
  rows,
  onAdd,
  onRemove,
}: {
  rows: FinanceiroRow[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="mt-2">
      <p className="itens-title">Financeiro</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={onAdd}>Adicionar</button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Data</th>
              <th>Valor</th>
              <th>Taxa Juros</th>
              <th>Dias Referência</th>
              <th>Condição de Pagamento</th>
              <th>Forma de Pagamento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="itens-empty">&nbsp;</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={`${row.descricao}-${row.data}-${index}`}>
                <td className="left">{row.descricao || "-"}</td>
                <td>{row.data || "-"}</td>
                <td>{row.valor || "0,00"}</td>
                <td>{row.taxaJuros || "0,00"}</td>
                <td>{row.diasReferencia || "-"}</td>
                <td className="left">{row.condicaoPagamento || "-"}</td>
                <td className="left">{row.formaPagamento || "-"}</td>
                <td>
                  <button type="button" className="legacy-btn" onClick={() => onRemove(index)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClausulasTab({
  catalogo,
  clausulaSelecionadaId,
  titulo,
  rows,
  onSelecionar,
  onChangeTitulo,
  onAdicionar,
  onNova,
  onEditar,
  onRemove,
}: {
  catalogo: ClausulaCatalogoItem[];
  clausulaSelecionadaId: string;
  titulo: string;
  rows: Record<string, string>[];
  onSelecionar: (value: string) => void | Promise<void>;
  onChangeTitulo: (value: string) => void;
  onAdicionar: () => void | Promise<void>;
  onNova: () => void;
  onEditar: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const selecionadasAtivas = selecionadas.filter((index) => index >= 0 && index < rows.length);
  const todosSelecionados = rows.length > 0 && selecionadasAtivas.length === rows.length;

  function toggleClausula(index: number) {
    setSelecionadas((prev) => {
      const active = prev.filter((item) => item >= 0 && item < rows.length);
      return active.includes(index) ? active.filter((item) => item !== index) : [...active, index];
    });
  }

  function toggleTodasClausulas(checked: boolean) {
    if (!checked) {
      setSelecionadas([]);
      return;
    }
    setSelecionadas(rows.map((_, index) => index));
  }

  function removerSelecionadas() {
    if (selecionadasAtivas.length === 0) return;
    const ordered = [...selecionadasAtivas].sort((a, b) => b - a);
    ordered.forEach((index) => onRemove(index));
    setSelecionadas([]);
  }

  return (
    <section className="mt-2">
      <div className="legacy-grid cols-4">
        <label className="legacy-field">
          <span>Modelo de Contrato</span>
          <select
            className="legacy-select"
            value={clausulaSelecionadaId}
            onChange={(event) => void onSelecionar(event.target.value)}
          >
            <option value="">Selecione...</option>
            {catalogo.map((item) => (
              <option key={item.id} value={item.id}>
                {item.codigo} - {item.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="legacy-field col-span-2">
          <span>Título</span>
          <input
            className="legacy-input"
            value={titulo}
            onChange={(event) => onChangeTitulo(event.target.value)}
          />
        </label>
      </div>
      <p className="itens-title mt-2">Cláusula contrato</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={() => void onAdicionar()}>Aplicar Modelo</button>
        <button type="button" className="legacy-btn itens-add-btn" onClick={onNova}>Nova Cláusula</button>
        <button type="button" className="legacy-btn itens-add-btn" onClick={removerSelecionadas} disabled={selecionadasAtivas.length === 0}>Remover selecionadas</button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <thead>
            <tr>
              <th style={{ width: "36px" }}>
                <input type="checkbox" checked={todosSelecionados} onChange={(event) => toggleTodasClausulas(event.target.checked)} disabled={rows.length === 0} />
              </th>
              <th>Código</th>
              <th>Referência</th>
              <th>Descrição Cláusula</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="itens-empty">&nbsp;</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={`${row.codigo ?? ""}-${row.referencia ?? ""}-${index}`}>
                <td>
                  <input type="checkbox" checked={selecionadasAtivas.includes(index)} onChange={() => toggleClausula(index)} />
                </td>
                <td>{row.codigo || "-"}</td>
                <td className="left">{row.referencia || "-"}</td>
                <td className="left">{row.descricao || "-"}</td>
                <td>
                  <button type="button" className="legacy-btn mr-1" onClick={() => onEditar(index)}>Editar</button>
                  <button type="button" className="legacy-btn" onClick={() => {
                    onRemove(index);
                    setSelecionadas((prev) => prev.filter((item) => item !== index).map((item) => (item > index ? item - 1 : item)));
                  }}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <section className="placeholder-panel mt-2 p-4">
      <p className="placeholder-panel-text text-sm">{text}</p>
    </section>
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
  className,
  disabled,
  loading,
}: {
  label: string;
  valueLabel: string;
  onOpen: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <label className={`legacy-field ${className ?? ""}`}>
      <span>{label}</span>
      <div className="legacy-inline">
        <input className="legacy-input" value={valueLabel || ""} placeholder="Nenhum selecionado" readOnly />
        <button type="button" className="legacy-btn" onClick={onOpen} disabled={disabled}>
          Pesquisar
        </button>
      </div>
      {loading && <small className="mt-1 block text-xs text-[#6b7394]">Carregando opções...</small>}
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
  disabled,
  loading,
}: {
  label: string;
  options: CatalogOption[];
  value: string;
  onValueChange: (value: string) => void;
  onSearchTextChange?: (value: string) => void;
  listId: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";
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
    <label className={`legacy-field ${className ?? ""}`}>
      <span>{label}</span>
      <input
        className="legacy-input"
        list={`catalog-${listId}`}
        placeholder="Digite para buscar..."
        value={inputValue}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => {
          setIsFocused(true);
          const startText = value && selectedLabel ? selectedLabel : text;
          setText(startText);
          onSearchTextChange?.(startText);
        }}
        onBlur={() => {
          setIsFocused(false);
          if (value) {
            setText(stableSelectedLabel);
          }
        }}
      />
      <datalist id={`catalog-${listId}`}>
        {filteredOptions.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.label} />
        ))}
      </datalist>
      {isFocused && loading && <small className="mt-1 block text-xs text-[#6b7394]">Carregando opções...</small>}
    </label>
  );
}

function normalizeItemCatalog(value: Partial<ItemCatalog>): ItemCatalog {
  return {
    itens: normalizeCatalogOptions(value.itens),
    unidades: normalizeCatalogOptions(value.unidades),
    condicoesPagamento: normalizeCatalogOptions(value.condicoesPagamento),
    formasPagamento: normalizeCatalogOptions(value.formasPagamento),
    depositos: normalizeCatalogOptions(value.depositos),
    centrosCusto: normalizeCatalogOptions(value.centrosCusto),
    utilizacoes: normalizeCatalogOptions(value.utilizacoes),
    moedas: normalizeCatalogOptions(value.moedas),
  };
}

function normalizeCatalogOptions(value: unknown): CatalogOption[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<string, CatalogOption>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const data = item as Record<string, unknown>;
    const next = {
      value: String(data.value ?? "").trim(),
      label: String(data.label ?? "").trim(),
    };
    if (!next.value || !next.label) continue;
    const key = `${next.value}|${next.label}`.toUpperCase();
    if (!deduped.has(key)) {
      deduped.set(key, next);
    }
  }
  return Array.from(deduped.values());
}

function createEmptyItemDraft(_: ItemCatalog): ItemDraft {
  return {
    itemId: "",
    undMedidaId: "",
    valorUnitario: "0,00",
    quantidade: "0,00",
    valorComissao: "0,00",
    prazoEntrega: "",
    condicaoPagamentoId: "",
    depositoId: "",
    centroCustoId: "",
    utilizacaoId: "",
    moedaId: "",
  };
}

function hydrateItemDraft(draft: ItemDraft, catalog: ItemCatalog): ItemDraft {
  return {
    ...draft,
    itemId: pickExistingOrDefault(draft.itemId, catalog.itens),
    undMedidaId: pickExistingOrDefault(draft.undMedidaId, catalog.unidades),
    condicaoPagamentoId: pickExistingOrDefault(draft.condicaoPagamentoId, catalog.condicoesPagamento),
    depositoId: pickExistingOrDefault(draft.depositoId, catalog.depositos),
    centroCustoId: pickExistingOrDefault(draft.centroCustoId, catalog.centrosCusto),
    utilizacaoId: pickExistingOrDefault(draft.utilizacaoId, catalog.utilizacoes),
    moedaId: pickExistingOrDefault(draft.moedaId, catalog.moedas, preferBrMoeda(catalog.moedas)),
  };
}

function pickExistingOrDefault(value: string, options: CatalogOption[], fallback = ""): string {
  if (!value) return "";
  if (options.some((option) => option.value === value)) return value;
  if (fallback) return fallback;
  return options[0]?.value ?? "";
}

function preferBrMoeda(options: CatalogOption[]): string {
  const brl = options.find((option) => option.label.toUpperCase().includes("BRL") || option.label.toUpperCase().includes("REAL"));
  return brl?.value ?? options[0]?.value ?? "";
}

function formatCatalogDisplayLabel(option: CatalogOption): string {
  const value = String(option.value ?? "").trim();
  const label = String(option.label ?? "").trim();
  const sourceValue = value.includes(":") ? value.split(":").pop()?.trim() || value : value;
  if (!value) return label;
  if (!label) return value;
  if (label.includes(" - ")) return label;
  const normalizedLabel = label.toUpperCase();
  const normalizedValue = sourceValue.toUpperCase();
  if (normalizedLabel === normalizedValue || normalizedLabel.startsWith(`${normalizedValue} -`)) {
    return label;
  }
  return `${sourceValue} - ${label}`;
}

function sortClausulasCatalogo(items: ClausulaCatalogoItem[]): ClausulaCatalogoItem[] {
  return [...items].sort((a, b) => {
    const codigoA = normalizeSearchTerm(a.codigo);
    const codigoB = normalizeSearchTerm(b.codigo);
    if (codigoA !== codigoB) return codigoA.localeCompare(codigoB);
    return normalizeSearchTerm(a.titulo).localeCompare(normalizeSearchTerm(b.titulo));
  });
}

function sortClausulasRows(rows: Record<string, string>[]): Record<string, string>[] {
  return [...rows].sort((a, b) => {
    const codigoA = asText(a.codigo);
    const codigoB = asText(b.codigo);
    const numberA = parseLeadingNumber(codigoA);
    const numberB = parseLeadingNumber(codigoB);

    if (numberA !== null && numberB !== null && numberA !== numberB) return numberA - numberB;
    if (numberA !== null && numberB === null) return -1;
    if (numberA === null && numberB !== null) return 1;

    const codigoCmp = normalizeSearchTerm(codigoA).localeCompare(normalizeSearchTerm(codigoB), "pt-BR");
    if (codigoCmp !== 0) return codigoCmp;

    const refCmp = normalizeSearchTerm(asText(a.referencia)).localeCompare(
      normalizeSearchTerm(asText(b.referencia)),
      "pt-BR",
    );
    if (refCmp !== 0) return refCmp;

    return normalizeSearchTerm(asText(a.descricao)).localeCompare(
      normalizeSearchTerm(asText(b.descricao)),
      "pt-BR",
    );
  });
}

function parseLeadingNumber(value: string): number | null {
  const match = String(value ?? "").match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function upsertClausulaCatalogo(
  items: ClausulaCatalogoItem[],
  nextItem: ClausulaCatalogoItem,
): ClausulaCatalogoItem[] {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id || item.codigo === nextItem.codigo);
  if (existingIndex === -1) return [...items, nextItem];
  return items.map((item, index) => (index === existingIndex ? nextItem : item));
}

function mapGenericRowFromApi(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, asText(value)]),
  );
}

function mapItemRowFromApi(row: Record<string, unknown>, catalog: ItemCatalog): ItemRow {
  const itemId = asText(row.itemId) || "";
  const undMedidaId = asText(row.undMedidaId) || "";
  const condicaoPagamentoId = asText(row.condicaoPagamentoId) || "";
  const depositoId = asText(row.depositoId) || "";
  const centroCustoId = asText(row.centroCustoId) || "";
  const utilizacaoId = asText(row.utilizacaoId) || "";
  const moedaId = asText(row.moedaId) || "";
  const rawItemLabel = normalizeItemDisplayLabel(asText(row.item));
  const itemLabelFromCatalog = normalizeItemDisplayLabel(optionLabelByItemValue(catalog.itens, itemId));
  const itemCode = stripSapPrefix(itemId);
  const itemLabel =
    (rawItemLabel && rawItemLabel.toUpperCase() !== itemCode.toUpperCase() ? rawItemLabel : "") ||
    itemLabelFromCatalog ||
    rawItemLabel ||
    itemCode;

  return {
    itemId,
    item: itemLabel,
    undMedidaId,
    undMedida: asText(row.undMedida) || optionLabel(catalog.unidades, undMedidaId),
    valorUnitario: formatCurrencyFromUnknown(row.valorUnitario),
    quantidade: formatCurrencyFromUnknown(row.quantidade),
    valorTotal: formatCurrencyFromUnknown(row.valorTotal),
    valorComissao: formatCurrencyFromUnknown(row.valorComissao),
    prazoEntrega: toDateInputValue(row.prazoEntrega),
    condicaoPagamentoId,
    condicaoPagamento: asText(row.condicaoPagamento) || optionLabel(catalog.condicoesPagamento, condicaoPagamentoId),
    depositoId,
    deposito: asText(row.deposito) || optionLabel(catalog.depositos, depositoId),
    centroCustoId,
    centroCusto: asText(row.centroCusto) || optionLabel(catalog.centrosCusto, centroCustoId),
    utilizacaoId,
    utilizacao: asText(row.utilizacao) || optionLabel(catalog.utilizacoes, utilizacaoId),
    moedaId,
    moeda: asText(row.moeda) || optionLabel(catalog.moedas, moedaId),
  };
}

function mapFinanceiroRowFromApi(row: Record<string, unknown>): FinanceiroRow {
  return {
    descricao: asText(row.descricao) || "",
    data: toDateInputValue(row.data),
    valor: formatCurrencyFromUnknown(row.valor),
    taxaJuros: formatCurrencyFromUnknown(row.taxaJuros),
    diasReferencia: asText(row.diasReferencia) || "",
    condicaoPagamento: asText(row.condicaoPagamento) || "",
    formaPagamento: asText(row.formaPagamento) || "",
  };
}

function mapPrevisaoRowFromApi(row: Record<string, unknown>): Record<string, string> {
  return {
    dataInicio: asText(row.dataInicio ?? row.dtInicio ?? row.dt_inicio),
    quantidade: formatCurrencyFromUnknown(row.quantidade ?? row.qt ?? row.valor),
  };
}

function optionLabel(options: CatalogOption[], value: string): string {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label ?? "";
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asPositiveString(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return String(parsed);
}

function toDateInputValue(value: unknown): string {
  const text = asText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrencyFromUnknown(value: unknown): string {
  const parsed = parseUnknownNumber(value);
  if (Number.isNaN(parsed)) return "0,00";
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseUnknownNumber(value: unknown): number {
  const text = asText(value);
  if (!text) return Number.NaN;
  if (text.includes(",")) return Number(text.replace(/\./g, "").replace(",", "."));
  return Number(text);
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = asText(value).toLowerCase();
  return text === "true" || text === "1" || text === "t" || text === "sim";
}

function normalizeResponsavelFrete(value: string): BasicForm["responsavelFrete"] {
  if (value === "parceiro" || value === "terceiro") return value;
  return "empresa";
}

function normalizeCalculoFrete(value: string): BasicForm["calculoFrete"] {
  if (
    value === "fixo" ||
    value === "por_tonelada" ||
    value === "por_unidade" ||
    value === "por_km" ||
    value === "sem_frete" ||
    value === "km_rodado" ||
    value === "peso"
  ) {
    return value;
  }
  return "km_rodado";
}

function normalizeStatusValue(value: string): ContratoStatus {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (normalized === "ativo") return "ativo";
  if (
    normalized === "contendo_parc" ||
    normalized === "conferido_parc" ||
    normalized === "conferido_parcialmente"
  ) {
    return "contendo_parc";
  }
  if (normalized === "encerrado") return "encerrado";
  if (normalized === "inativo_cancelado" || normalized === "inativo/cancelado") return "inativo_cancelado";
  return "aguardando_aprovacao";
}

function statusLabel(value: ContratoStatus): string {
  if (value === "aguardando_aprovacao") return "Aguardando Aprovação";
  if (value === "ativo") return "Ativo";
  if (value === "contendo_parc") return "Conferido Parcialmente";
  if (value === "encerrado") return "Encerrado";
  return "Inativo/Cancelado";
}

function normalizeTipoContrato(value: string): BasicForm["tipoContrato"] {
  const normalized = normalizeSearchTerm(value);
  if (normalized.includes("entrada")) return "entrada_insumos";
  return "saida_insumos";
}

function tipoContratoLabel(value: BasicForm["tipoContrato"]): string {
  return value === "entrada_insumos" ? "Entrada de Insumos" : "Saída de Insumos";
}

function onlyNumber(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function onlyDecimal(value: string): string {
  return value.replace(/[^0-9.,-]/g, "").replace(",", ".");
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCnpj(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCpfCnpj(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length <= 11) return formatCpf(digits);
  return formatCnpj(digits);
}

function normalizeSearchTerm(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function filterCatalogOptions(options: CatalogOption[], search: string, selectedValue?: string): CatalogOption[] {
  const term = normalizeSearchTerm(search);
  if (!term) return options;

  const filtered = options.filter((option) => {
    const label = normalizeSearchTerm(option.label);
    const value = normalizeSearchTerm(option.value);
    return label.includes(term) || value.includes(term);
  });

  if (selectedValue && !filtered.some((option) => option.value === selectedValue)) {
    const selected = options.find((option) => option.value === selectedValue);
    if (selected) return [selected, ...filtered];
  }

  return filtered;
}

function formatCurrencyBr(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number.parseInt(digits, 10) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseDecimal(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toDecimal(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function toOptionalInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function toOptionalString(value: string): string | undefined {
  const parsed = value.trim();
  return parsed.length === 0 ? undefined : parsed;
}

function upsertEmpresaOption(current: EmpresaOption[], next: EmpresaOption): EmpresaOption[] {
  const index = current.findIndex((item) => item.id === next.id);
  if (index === -1) return [...current, next].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return current.map((item, position) => (position === index ? next : item));
}

function upsertParceiroOption(current: ParceiroOption[], next: ParceiroOption): ParceiroOption[] {
  const index = current.findIndex((item) => item.id === next.id);
  if (index === -1) return [...current, next].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return current.map((item, position) => (position === index ? next : item));
}
