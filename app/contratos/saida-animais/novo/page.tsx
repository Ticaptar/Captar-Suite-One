"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type SetStateAction, useEffect, useMemo, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import type { ContratoStatus } from "@/lib/types/contrato";

const RESPONSAVEL_JURIDICO_FIXO = "CAMILA CARMO DE CARVALHO - 05500424580";

type TabKey = "dados" | "itens" | "frete" | "financeiro" | "notas" | "clausulas" | "previsoes" | "outros" | "pecuaria_saida";
type ModalType = "item" | "frete" | "financeiro" | "nota" | "mapa" | "custo" | "clausula" | "lote" | "gta" | "abate" | null;
type PnPickerTarget =
  | "parceiro"
  | "emissor"
  | "comissionado"
  | "transportador"
  | "originador"
  | "comprador"
  | "faturador"
  | "frigorifico"
  | "anuente";

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

type FinanceiroRow = {
  descricao: string;
  data: string;
  valor: string;
  taxaJuros: string;
  diasReferencia: string;
  condicaoPagamento: string;
  formaPagamento: string;
  banco: string;
  agencia: string;
  conta: string;
  digito: string;
};

type CustosResumoForm = {
  valorMedioCepea: string;
  percentualParceria: string;
  percentualRecria: string;
  valorArroba: string;
  valorCabeca: string;
  valorFreteCab: string;
  valorIcmsArroba: string;
  valorIcmsFreteCab: string;
  valorProtocolo: string;
  valorBrinco: string;
  valorTotal: string;
  operacionalCabDia: string;
  operacionalCabDiaVendido: string;
  custoToneladaMs: string;
  custoToneladaMsVendido: string;
  valorArrobaProduzida: string;
  animaisPrevisto: string;
  descontoVendaArroba: string;
};

type CustoCategoriaRow = {
  categoria: string;
  qualidade: string;
  raca: string;
  quantidade: string;
  rendimentoCarcaca: string;
  pesoMedio: string;
  valorTabela: string;
  valorNegociado: string;
  valorFrete: string;
  valorIcmsArroba: string;
  cabecas: string;
  condicaoPagamento: string;
  valorTotal: string;
  observacao: string;
  contraoferta: string;
  trackCount: string;
};

type ContratoLoadResponse = {
  contrato?: Record<string, unknown>;
  itens?: Record<string, unknown>[];
  fretes?: Record<string, unknown>[];
  financeiro?: Record<string, unknown>[];
  notas?: Record<string, unknown>[];
  clausulas?: Record<string, unknown>[];
  previsoes?: Record<string, unknown>[];
  mapas?: Record<string, unknown>[];
  custos?: Record<string, unknown>[];
};

const STATUS_STEPS: Array<{ value: ContratoStatus; label: string }> = [
  { value: "aguardando_aprovacao", label: "Aguardando Aprovação" },
  { value: "ativo", label: "Ativo" },
  { value: "contendo_parc", label: "Conferido Parcialmente" },
  { value: "encerrado", label: "Encerrado" },
  { value: "inativo_cancelado", label: "Inativo/Cancelado" },
];

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

type BasicForm = {
  empresaId: string;
  exercicio: string;
  numero: string;
  parceiroId: string;
  referenciaContrato: string;
  inicioEm: string;
  vencimentoEm: string;
  assinaturaEm: string;
  prazoEntregaEm: string;
  contratoCedenteId: string;
  contratoAnteriorId: string;
  valor: string;
  valorMaoObra: string;
  responsavelFrete: "empresa" | "parceiro" | "terceiro";
  calculoFrete: "km_rodado" | "peso";
  valorUnitarioFrete: string;
  emissorNotaId: string;
  assinaturaParceiro: string;
  assinaturaEmpresa: string;
  comissionadoId: string;
  valorComissao: string;
  responsavelJuridicoNome: string;
  testemunha1Nome: string;
  testemunha1Cpf: string;
  testemunha2Nome: string;
  testemunha2Cpf: string;
  objeto: string;
  execucao: string;
};

type DadosGeraisForm = {
  tipoEntrada: string;
  tabelaPreco: string;
  originador: string;
  compradorId: string;
  faturadorId: string;
  frigorificoId: string;
  anuenteId: string;
  sexo: string;
  valorArroba: string;
  rcFixo: string;
  dataEmbarque: string;
  dataPesagem: string;
  dataAbate: string;
  tipoSaida: string;
  quantidadeNegociada: string;
  animaisMapa: string;
  pesoMapaKg: string;
  quantidadeGta: string;
  animaisMortos: string;
  animaisLesionados: string;
  animaisChegada: string;
  pesoChegadaKg: string;
  quebraKg: string;
  quebraArroba: string;
  quebraPercentual: string;
  animaisDesembarcados: string;
  animaisProcessado: string;
  pesoIdentificacaoKg: string;
  pesoBrutoCabeca: string;
  rcEntrada: string;
  pesoComRc: string;
  pesoConsideradoArroba: string;
  pesoConsideradoKg: string;
  pesoMedioAbate: string;
  dls: string;
  gmd: string;
  gmc: string;
  consumoPercentualPv: string;
  categoria: string;
  racaPredominante: string;
  precoVendaFutura: boolean;
};

type OutrosForm = {
  dataEmbarque: string;
  dataPrevistaChegada: string;
  freteConfinamento: string;
  fazendaDestino: string;
  fazendaOrigem: string;
  descontoAcerto: boolean;
  descricaoDesconto: string;
  pesoReferencia: string;
  observacao: string;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "dados", label: "Dados Básicos" },
  { key: "itens", label: "Itens" },
  { key: "frete", label: "Frete" },
  { key: "financeiro", label: "Financeiro" },
  { key: "notas", label: "Notas" },
  { key: "clausulas", label: "Cláusulas" },
  { key: "previsoes", label: "Previsões" },
  { key: "outros", label: "Outros" },
  { key: "pecuaria_saida", label: "Pecuária Saída" },
];

const RACA_PREDOMINANTE_OPTIONS = [
  "MESTICO",
  "CRUZAMENTO INDUSTRIAL",
  "NELORE",
  "LEITEIRO",
  "CRUZADO",
  "CRUZADO RUIM",
  "ABERDEEN ANGUS",
  "COMPOSTO",
  "RED ANGUS",
  "NONE",
  "GABIRU",
  "CARACU",
];

const CATEGORIA_OPTIONS = [
  "BEZERRO",
  "GARROTE",
  "BOI",
  "BEZERRA",
  "NOVILHA",
  "VACA",
  "CRUZADO",
  "NELORE",
  "GABIRU",
  "BOICHINA",
];

const QUALIDADE_OPTIONS = [
  "EXPORTAÇÃO",
  "MERCADO INTERNO",
  "NONE",
  "RUIM",
];

const TIPO_ENTRADA_OPTIONS = [
  "@ Fixa",
  "@ Produzida",
  "Custo por Consumo",
  "Boitel",
  "Compra",
  "Permuta",
  "Parceria - Recria",
];

const FORMA_PAGAMENTO_FALLBACK: CatalogOption[] = [
  { value: "BOLETO", label: "Boleto" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "PIX", label: "PIX" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "CARTAO", label: "Cartão" },
];

const DADOS_GERAIS_LIBERADOS: Array<keyof DadosGeraisForm> = [
  "tipoEntrada",
  "tabelaPreco",
  "originador",
  "compradorId",
  "faturadorId",
  "frigorificoId",
  "anuenteId",
  "sexo",
  "valorArroba",
  "rcFixo",
  "dataEmbarque",
  "dataPesagem",
  "dataAbate",
  "tipoSaida",
  "quantidadeNegociada",
  "animaisMapa",
  "animaisMortos",
  "animaisLesionados",
  "animaisChegada",
  "pesoChegadaKg",
  "dls",
  "categoria",
  "racaPredominante",
  "precoVendaFutura",
  "pesoMedioAbate",
  "rcEntrada",
  "gmd",
  "gmc",
  "consumoPercentualPv",
];

const DADOS_GERAIS_LIBERADOS_SET = new Set<keyof DadosGeraisForm>(DADOS_GERAIS_LIBERADOS);

export default function NovoContratoSaidaAnimaisPage() {
  const router = useRouter();
  const [editingContratoId, setEditingContratoId] = useState<number | null>(null);
  const isEditMode = editingContratoId !== null;
  const [activeTab, setActiveTab] = useState<TabKey>("dados");
  const [modalType, setModalType] = useState<ModalType>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingContrato, setLoadingContrato] = useState(false);
  const [savedContratoId, setSavedContratoId] = useState<number | null>(null);
  const [origemVisita, setOrigemVisita] = useState(false);
  const [origemVisitaId, setOrigemVisitaId] = useState<number | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [loadingParceiros, setLoadingParceiros] = useState(true);
  const [parceirosWarmLoaded, setParceirosWarmLoaded] = useState(false);
  const [pnPickerTarget, setPnPickerTarget] = useState<PnPickerTarget | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentStatus, setCurrentStatus] = useState<ContratoStatus>("aguardando_aprovacao");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [parceiros, setParceiros] = useState<ParceiroOption[]>([]);
  const [parceiroSearch, setParceiroSearch] = useState("");

  const [itens, setItens] = useState<ItemRow[]>([]);
  const [itemSelecionados, setItemSelecionados] = useState<number[]>([]);
  const [itemCatalog, setItemCatalog] = useState<ItemCatalog>(EMPTY_ITEM_CATALOG);
  const [baseItemOptions, setBaseItemOptions] = useState<CatalogOption[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [loadingItensSap, setLoadingItensSap] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(createEmptyItemDraft(EMPTY_ITEM_CATALOG));
  const [fretes, setFretes] = useState<Record<string, string>[]>([]);
  const [financeiros, setFinanceiros] = useState<FinanceiroRow[]>([]);
  const [custosResumo, setCustosResumo] = useState<CustosResumoForm>({
    valorMedioCepea: "0,00",
    percentualParceria: "0,00",
    percentualRecria: "0,00",
    valorArroba: "0,00",
    valorCabeca: "0,00",
    valorFreteCab: "0,00",
    valorIcmsArroba: "0,00",
    valorIcmsFreteCab: "0,00",
    valorProtocolo: "0,00",
    valorBrinco: "0,00",
    valorTotal: "0,00",
    operacionalCabDia: "0,00",
    operacionalCabDiaVendido: "0,00",
    custoToneladaMs: "0,00",
    custoToneladaMsVendido: "0,00",
    valorArrobaProduzida: "0,00",
    animaisPrevisto: "0,00",
    descontoVendaArroba: "0,00",
  });
  const [custos, setCustos] = useState<CustoCategoriaRow[]>([]);
  const [notas, setNotas] = useState<Record<string, string>[]>([]);
  const [clausulas, setClausulas] = useState<Record<string, string>[]>([]);
  const [editingClausulaIndex, setEditingClausulaIndex] = useState<number | null>(null);
  const [clausulasCatalogo, setClausulasCatalogo] = useState<ClausulaCatalogoItem[]>([]);
  const [mapas, setMapas] = useState<Record<string, string>[]>([]);
  const [lotesPecuaria, setLotesPecuaria] = useState<Record<string, string>[]>([]);
  const [gtaPecuaria, setGtaPecuaria] = useState<Record<string, string>[]>([]);
  const [abatesPecuaria, setAbatesPecuaria] = useState<Record<string, string>[]>([]);
  const [clausulaCodigo, setClausulaCodigo] = useState("");
  const [clausulaTitulo, setClausulaTitulo] = useState("");
  const empresaCatalogOptions = useMemo(
    () =>
      empresas.map((empresa) => ({
        value: String(empresa.id),
        label: `${empresa.codigo ?? "SEM-CÓD"} - ${empresa.nome}${empresa.cnpj ? ` - ${formatCnpj(empresa.cnpj)}` : ""}`,
      })),
    [empresas],
  );
  const parceiroCatalogOptions = useMemo(
    () =>
      parceiros.map((parceiro) => ({
        value: String(parceiro.id),
        label: `${parceiro.codigo ?? "SEM-CÓD"} - ${parceiro.nome}${parceiro.documento ? ` - ${formatCpfCnpj(parceiro.documento)}` : ""}`,
      })),
    [parceiros],
  );
  const [parceiroFormaPagamentoOptions, setParceiroFormaPagamentoOptions] = useState<CatalogOption[]>([]);
  const formaPagamentoOptions = useMemo(
    () =>
      normalizeCatalogOptions([
        ...parceiroFormaPagamentoOptions,
        ...(itemCatalog.formasPagamento.length > 0 ? itemCatalog.formasPagamento : FORMA_PAGAMENTO_FALLBACK),
      ]),
    [itemCatalog.formasPagamento, parceiroFormaPagamentoOptions],
  );

  const [form, setForm] = useState<BasicForm>({
    empresaId: "",
    exercicio: String(new Date().getFullYear()),
    numero: "",
    parceiroId: "",
    referenciaContrato: "",
    inicioEm: "",
    vencimentoEm: "",
    assinaturaEm: "",
    prazoEntregaEm: "",
    contratoCedenteId: "",
    contratoAnteriorId: "",
    valor: "0,00",
    valorMaoObra: "0,00",
    responsavelFrete: "empresa",
    calculoFrete: "km_rodado",
    valorUnitarioFrete: "0,00",
    emissorNotaId: "",
    assinaturaParceiro: "VENDEDOR(a)",
    assinaturaEmpresa: "COMPRADOR",
    comissionadoId: "",
    valorComissao: "0,00",
    responsavelJuridicoNome: RESPONSAVEL_JURIDICO_FIXO,
    testemunha1Nome: "",
    testemunha1Cpf: "",
    testemunha2Nome: "",
    testemunha2Cpf: "",
    objeto: "",
    execucao: "",
  });

  const [dadosGerais, setDadosGeraisState] = useState<DadosGeraisForm>({
    tipoEntrada: "Compra",
    tabelaPreco: "",
    originador: "",
    compradorId: "",
    faturadorId: "",
    frigorificoId: "",
    anuenteId: "",
    sexo: "",
    valorArroba: "0,00",
    rcFixo: "0,00",
    dataEmbarque: "",
    dataPesagem: "",
    dataAbate: "",
    tipoSaida: "Açougue",
    quantidadeNegociada: "",
    animaisMapa: "",
    pesoMapaKg: "0,00",
    quantidadeGta: "",
    animaisMortos: "",
    animaisLesionados: "",
    animaisChegada: "",
    pesoChegadaKg: "0,00",
    quebraKg: "0,00",
    quebraArroba: "0,00",
    quebraPercentual: "0,00",
    animaisDesembarcados: "",
    animaisProcessado: "0,00",
    pesoIdentificacaoKg: "0,00",
    pesoBrutoCabeca: "0,00",
    rcEntrada: "0,00",
    pesoComRc: "0,00",
    pesoConsideradoArroba: "0,00",
    pesoConsideradoKg: "0,00",
    pesoMedioAbate: "0,00",
    dls: "",
    gmd: "0,00",
    gmc: "0,00",
    consumoPercentualPv: "0,00",
    categoria: "",
    racaPredominante: "",
    precoVendaFutura: false,
  });

  const setDadosGerais = (updater: SetStateAction<DadosGeraisForm>) => {
    setDadosGeraisState((previous) => {
      const nextValue = typeof updater === "function" ? updater(previous) : updater;
      const sanitized = { ...nextValue } as Record<string, string | boolean>;
      const previousRecord = previous as Record<string, string | boolean>;
      for (const key of Object.keys(previous) as Array<keyof DadosGeraisForm>) {
        if (!DADOS_GERAIS_LIBERADOS_SET.has(key)) {
          sanitized[key] = previousRecord[key];
        }
      }
      return sanitized as DadosGeraisForm;
    });
  };

  useEffect(() => {
    const pesoMapaKg = parseDecimal(dadosGerais.pesoMapaKg);
    const pesoChegadaKg = parseDecimal(dadosGerais.pesoChegadaKg);
    const quebraKg = Math.max(pesoMapaKg - pesoChegadaKg, 0);
    const quebraArroba = quebraKg / 15;
    const quebraPercentual = pesoMapaKg > 0 ? (quebraKg / pesoMapaKg) * 100 : 0;

    const proximaQuebraKg = toDecimal(quebraKg);
    const proximaQuebraArroba = toDecimal(quebraArroba);
    const proximaQuebraPercentual = toDecimal(quebraPercentual);

    setDadosGeraisState((prev) => {
      if (
        prev.quebraKg === proximaQuebraKg &&
        prev.quebraArroba === proximaQuebraArroba &&
        prev.quebraPercentual === proximaQuebraPercentual
      ) {
        return prev;
      }
      return {
        ...prev,
        quebraKg: proximaQuebraKg,
        quebraArroba: proximaQuebraArroba,
        quebraPercentual: proximaQuebraPercentual,
      };
    });
  }, [dadosGerais.pesoChegadaKg, dadosGerais.pesoMapaKg]);

  const [outros, setOutros] = useState<OutrosForm>({
    dataEmbarque: "",
    dataPrevistaChegada: "",
    freteConfinamento: "",
    fazendaDestino: "",
    fazendaOrigem: "",
    descontoAcerto: false,
    descricaoDesconto: "",
    pesoReferencia: "Fazenda Origem",
    observacao: "",
  });

  const mapaPesagemHref = useMemo(() => {
    const contratoId = savedContratoId ?? editingContratoId;
    if (!contratoId || Number.isNaN(contratoId) || contratoId <= 0) {
      return "/mapa-pesagem";
    }
    return `/mapa-pesagem?contratoId=${contratoId}`;
  }, [editingContratoId, savedContratoId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    const fromVisitaParam = params.get("fromVisita");
    const visitaIdParam = params.get("visitaId");
    const visitaIdParsed = Number.parseInt(visitaIdParam ?? "", 10);
    const fromVisita = fromVisitaParam === "1" || String(fromVisitaParam).toLowerCase() === "true";
    setOrigemVisita(fromVisita);
    setOrigemVisitaId(Number.isNaN(visitaIdParsed) || visitaIdParsed <= 0 ? null : visitaIdParsed);
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
        if (!term && parceirosWarmLoaded) {
          if (active) setLoadingParceiros(false);
          return;
        }
        const params = new URLSearchParams();
        params.set("limit", term.length >= 2 ? "5000" : "1500");
        if (term) params.set("search", term);
        const parceirosUrl = `/api/cadastros/parceiros?${params.toString()}`;
        if (typeof window !== "undefined") {
          console.info("[DEBUG PN][Entrada] URL:", parceirosUrl);
        }
        const response = await fetch(parceirosUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Falha ao carregar parceiros.");
        const data = (await response.json()) as ParceiroOption[];
        if (active) {
          if (!term) setParceirosWarmLoaded(true);
          setParceiros((prev) => {
            if (term) return data;
            const selectedIds = new Set(
              [
                form.parceiroId,
                form.emissorNotaId,
                form.comissionadoId,
                dadosGerais.originador,
                dadosGerais.compradorId,
                dadosGerais.faturadorId,
                dadosGerais.frigorificoId,
                dadosGerais.anuenteId,
              ]
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
        if ((loadError as { name?: string })?.name === "AbortError") return;
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
  }, [
    dadosGerais.anuenteId,
    dadosGerais.compradorId,
    dadosGerais.faturadorId,
    dadosGerais.frigorificoId,
    dadosGerais.originador,
    form.comissionadoId,
    form.emissorNotaId,
    form.parceiroId,
    parceiroSearch,
    parceirosWarmLoaded,
  ]);

  function openPnPicker(target: PnPickerTarget) {
    setPnPickerTarget(target);
    setParceiroSearch("");
  }

  function closePnPicker() {
    setPnPickerTarget(null);
  }

  function handleSelectPn(option: ParceiroOption) {
    const id = String(option.id);
    if (pnPickerTarget === "parceiro") {
      setForm((prev) => ({ ...prev, parceiroId: id }));
    } else if (pnPickerTarget === "emissor") {
      setForm((prev) => ({ ...prev, emissorNotaId: id }));
    } else if (pnPickerTarget === "comissionado") {
      setForm((prev) => ({ ...prev, comissionadoId: id }));
    } else if (pnPickerTarget === "transportador") {
      setDraft((prev) => ({ ...prev, transportadorId: id }));
    } else if (pnPickerTarget === "originador") {
      setDadosGerais((prev) => ({ ...prev, originador: id }));
    } else if (pnPickerTarget === "comprador") {
      setDadosGerais((prev) => ({ ...prev, compradorId: id }));
    } else if (pnPickerTarget === "faturador") {
      setDadosGerais((prev) => ({ ...prev, faturadorId: id }));
    } else if (pnPickerTarget === "frigorifico") {
      setDadosGerais((prev) => ({ ...prev, frigorificoId: id }));
    } else if (pnPickerTarget === "anuente") {
      setDadosGerais((prev) => ({ ...prev, anuenteId: id }));
    }
    setParceiros((prev) => upsertParceiroOption(prev, option));
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
          banco?: string;
          agencia?: string;
          conta?: string;
          digito?: string;
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
            banco: (prev.banco ?? "").trim() || (payload.banco ?? "").trim(),
            agencia: (prev.agencia ?? "").trim() || (payload.agencia ?? "").trim(),
            conta: (prev.conta ?? "").trim() || (payload.conta ?? "").trim(),
            digito: (prev.digito ?? "").trim() || (payload.digito ?? "").trim(),
          };
        });
      } catch (error) {
        if (!active) return;
        if ((error as { name?: string })?.name === "AbortError") return;
      }
    }

    loadParceiroFinanceiroPadrao().catch(() => undefined);
    return () => {
      active = false;
      controller.abort();
    };
  }, [form.parceiroId, modalType, parceiros]);

  useEffect(() => {
    if (modalType !== "item") return;
    const term = itemSearch.trim();
    if (!term) {
      setItemCatalog((prev) => {
        const selectedFromPrev = findCatalogOptionByValue(prev.itens, itemDraft.itemId);
        const selectedFromBase = findCatalogOptionByValue(baseItemOptions, itemDraft.itemId);
        const selected = selectedFromPrev ?? selectedFromBase;
        return {
          ...prev,
          itens: normalizeCatalogOptions([...(selected ? [selected] : []), ...baseItemOptions]),
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
          const selectedFromPrev = findCatalogOptionByValue(prev.itens, itemDraft.itemId);
          const selectedFromBase = findCatalogOptionByValue(baseItemOptions, itemDraft.itemId);
          const selected = selectedFromPrev ?? selectedFromBase;
          return {
            ...prev,
            itens: normalizeCatalogOptions([...(selected ? [selected] : []), ...itensEncontrados]),
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
  }, [baseItemOptions, itemDraft.itemId, itemSearch, modalType]);

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
    if (!isEditMode || !editingContratoId || Number.isNaN(editingContratoId)) return;
    let active = true;

    async function loadContrato() {
      setLoadingContrato(true);
      setError("");
      setSuccess("");
      try {
        const response = await fetch(`/api/contratos/saida-animais/${editingContratoId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Falha ao carregar contrato para edição.");
        }

        const payload = (await response.json()) as ContratoLoadResponse;
        if (!active) return;

        const contrato = (payload.contrato ?? {}) as Record<string, unknown>;
        const refObjectId = toOptionalInt(asText(contrato.ref_object_id));
        if (!origemVisita && refObjectId) {
          setOrigemVisita(true);
          setOrigemVisitaId((prev) => prev ?? refObjectId);
        }
        const dadosGeraisData = asObject(contrato.dadosGerais);
        const outrosData = asObject(contrato.outros);
        const parceiroCodigoBase = asText(contrato.parceiro_codigo_base) || asText(contrato.parceiro_codigo_snapshot);
        const parceiroNomeBase = asText(contrato.parceiro_nome_base) || asText(contrato.parceiro_nome_snapshot);
        const parceiroDocumentoBase = asText(contrato.parceiro_documento_base) || asText(contrato.parceiro_documento_snapshot);
        const empresaCodigoBase = asText(contrato.empresa_codigo) || asText(contrato.empresa_codigo_snapshot);
        const empresaNomeBase = asText(contrato.empresa_nome) || asText(contrato.empresa_nome_snapshot);
        const empresaCnpjBase = asText(contrato.empresa_cnpj) || asText(contrato.empresa_cnpj_snapshot);
        const comissionadoSapData = asObject(contrato.comissionadoSap);
        const comissionadoCodigoBase = asText(comissionadoSapData.codigo);
        const comissionadoNomeBase = asText(comissionadoSapData.nome);
        const comissionadoDocumentoBase = asText(comissionadoSapData.documento);

        setCurrentStatus(normalizeStatusValue(asText(contrato.status)));
        setSavedContratoId(editingContratoId);
        setSuccess(`Contrato #${editingContratoId} carregado para edição.`);

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
        const comissionadoId = asPositiveString(contrato.comissionadoId) ?? asPositiveString(contrato.comissionado_id);
        const comissionadoSyntheticId =
          !comissionadoId && comissionadoNomeBase
            ? String(-(contratoBaseId + 3_000_000))
            : null;

        setForm((prev) => ({
          ...prev,
          empresaId: empresaId ?? empresaSyntheticId ?? prev.empresaId,
          exercicio: asText(contrato.ano) || prev.exercicio,
          numero: asText(contrato.numero) || "",
          parceiroId: parceiroId ?? parceiroSyntheticId ?? "",
          referenciaContrato: asText(contrato.descricao) || "",
          inicioEm: toDateInputValue(contrato.dt_inicio),
          vencimentoEm: toDateInputValue(contrato.dt_vencimento),
          assinaturaEm: toDateInputValue(contrato.dt_assinatura),
          prazoEntregaEm: toDateInputValue(contrato.prazo_entrega),
          contratoCedenteId: asPositiveString(contrato.contrato_cedente_id) ?? "",
          contratoAnteriorId: asPositiveString(contrato.contrato_anterior_id) ?? "",
          valor: formatCurrencyFromUnknown(contrato.vl),
          valorMaoObra: formatCurrencyFromUnknown(contrato.vl_mao_obra),
          responsavelFrete: normalizeResponsavelFrete(asText(contrato.frete)),
          calculoFrete: normalizeCalculoFrete(asText(contrato.calculo_frete)),
          valorUnitarioFrete: formatCurrencyFromUnknown(contrato.vl_unit_frete),
          emissorNotaId: asPositiveString(contrato.emissorNotaId) ?? "",
          assinaturaParceiro: asText(contrato.assinatura_parceiro) || "VENDEDOR(a)",
          assinaturaEmpresa: asText(contrato.assinatura_empresa) || "COMPRADOR",
          comissionadoId: comissionadoId ?? comissionadoSyntheticId ?? "",
          valorComissao: formatCurrencyFromUnknown(contrato.vl_comissao),
          responsavelJuridicoNome: asText(contrato.responsavel_juridico) || RESPONSAVEL_JURIDICO_FIXO,
          testemunha1Nome: asText(contrato.testemunha) || "",
          testemunha1Cpf: formatCpf(asText(contrato.cpf_testemunha)),
          testemunha2Nome: asText(contrato.testemunha2) || "",
          testemunha2Cpf: formatCpf(asText(contrato.cpf_testemunha2)),
          objeto: asText(contrato.objeto) || "",
          execucao: asText(contrato.execucao) || "",
        }));

        setDadosGeraisState((prev) => ({
          ...prev,
          tipoEntrada: asText(dadosGeraisData.tipoEntrada) || prev.tipoEntrada,
          tabelaPreco: asText(dadosGeraisData.tabelaPreco) || "",
          originador: asText(dadosGeraisData.originador) || "",
          compradorId: asText(dadosGeraisData.compradorId) || "",
          faturadorId: asText(dadosGeraisData.faturadorId) || "",
          frigorificoId: asText(dadosGeraisData.frigorificoId) || "",
          anuenteId: asText(dadosGeraisData.anuenteId) || "",
          sexo: asText(dadosGeraisData.sexo) || "",
          valorArroba: formatCurrencyFromUnknown(dadosGeraisData.valorArroba),
          rcFixo: formatCurrencyFromUnknown(dadosGeraisData.rcFixo),
          dataEmbarque: toDateInputValue(dadosGeraisData.dataEmbarque),
          dataPesagem: toDateInputValue(dadosGeraisData.dataPesagem),
          dataAbate: toDateInputValue(dadosGeraisData.dataAbate),
          tipoSaida: asText(dadosGeraisData.tipoSaida) || "Açougue",
          quantidadeNegociada: formatNumberFromUnknown(dadosGeraisData.quantidadeNegociada),
          animaisMapa: formatNumberFromUnknown(dadosGeraisData.animaisMapa),
          pesoMapaKg: formatCurrencyFromUnknown(dadosGeraisData.pesoMapaKg),
          quantidadeGta: formatNumberFromUnknown(dadosGeraisData.quantidadeGta),
          animaisMortos: formatNumberFromUnknown(dadosGeraisData.animaisMortos),
          animaisLesionados: formatNumberFromUnknown(dadosGeraisData.animaisLesionados),
          animaisChegada: formatNumberFromUnknown(dadosGeraisData.animaisChegada),
          pesoChegadaKg: formatCurrencyFromUnknown(dadosGeraisData.pesoChegadaKg),
          quebraKg: formatCurrencyFromUnknown(dadosGeraisData.quebraKg),
          quebraArroba: formatCurrencyFromUnknown(dadosGeraisData.quebraArroba),
          quebraPercentual: formatCurrencyFromUnknown(dadosGeraisData.quebraPercentual),
          animaisDesembarcados: formatNumberFromUnknown(dadosGeraisData.animaisDesembarcados),
          animaisProcessado: formatCurrencyFromUnknown(dadosGeraisData.animaisProcessado),
          pesoIdentificacaoKg: formatCurrencyFromUnknown(dadosGeraisData.pesoIdentificacaoKg),
          pesoBrutoCabeca: formatCurrencyFromUnknown(dadosGeraisData.pesoBrutoCabeca),
          rcEntrada: formatCurrencyFromUnknown(dadosGeraisData.rcEntrada),
          pesoComRc: formatCurrencyFromUnknown(dadosGeraisData.pesoComRc),
          pesoConsideradoArroba: formatCurrencyFromUnknown(dadosGeraisData.pesoConsideradoArroba),
          pesoConsideradoKg: formatCurrencyFromUnknown(dadosGeraisData.pesoConsideradoKg),
          pesoMedioAbate: formatCurrencyFromUnknown(dadosGeraisData.pesoMedioAbate),
          dls: toDateInputValue(dadosGeraisData.dls),
          gmd: formatCurrencyFromUnknown(dadosGeraisData.gmd),
          gmc: formatCurrencyFromUnknown(dadosGeraisData.gmc),
          consumoPercentualPv: formatCurrencyFromUnknown(dadosGeraisData.consumoPercentualPv),
          categoria: asText(dadosGeraisData.categoria) || "",
          racaPredominante: asText(dadosGeraisData.racaPredominante) || "",
          precoVendaFutura: Boolean(dadosGeraisData.precoVendaFutura),
        }));
        setLotesPecuaria(Array.isArray(dadosGeraisData.lotes) ? dadosGeraisData.lotes.map(mapGenericRowFromApi) : []);
        setGtaPecuaria(Array.isArray(dadosGeraisData.gtaContratos) ? dadosGeraisData.gtaContratos.map(mapGenericRowFromApi) : []);
        setAbatesPecuaria(Array.isArray(dadosGeraisData.abates) ? dadosGeraisData.abates.map(mapGenericRowFromApi) : []);

        setOutros({
          dataEmbarque: toDateInputValue(outrosData.dataEmbarque || contrato.dt_embarque),
          dataPrevistaChegada: toDateInputValue(
            outrosData.dataPrevistaChegada || contrato.dt_previsao_chegada || contrato.previsao_chegada,
          ),
          freteConfinamento: asText(outrosData.freteConfinamento) || asText(contrato.frete_confinamento) || "",
          fazendaDestino: asText(outrosData.fazendaDestino) || asText(contrato.fazenda_destino_id) || "",
          fazendaOrigem: asText(outrosData.fazendaOrigem) || asText(contrato.fazenda_origem) || "",
          descontoAcerto: asBoolean(outrosData.descontoAcerto) || Boolean(contrato.desconto_acerto),
          descricaoDesconto: asText(outrosData.descricaoDesconto) || asText(contrato.descricao_desconto) || "",
          pesoReferencia: asText(outrosData.pesoReferencia) || asText(contrato.peso_referencia) || "Fazenda Origem",
          observacao: asText(outrosData.observacao) || asText(contrato.observacao) || "",
        });

        setCustosResumo({
          valorMedioCepea: formatCurrencyFromUnknown(contrato.vl_cepea),
          percentualParceria: formatCurrencyFromUnknown(contrato.pct_parceria),
          percentualRecria: formatCurrencyFromUnknown(contrato.pct_recria),
          valorArroba: formatCurrencyFromUnknown(contrato.vl_arroba),
          valorCabeca: formatCurrencyFromUnknown(contrato.vl_cabeca),
          valorFreteCab: formatCurrencyFromUnknown(contrato.vl_frete_cab),
          valorIcmsArroba: formatCurrencyFromUnknown(contrato.vl_icms),
          valorIcmsFreteCab: formatCurrencyFromUnknown(contrato.vl_icms_frete),
          valorProtocolo: formatCurrencyFromUnknown(contrato.vl_protocolo),
          valorBrinco: formatCurrencyFromUnknown(contrato.vl_brinco),
          valorTotal: formatCurrencyFromUnknown(contrato.vl_total_compra),
          operacionalCabDia: formatCurrencyFromUnknown(contrato.custo_operacional),
          operacionalCabDiaVendido: formatCurrencyFromUnknown(contrato.custo_operacional_vendido),
          custoToneladaMs: formatCurrencyFromUnknown(contrato.custo_ton_ms),
          custoToneladaMsVendido: formatCurrencyFromUnknown(contrato.custo_ton_ms_vendido),
          valorArrobaProduzida: formatCurrencyFromUnknown(contrato.vl_arroba_produzida),
          animaisPrevisto: formatCurrencyFromUnknown(contrato.qt_animal_previsto),
          descontoVendaArroba: formatCurrencyFromUnknown(contrato.vl_desconto_venda),
        });

        setItens((payload.itens ?? []).map((row) => mapItemRowFromApi(row, itemCatalog)));
        setFretes((payload.fretes ?? []).map(mapGenericRowFromApi));
        setFinanceiros((payload.financeiro ?? []).map((row) => mapFinanceiroRowFromApi(row)));
        setCustos((payload.custos ?? []).map(mapCustoCategoriaRowFromApi));
        setNotas((payload.notas ?? []).map(mapGenericRowFromApi));
        setClausulas((payload.clausulas ?? []).map(mapGenericRowFromApi));
        setMapas((payload.mapas ?? []).map(mapGenericRowFromApi));
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

        const parceiroDisplay = joinTextParts([
          parceiroCodigoBase,
          parceiroNomeBase,
          parceiroDocumentoBase,
        ]);
        const parceiroOptionId = parceiroId ?? parceiroSyntheticId;
        if (parceiroOptionId && parceiroDisplay) {
          const snapshot: ParceiroOption = {
            id: Number(parceiroOptionId),
            codigo: parceiroCodigoBase || null,
            nome: parceiroNomeBase || parceiroDisplay,
            documento: parceiroDocumentoBase || null,
            sapOnly: !parceiroId,
            sapExternalId: parceiroCodigoBase || null,
          };
          setParceiros((prev) => upsertParceiroOption(prev, snapshot));
        }

        const comissionadoDisplay = joinTextParts([
          comissionadoCodigoBase,
          comissionadoNomeBase,
          comissionadoDocumentoBase,
        ]);
        const comissionadoOptionId = comissionadoId ?? comissionadoSyntheticId;
        if (comissionadoOptionId && comissionadoDisplay) {
          const snapshot: ParceiroOption = {
            id: Number(comissionadoOptionId),
            codigo: comissionadoCodigoBase || null,
            nome: comissionadoNomeBase || comissionadoDisplay,
            documento: comissionadoDocumentoBase || null,
            sapOnly: !comissionadoId,
            sapExternalId: asText(comissionadoSapData.sapExternalId) || comissionadoCodigoBase || null,
          };
          setParceiros((prev) => upsertParceiroOption(prev, snapshot));
        }

        const empresaDisplay = empresaNomeBase;
        const empresaOptionId = empresaId ?? empresaSyntheticId;
        if (empresaOptionId && empresaDisplay) {
          const snapshot: EmpresaOption = {
            id: Number(empresaOptionId),
            codigo: empresaCodigoBase || null,
            nome: empresaDisplay,
            cnpj: empresaCnpjBase || null,
            sapOnly: !empresaId,
            sapExternalId: empresaCodigoBase || null,
          };
          setEmpresas((prev) => upsertEmpresaOption(prev, snapshot));
        }
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
  }, [editingContratoId, isEditMode, origemVisita]);

  function openModal(type: ModalType) {
    setError("");
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
        banco: "",
        agencia: "",
        conta: "",
        digito: "",
      });
    }
    if (type === "nota") setDraft({ nf: "" });
    if (type === "mapa") setDraft({ descricao: "", dataInicio: "", quantidade: "0,00" });
    if (type === "custo") {
      setDraft({
        categoria: "",
        qualidade: "",
        raca: "",
        quantidade: "0,00",
        rendimentoCarcaca: "0,00",
        pesoMedio: "0,00",
        valorTabela: "0,00",
        valorNegociado: "0,00",
        valorFrete: "0,00",
        valorIcmsArroba: "0,00",
        cabecas: "",
        condicaoPagamento: "",
        valorTotal: "0,00",
        observacao: "",
        contraoferta: "0,00",
        trackCount: "",
      });
    }
    if (type === "clausula") {
      setEditingClausulaIndex(null);
      setDraft({
        codigo: "",
        referencia: clausulaTitulo.trim(),
        descricao: "",
      });
    }
    if (type === "lote") {
      setDraft({
        lote: "",
        curral: "",
        categoria: "",
        quantidadeTotal: "0",
        quantidadeSelecionada: "0",
        pesoMedioBruto: "0,00",
        pesoMedioBruto2: "0,00",
        pesoMedioBruto3: "0,00",
        arrobasProduzidas: "0,00",
      });
    }
    if (type === "gta") {
      setDraft({
        gta: "",
        peso: "0,00",
        qtd: "0,00",
        qtdMacho: "0,00",
        qtdFemea: "0,00",
      });
    }
    if (type === "abate") {
      setDraft({
        status: "Aberto",
        tipo: "Romaneio Geral",
        data: "",
        horaEntrada: "",
        horaSaida: "",
        valorArroba: "0,00",
        valorFreteArroba: "0,00",
        cabecas: "0,00",
        pesoVivoTotalKg: "0,00",
        pesoLiqCarcacaTotalKg: "0,00",
        pesoCarcacaArroba: "0,00",
        pesoMedioCarcacaKg: "0,00",
        pesoMedioCarcacaArroba: "0,00",
        valorAbate: "0,00",
        rcFixoPercentual: "0,00",
        rcRealPercentual: "0,00",
        cabecasExportacao: "0,00",
        percentualExportacao: "0,00",
        observacao: "",
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

      const row: ItemRow = {
        itemId: itemDraft.itemId,
        item: normalizeItemDisplayLabel(
          optionLabelByItemValue(itemCatalog.itens, itemDraft.itemId) ||
            optionLabelByItemValue(baseItemOptions, itemDraft.itemId) ||
            itemDraft.itemId,
        ),
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

      setItens((prev) => [...prev, row]);
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
        banco: draft.banco?.trim() ?? "",
        agencia: draft.agencia?.trim() ?? "",
        conta: draft.conta?.trim() ?? "",
        digito: draft.digito?.trim() ?? "",
      };
      setFinanceiros((prev) => [...prev, row]);
      setModalType(null);
      return;
    }
    if (modalType === "custo") {
      const row: CustoCategoriaRow = {
        categoria: draft.categoria?.trim() ?? "",
        qualidade: draft.qualidade?.trim() ?? "",
        raca: draft.raca?.trim() ?? "",
        quantidade: draft.quantidade ?? "0,00",
        rendimentoCarcaca: draft.rendimentoCarcaca ?? "0,00",
        pesoMedio: draft.pesoMedio ?? "0,00",
        valorTabela: draft.valorTabela ?? "0,00",
        valorNegociado: draft.valorNegociado ?? "0,00",
        valorFrete: draft.valorFrete ?? "0,00",
        valorIcmsArroba: draft.valorIcmsArroba ?? "0,00",
        cabecas: draft.cabecas ?? "",
        condicaoPagamento: draft.condicaoPagamento?.trim() ?? "",
        valorTotal: draft.valorTotal ?? "0,00",
        observacao: draft.observacao?.trim() ?? "",
        contraoferta: draft.contraoferta ?? "0,00",
        trackCount: draft.trackCount ?? "",
      };
      setCustos((prev) => [...prev, row]);
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
    if (modalType === "lote") {
      setLotesPecuaria((prev) => [...prev, draft]);
      setModalType(null);
      return;
    }
    if (modalType === "gta") {
      setGtaPecuaria((prev) => [...prev, draft]);
      setModalType(null);
      return;
    }
    if (modalType === "abate") {
      setAbatesPecuaria((prev) => [...prev, draft]);
      setModalType(null);
      return;
    }
    if (modalType === "mapa") return setMapas((prev) => [...prev, draft]), setModalType(null);
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

  async function handleSaveContract(options?: { gerarPdf?: boolean }) {
    setError("");
    setSuccess("");
    if (!form.empresaId) return setError("Selecione a empresa/filial.");
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

    if (!form.parceiroId) return setError("Selecione o parceiro (PN) para continuar.");
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

    if (!parceiroId && !parceiroSap?.nome) return setError("Selecione o parceiro (PN) para continuar.");

    const comissionadoSelecionadoBase = parceiros.find((item) => String(item.id) === form.comissionadoId);
    let comissionadoSelecionado = comissionadoSelecionadoBase;
    let comissionadoId = toOptionalInt(form.comissionadoId);
    let comissionadoSap:
      | {
          sapExternalId: string | null;
          codigo: string | null;
          nome: string;
          documento: string | null;
        }
      | undefined;

    if (comissionadoSelecionado?.sapOnly) {
      const ensured = await ensureSapParceiroCache(comissionadoSelecionado);
      comissionadoSelecionado = ensured;
      comissionadoSap = {
        sapExternalId: ensured.sapExternalId ?? comissionadoSelecionado.sapExternalId ?? null,
        codigo: ensured.codigo ?? comissionadoSelecionado.codigo ?? null,
        nome: ensured.nome || comissionadoSelecionado.nome,
        documento: ensured.documento ?? comissionadoSelecionado.documento ?? null,
      };
      comissionadoId = undefined;
      setParceiros((prev) => upsertParceiroOption(prev, ensured));
      setForm((prev) => ({ ...prev, comissionadoId: String(ensured.id) }));
    }

    if (!comissionadoSap?.nome && comissionadoSelecionado?.nome) {
      comissionadoSap = {
        sapExternalId: comissionadoSelecionado.sapExternalId ?? comissionadoSelecionado.codigo ?? null,
        codigo: comissionadoSelecionado.codigo ?? null,
        nome: comissionadoSelecionado.nome,
        documento: comissionadoSelecionado.documento ?? null,
      };
    }

    async function ensureDadosGeraisPn(field: keyof DadosGeraisForm) {
      const selectedId = asText(dadosGerais[field]);
      if (!selectedId) return "";
      const parceiroSelecionadoField = parceiros.find((item) => String(item.id) === selectedId);
      if (!parceiroSelecionadoField?.sapOnly) return selectedId;
      const ensured = await ensureSapParceiroCache(parceiroSelecionadoField);
      setParceiros((prev) => upsertParceiroOption(prev, ensured));
      return String(ensured.id);
    }

    const compradorId = await ensureDadosGeraisPn("compradorId");
    const faturadorId = await ensureDadosGeraisPn("faturadorId");
    const frigorificoId = await ensureDadosGeraisPn("frigorificoId");
    const anuenteId = await ensureDadosGeraisPn("anuenteId");
    const originadorId = await ensureDadosGeraisPn("originador");
    const compradorPn = parsePnOptionParts(optionLabel(parceiroCatalogOptions, compradorId));
    const faturadorPn = parsePnOptionParts(optionLabel(parceiroCatalogOptions, faturadorId));
    const frigorificoPn = parsePnOptionParts(optionLabel(parceiroCatalogOptions, frigorificoId));
    const anuentePn = parsePnOptionParts(optionLabel(parceiroCatalogOptions, anuenteId));
    const dadosGeraisPayload = toDadosGeraisPayload(
      {
        ...dadosGerais,
        compradorId,
        faturadorId,
        frigorificoId,
        anuenteId,
        originador: originadorId,
      },
      {
        lotes: lotesPecuaria,
        gtaContratos: gtaPecuaria,
        abates: abatesPecuaria,
        pnSnapshots: {
          comprador: compradorPn,
          faturador: faturadorPn,
          frigorifico: frigorificoPn,
          anuente: anuentePn,
        },
      },
    );

    if (!isEditMode && !toOptionalInt(form.numero)) return setError("Informe o número do contrato.");
    if (!form.referenciaContrato.trim()) return setError("Referência do contrato é obrigatória.");
    const currentContratoId = isEditMode && editingContratoId ? editingContratoId : savedContratoId;
    const method = currentContratoId ? "PATCH" : "POST";
    const endpoint = currentContratoId
      ? `/api/contratos/saida-animais/${currentContratoId}`
      : "/api/contratos/saida-animais";

    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          contratoCedenteId: toOptionalInt(form.contratoCedenteId),
          contratoAnteriorId: toOptionalInt(form.contratoAnteriorId),
          valor: toOptionalNumber(form.valor),
          valorMaoObra: toOptionalNumber(form.valorMaoObra),
          responsavelFrete: form.responsavelFrete,
          calculoFrete: form.calculoFrete,
          valorUnitarioFrete: toOptionalNumber(form.valorUnitarioFrete),
          emissorNotaId: toOptionalInt(form.emissorNotaId),
          assinaturaParceiro: toOptionalString(form.assinaturaParceiro),
          assinaturaEmpresa: toOptionalString(form.assinaturaEmpresa),
          comissionadoId,
          comissionadoSap,
          valorComissao: toOptionalNumber(form.valorComissao),
          responsavelJuridicoNome: toOptionalString(form.responsavelJuridicoNome),
          testemunha1Nome: toOptionalString(form.testemunha1Nome),
          testemunha1Cpf: toOptionalString(form.testemunha1Cpf),
          testemunha2Nome: toOptionalString(form.testemunha2Nome),
          testemunha2Cpf: toOptionalString(form.testemunha2Cpf),
          objeto: toOptionalString(form.objeto),
          execucao: toOptionalString(form.execucao),
          observacoes: toOptionalString(outros.observacao),
          outros: toOutrosPayload(outros),
          dadosGerais: dadosGeraisPayload,
          custosResumo: toCustosResumoPayload(custosResumo),
          custosCategorias: custos,
          itens,
          fretes,
          financeiros,
          notas,
          clausulas,
          clausulaModeloId: toOptionalInt(clausulaCodigo),
          clausulaTitulo: toOptionalString(clausulaTitulo),
          mapas,
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
        setSuccess(method === "POST" ? `Contrato #${contratoId} salvo com sucesso.` : `Contrato #${contratoId} atualizado com sucesso.`);
        router.replace(`/contratos/saida-animais/novo?id=${contratoId}`);
        if (options?.gerarPdf) {
          window.open(`/api/contratos/saida-animais/${contratoId}/pdf`, "_blank", "noopener,noreferrer");
          return;
        }
        return;
      }
      router.push("/contratos/saida-animais");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(nextStatus: ContratoStatus, options?: { gerarPedido?: boolean }) {
    const contratoId = savedContratoId ?? editingContratoId ?? null;
    if (!contratoId || Number.isNaN(contratoId)) {
      setError("Salve o contrato antes de atualizar o status.");
      return;
    }

    setError("");
    setSuccess("");
    setStatusUpdating(true);
    try {
      const shouldGenerate = options?.gerarPedido === true;
      const response = await fetch(`/api/contratos/saida-animais/${contratoId}/status`, {
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
          title={isEditMode ? "Editar Contrato de Saída de Animais" : "Novo Contrato de Saída de Animais"}
          subtitle="Use as abas para preencher dados básicos, itens, frete, financeiro e validações do contrato."
          backHref="/contratos/saida-animais"
        />
        <ModuleHeader />
        <section className="card p-3">
          <div className="legacy-toolbar">
            <div className="legacy-toolbar-left">
              <h1 className="legacy-title">
                Contrato de Saída de Animais / {isEditMode ? `(ID ${editingContratoId})` : "(Novo)"}
              </h1>
              <div className="legacy-actions">
                <button type="button" className="legacy-btn primary" onClick={() => handleSaveContract()} disabled={saving || loadingOptions || loadingContrato}>{saving ? "Salvando..." : "Salvar"}</button>
                <Link href="/contratos/saida-animais" className="legacy-btn">Descartar</Link>
                <button type="button" className="legacy-btn" disabled>Ação</button>
                <button
                  type="button"
                  className="legacy-btn"
                  onClick={() => {
                    if (savedContratoId) {
                      window.open(`/api/contratos/saida-animais/${savedContratoId}/pdf`, "_blank", "noopener,noreferrer");
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
              disabled={saving || statusUpdating || loadingContrato}
            >
              {statusUpdating ? "Atualizando..." : "Aprovar/Gerar Pedido"}
            </button>
          </div>
          {loadingContrato && <p className="legacy-message">Carregando contrato...</p>}
          {origemVisita && (
            <p className="legacy-message">
              Contrato gerado a partir da visita{origemVisitaId ? ` #${origemVisitaId}` : ""}. Complete os dados do contrato antes de aprovar/gerar pedido.
            </p>
          )}
          {success && <p className="legacy-message success">{success}</p>}
          {error && <p className="legacy-message error">{error}</p>}

          <div className="legacy-form mt-2">
            <div className="legacy-grid cols-4">
              <CatalogAutocompleteField
                label="Empresa"
                options={empresaCatalogOptions}
                value={form.empresaId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, empresaId: value }))}
                onSearchTextChange={setEmpresaSearch}
                listId="empresa-saida-animais"
                className="col-span-2"
                disabled={isEditMode}
                loading={loadingEmpresas}
              />
              <label className="legacy-field"><span>Tipo de Contrato</span><input className="legacy-input" value="Saída de Animais" disabled /></label>
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
                <label className="legacy-field"><span>Assinatura</span><input type="date" className="legacy-input" value={form.assinaturaEm} onChange={(event) => setForm((prev) => ({ ...prev, assinaturaEm: event.target.value }))} /></label>
                <label className="legacy-field"><span>Prazo de Entrega</span><input type="date" className="legacy-input" value={form.prazoEntregaEm} onChange={(event) => setForm((prev) => ({ ...prev, prazoEntregaEm: event.target.value }))} /></label>
                <label className="legacy-field"><span>Início</span><input type="date" className="legacy-input" value={form.inicioEm} onChange={(event) => setForm((prev) => ({ ...prev, inicioEm: event.target.value }))} /></label>
                <label className="legacy-field"><span>Vencimento</span><input type="date" className="legacy-input" value={form.vencimentoEm} onChange={(event) => setForm((prev) => ({ ...prev, vencimentoEm: event.target.value }))} /></label>

                <label className="legacy-field"><span>Contrato cedente</span><input className="legacy-input" value={form.contratoCedenteId} onChange={(event) => setForm((prev) => ({ ...prev, contratoCedenteId: onlyNumber(event.target.value) }))} /></label>
                <label className="legacy-field"><span>Contrato Anterior</span><input className="legacy-input" value={form.contratoAnteriorId} onChange={(event) => setForm((prev) => ({ ...prev, contratoAnteriorId: onlyNumber(event.target.value) }))} /></label>
                <label className="legacy-field"><span>Valor</span><input className="legacy-input" value={form.valor} onChange={(event) => setForm((prev) => ({ ...prev, valor: formatCurrencyBr(event.target.value) }))} /></label>
                <label className="legacy-field"><span>Mão de Obra</span><input className="legacy-input" value={form.valorMaoObra} onChange={(event) => setForm((prev) => ({ ...prev, valorMaoObra: formatCurrencyBr(event.target.value) }))} /></label>

                <label className="legacy-field"><span>Responsável Frete</span><select className="legacy-select" value={form.responsavelFrete} onChange={(event) => setForm((prev) => ({ ...prev, responsavelFrete: event.target.value as BasicForm["responsavelFrete"] }))}><option value="empresa">Empresa</option><option value="parceiro">Parceiro</option><option value="terceiro">Terceiro</option></select></label>
                <label className="legacy-field"><span>Cálculo de Frete</span><select className="legacy-select" value={form.calculoFrete} onChange={(event) => setForm((prev) => ({ ...prev, calculoFrete: event.target.value as BasicForm["calculoFrete"] }))}><option value="km_rodado">KM rodado</option><option value="peso">Peso</option></select></label>
                <label className="legacy-field"><span>Valor Unitário Frete</span><input className="legacy-input" value={form.valorUnitarioFrete} onChange={(event) => setForm((prev) => ({ ...prev, valorUnitarioFrete: formatCurrencyBr(event.target.value) }))} /></label>
                <PickerTriggerField
                  label="Emissor Nota (PN)"
                  valueLabel={optionLabel(parceiroCatalogOptions, form.emissorNotaId)}
                  onOpen={() => openPnPicker("emissor")}
                  loading={loadingParceiros}
                />

                <label className="legacy-field"><span>Assinatura Parceiro</span><input className="legacy-input" value={form.assinaturaParceiro} onChange={(event) => setForm((prev) => ({ ...prev, assinaturaParceiro: event.target.value }))} /></label>
                <label className="legacy-field"><span>Assinatura Empresa</span><input className="legacy-input" value={form.assinaturaEmpresa} onChange={(event) => setForm((prev) => ({ ...prev, assinaturaEmpresa: event.target.value }))} /></label>
                <PickerTriggerField
                  label="Comissionado (PN)"
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
            {activeTab === "previsoes" && (
              <TabTable
                onAdd={() => openModal("mapa")}
                rows={mapas}
                onRemove={(index) => setMapas((prev) => prev.filter((_, i) => i !== index))}
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
            {activeTab === "pecuaria_saida" && (
              <PecuariaSaidaTab
                dadosGerais={dadosGerais}
                parceiroOptions={parceiroCatalogOptions}
                loadingParceiros={loadingParceiros}
                lotes={lotesPecuaria}
                gtaRows={gtaPecuaria}
                abates={abatesPecuaria}
                onChangeDadosGerais={setDadosGerais}
                onOpenPnPicker={openPnPicker}
                onAddLote={() => openModal("lote")}
                onRemoveLote={(index) => setLotesPecuaria((prev) => prev.filter((_, i) => i !== index))}
                onAddGta={() => openModal("gta")}
                onRemoveGta={(index) => setGtaPecuaria((prev) => prev.filter((_, i) => i !== index))}
                onAddAbate={() => openModal("abate")}
                onRemoveAbate={(index) => setAbatesPecuaria((prev) => prev.filter((_, i) => i !== index))}
              />
            )}
            {activeTab === "outros" && (
              <div className="legacy-grid cols-6 mt-2">
                <label className="legacy-field">
                  <span>Data Embarque</span>
                  <input
                    type="date"
                    className="legacy-input"
                    value={outros.dataEmbarque}
                    onChange={(event) => setOutros((prev) => ({ ...prev, dataEmbarque: event.target.value }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Data Prevista Chegada</span>
                  <input
                    type="date"
                    className="legacy-input"
                    value={outros.dataPrevistaChegada}
                    onChange={(event) => setOutros((prev) => ({ ...prev, dataPrevistaChegada: event.target.value }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Frete Confinamento</span>
                  <select
                    className="legacy-select"
                    value={outros.freteConfinamento}
                    onChange={(event) => setOutros((prev) => ({ ...prev, freteConfinamento: event.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    <option value="CIF">CIF</option>
                    <option value="FOB">FOB</option>
                  </select>
                </label>
                <label className="legacy-field">
                  <span>Fazenda Destino</span>
                  <input
                    className="legacy-input"
                    value={outros.fazendaDestino}
                    onChange={(event) => setOutros((prev) => ({ ...prev, fazendaDestino: event.target.value }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Fazenda Origem</span>
                  <input
                    className="legacy-input"
                    value={outros.fazendaOrigem}
                    onChange={(event) => setOutros((prev) => ({ ...prev, fazendaOrigem: event.target.value }))}
                  />
                </label>
                <label className="legacy-check">
                  <input
                    type="checkbox"
                    checked={outros.descontoAcerto}
                    onChange={(event) => setOutros((prev) => ({ ...prev, descontoAcerto: event.target.checked }))}
                  />
                  Desconto no Acerto
                </label>
                <label className="legacy-field">
                  <span>Descrição Desconto</span>
                  <input
                    className="legacy-input"
                    value={outros.descricaoDesconto}
                    onChange={(event) => setOutros((prev) => ({ ...prev, descricaoDesconto: event.target.value }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Peso Referência</span>
                  <select
                    className="legacy-select"
                    value={outros.pesoReferencia}
                    onChange={(event) => setOutros((prev) => ({ ...prev, pesoReferencia: event.target.value }))}
                  >
                    <option value="Fazenda Origem">Fazenda Origem</option>
                    <option value="Fazenda Destino">Fazenda Destino</option>
                    <option value="Curral">Curral</option>
                  </select>
                </label>
                <label className="legacy-field col-span-4">
                  <span>Observação</span>
                  <textarea
                    className="legacy-textarea"
                    value={outros.observacao}
                    onChange={(event) => setOutros((prev) => ({ ...prev, observacao: event.target.value }))}
                  />
                </label>
              </div>
            )}
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
          title={`Adicionar ${
            modalType === "item"
              ? "Item"
              : modalType === "frete"
                ? "Frete"
                : modalType === "financeiro"
                  ? "Financeiro"
                  : modalType === "nota"
                    ? "Nota"
                    : modalType === "custo"
                      ? "Custo"
                      : modalType === "clausula"
                        ? "Cláusula"
                        : modalType === "lote"
                          ? "Lote"
                          : modalType === "gta"
                            ? "GTA"
                            : modalType === "abate"
                              ? "Abate"
                              : "Mapa"
          }`}
          onClose={() => {
            setModalType(null);
            setEditingClausulaIndex(null);
          }}
        >
          {modalType === "item" ? (
            <>
              <div className="legacy-grid cols-4">
                <CatalogAutocompleteField
                  label="Item"
                  className="col-span-2"
                  options={itemCatalog.itens}
                  value={itemDraft.itemId}
                  listId="item-id"
                  loading={loadingItensSap}
                  onSearchTextChange={setItemSearch}
                  onValueChange={(value) => setItemDraft((prev) => ({ ...prev, itemId: value }))}
                />
                <CatalogAutocompleteField
                  label="Und Medida"
                  className="col-span-2"
                  options={itemCatalog.unidades}
                  value={itemDraft.undMedidaId}
                  listId="und-medida-id"
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
                  listId="condicao-pagamento-id"
                  onValueChange={(value) => setItemDraft((prev) => ({ ...prev, condicaoPagamentoId: value }))}
                />
                <CatalogAutocompleteField
                  label="Depósito"
                  className="col-span-2"
                  options={itemCatalog.depositos}
                  value={itemDraft.depositoId}
                  listId="deposito-id"
                  onValueChange={(value) => setItemDraft((prev) => ({ ...prev, depositoId: value }))}
                />
                <CatalogAutocompleteField
                  label="Centro de Custo"
                  className="col-span-2"
                  options={itemCatalog.centrosCusto}
                  value={itemDraft.centroCustoId}
                  listId="centro-custo-id"
                  onValueChange={(value) => setItemDraft((prev) => ({ ...prev, centroCustoId: value }))}
                />
                <CatalogAutocompleteField
                  label="Utilização"
                  className="col-span-2"
                  options={itemCatalog.utilizacoes}
                  value={itemDraft.utilizacaoId}
                  listId="utilizacao-id"
                  onValueChange={(value) => setItemDraft((prev) => ({ ...prev, utilizacaoId: value }))}
                />
                <CatalogAutocompleteField
                  label="Moeda"
                  className="col-span-2"
                  options={itemCatalog.moedas}
                  value={itemDraft.moedaId}
                  listId="moeda-id"
                  onValueChange={(value) => setItemDraft((prev) => ({ ...prev, moedaId: value }))}
                />
              </div>
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => setModalType(null)}>Descartar</button></div>
            </>
          ) : modalType === "frete" ? (
            <>
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
                  listId="frete-equipamento-id"
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, equipamentoId: value }))}
                />
              </div>
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => setModalType(null)}>Descartar</button></div>
            </>
          ) : modalType === "financeiro" ? (
            <>
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
                    list="financeiro-condicao-pagamento-list"
                    placeholder="Digite para buscar..."
                    value={draft.condicaoPagamento ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, condicaoPagamento: event.target.value }))}
                  />
                  <datalist id="financeiro-condicao-pagamento-list">
                    {itemCatalog.condicoesPagamento.map((option) => (
                      <option key={`cond-${option.value}`} value={formatCatalogDisplayLabel(option)} />
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
                      <option key={`forma-${option.value}`} value={formatCatalogDisplayLabel(option)}>
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
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => setModalType(null)}>Descartar</button></div>
            </>
          ) : modalType === "custo" ? (
            <>
              <div className="legacy-grid cols-4">
                <label className="legacy-field">
                  <span>Categoria</span>
                  <select
                    className="legacy-select"
                    value={draft.categoria ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, categoria: event.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {CATEGORIA_OPTIONS.map((option) => (
                      <option key={`cust-cat-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                    {draft.categoria && !CATEGORIA_OPTIONS.includes(draft.categoria) && (
                      <option value={draft.categoria}>{draft.categoria}</option>
                    )}
                  </select>
                </label>
                <label className="legacy-field">
                  <span>Qualidade</span>
                  <select
                    className="legacy-select"
                    value={draft.qualidade ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, qualidade: event.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {QUALIDADE_OPTIONS.map((option) => (
                      <option key={`cust-qual-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                    {draft.qualidade && !QUALIDADE_OPTIONS.includes(draft.qualidade) && (
                      <option value={draft.qualidade}>{draft.qualidade}</option>
                    )}
                  </select>
                </label>
                <label className="legacy-field">
                  <span>Raça</span>
                  <select
                    className="legacy-select"
                    value={draft.raca ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, raca: event.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {RACA_PREDOMINANTE_OPTIONS.map((option) => (
                      <option key={`cust-raca-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                    {draft.raca && !RACA_PREDOMINANTE_OPTIONS.includes(draft.raca) && (
                      <option value={draft.raca}>{draft.raca}</option>
                    )}
                  </select>
                </label>
                <label className="legacy-field">
                  <span>Quantidade</span>
                  <input
                    className="legacy-input"
                    value={draft.quantidade ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, quantidade: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Rendimento Carcaça (%)</span>
                  <input
                    className="legacy-input"
                    value={draft.rendimentoCarcaca ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, rendimentoCarcaca: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Peso Médio</span>
                  <input
                    className="legacy-input"
                    value={draft.pesoMedio ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, pesoMedio: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Valor Tabela</span>
                  <input
                    className="legacy-input"
                    value={draft.valorTabela ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, valorTabela: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Valor Negociado</span>
                  <input
                    className="legacy-input"
                    value={draft.valorNegociado ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, valorNegociado: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Valor Frete</span>
                  <input
                    className="legacy-input"
                    value={draft.valorFrete ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, valorFrete: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Valor ICMS R$/@</span>
                  <input
                    className="legacy-input"
                    value={draft.valorIcmsArroba ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, valorIcmsArroba: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Cabeças</span>
                  <input
                    className="legacy-input"
                    value={draft.cabecas ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, cabecas: onlyNumber(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field col-span-2">
                  <span>Condição Pagto</span>
                  <input
                    className="legacy-input"
                    list="custo-condicao-pagamento-list"
                    placeholder="Digite para buscar..."
                    value={draft.condicaoPagamento ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, condicaoPagamento: event.target.value }))}
                  />
                  <datalist id="custo-condicao-pagamento-list">
                    {itemCatalog.condicoesPagamento.map((option) => (
                      <option key={`custo-cond-${option.value}`} value={option.label} />
                    ))}
                  </datalist>
                </label>
                <label className="legacy-field">
                  <span>Valor Total</span>
                  <input
                    className="legacy-input"
                    value={draft.valorTotal ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, valorTotal: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Contraoferta</span>
                  <input
                    className="legacy-input"
                    value={draft.contraoferta ?? "0,00"}
                    onChange={(event) => setDraft((prev) => ({ ...prev, contraoferta: formatCurrencyBr(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Track count</span>
                  <input
                    className="legacy-input"
                    value={draft.trackCount ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, trackCount: onlyNumber(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field col-span-3">
                  <span>Observação</span>
                  <textarea
                    className="legacy-textarea"
                    value={draft.observacao ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, observacao: event.target.value }))}
                  />
                </label>
              </div>
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => setModalType(null)}>Descartar</button></div>
            </>
          ) : modalType === "lote" ? (
            <>
              <div className="legacy-grid cols-4">
                <label className="legacy-field col-span-2">
                  <span>Lote</span>
                  <input className="legacy-input" value={draft.lote ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, lote: event.target.value }))} />
                </label>
                <label className="legacy-field col-span-2">
                  <span>Curral</span>
                  <input className="legacy-input" value={draft.curral ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, curral: event.target.value }))} />
                </label>
                <label className="legacy-field">
                  <span>Categoria</span>
                  <input className="legacy-input" value={draft.categoria ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, categoria: event.target.value }))} />
                </label>
                <label className="legacy-field">
                  <span>Quantidade Total</span>
                  <input className="legacy-input" value={draft.quantidadeTotal ?? "0"} onChange={(event) => setDraft((prev) => ({ ...prev, quantidadeTotal: onlyNumber(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Quantidade Selecionada</span>
                  <input className="legacy-input" value={draft.quantidadeSelecionada ?? "0"} onChange={(event) => setDraft((prev) => ({ ...prev, quantidadeSelecionada: onlyNumber(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Arrobas Produzidas</span>
                  <input className="legacy-input" value={draft.arrobasProduzidas ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, arrobasProduzidas: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Peso Médio Bruto</span>
                  <input className="legacy-input" value={draft.pesoMedioBruto ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, pesoMedioBruto: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Peso Médio Bruto 2</span>
                  <input className="legacy-input" value={draft.pesoMedioBruto2 ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, pesoMedioBruto2: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Peso Médio Bruto 3</span>
                  <input className="legacy-input" value={draft.pesoMedioBruto3 ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, pesoMedioBruto3: formatCurrencyBr(event.target.value) }))} />
                </label>
              </div>
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => setModalType(null)}>Descartar</button></div>
            </>
          ) : modalType === "gta" ? (
            <>
              <div className="legacy-grid cols-4">
                <label className="legacy-field col-span-2">
                  <span>GTA</span>
                  <input className="legacy-input" value={draft.gta ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, gta: event.target.value }))} />
                </label>
                <label className="legacy-field">
                  <span>Peso</span>
                  <input className="legacy-input" value={draft.peso ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, peso: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Qtd</span>
                  <input className="legacy-input" value={draft.qtd ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, qtd: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Qtd Macho</span>
                  <input className="legacy-input" value={draft.qtdMacho ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, qtdMacho: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Qtd Fêmea</span>
                  <input className="legacy-input" value={draft.qtdFemea ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, qtdFemea: formatCurrencyBr(event.target.value) }))} />
                </label>
              </div>
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => setModalType(null)}>Descartar</button></div>
            </>
          ) : modalType === "abate" ? (
            <>
              <div className="legacy-grid cols-6">
                <label className="legacy-field">
                  <span>Tipo</span>
                  <select className="legacy-select" value={draft.tipo ?? "Romaneio Geral"} onChange={(event) => setDraft((prev) => ({ ...prev, tipo: event.target.value }))}>
                    <option value="Romaneio Geral">Romaneio Geral</option>
                    <option value="Romaneio por Animal">Romaneio por Animal</option>
                  </select>
                </label>
                <label className="legacy-field">
                  <span>Data</span>
                  <input type="date" className="legacy-input" value={draft.data ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, data: event.target.value }))} />
                </label>
                <label className="legacy-field">
                  <span>Hora Entrada</span>
                  <input type="time" className="legacy-input" value={draft.horaEntrada ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, horaEntrada: event.target.value }))} />
                </label>
                <label className="legacy-field">
                  <span>Hora Saída</span>
                  <input type="time" className="legacy-input" value={draft.horaSaida ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, horaSaida: event.target.value }))} />
                </label>
                <label className="legacy-field">
                  <span>Valor @</span>
                  <input className="legacy-input" value={draft.valorArroba ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, valorArroba: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Valor Frete @</span>
                  <input className="legacy-input" value={draft.valorFreteArroba ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, valorFreteArroba: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Cabeças</span>
                  <input className="legacy-input" value={draft.cabecas ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, cabecas: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Peso Vivo Total KG</span>
                  <input className="legacy-input" value={draft.pesoVivoTotalKg ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, pesoVivoTotalKg: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Peso Carcaça @</span>
                  <input className="legacy-input" value={draft.pesoCarcacaArroba ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, pesoCarcacaArroba: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>Peso Médio Carcaça KG</span>
                  <input className="legacy-input" value={draft.pesoMedioCarcacaKg ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, pesoMedioCarcacaKg: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>RC Fixo %</span>
                  <input className="legacy-input" value={draft.rcFixoPercentual ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, rcFixoPercentual: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field">
                  <span>RC Real %</span>
                  <input className="legacy-input" value={draft.rcRealPercentual ?? "0,00"} onChange={(event) => setDraft((prev) => ({ ...prev, rcRealPercentual: formatCurrencyBr(event.target.value) }))} />
                </label>
                <label className="legacy-field col-span-6">
                  <span>Observação</span>
                  <textarea className="legacy-textarea" value={draft.observacao ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, observacao: event.target.value }))} />
                </label>
              </div>
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => setModalType(null)}>Descartar</button></div>
            </>
          ) : modalType === "clausula" ? (
            <>
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
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => { setModalType(null); setEditingClausulaIndex(null); }}>Descartar</button></div>
            </>
          ) : (
            <>
              <div className="legacy-grid cols-4">
                {Object.keys(draft).map((field) => (
                  <label key={field} className={`legacy-field ${field === "observacao" || field === "descricao" ? "col-span-2" : ""}`}>
                    <span>{field}</span>
                    {field.toLowerCase().includes("data") ? (
                      <input type="date" className="legacy-input" value={draft[field] ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, [field]: event.target.value }))} />
                    ) : field === "observacao" ? (
                      <textarea className="legacy-textarea" value={draft[field] ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, [field]: event.target.value }))} />
                    ) : (
                      <input className="legacy-input" value={draft[field] ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, [field]: event.target.value }))} />
                    )}
                  </label>
                ))}
              </div>
              <div className="legacy-actions mt-3 justify-end"><button type="button" className="legacy-btn primary" onClick={saveModal}>Salvar</button><button type="button" className="legacy-btn" onClick={() => setModalType(null)}>Descartar</button></div>
            </>
          )}
        </LegacyModal>
      )}
    </div>
  );
}

function ItensTab({
  rows,
  selecionados,
  onAdd,
  onToggle,
  onToggleTodos,
}: {
  rows: ItemRow[];
  selecionados: number[];
  onAdd: () => void;
  onToggle: (index: number) => void;
  onToggleTodos: (checked: boolean) => void;
}) {
  const todosSelecionados = rows.length > 0 && selecionados.length === rows.length;

  return (
    <section className="mt-2">
      <p className="itens-title">Itens</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={onAdd}>Adicionar</button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table custos-table">
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
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="itens-empty">&nbsp;</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
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

function PecuariaSaidaTab({
  dadosGerais,
  parceiroOptions,
  loadingParceiros,
  lotes,
  gtaRows,
  abates,
  onChangeDadosGerais,
  onOpenPnPicker,
  onAddLote,
  onRemoveLote,
  onAddGta,
  onRemoveGta,
  onAddAbate,
  onRemoveAbate,
}: {
  dadosGerais: DadosGeraisForm;
  parceiroOptions: CatalogOption[];
  loadingParceiros: boolean;
  lotes: Record<string, string>[];
  gtaRows: Record<string, string>[];
  abates: Record<string, string>[];
  onChangeDadosGerais: (updater: SetStateAction<DadosGeraisForm>) => void;
  onOpenPnPicker: (target: PnPickerTarget) => void;
  onAddLote: () => void;
  onRemoveLote: (index: number) => void;
  onAddGta: () => void;
  onRemoveGta: (index: number) => void;
  onAddAbate: () => void;
  onRemoveAbate: (index: number) => void;
}) {
  return (
    <section className="mt-2">
      <div className="legacy-grid cols-4">
        <PickerTriggerField
          label="Comprador"
          valueLabel={optionLabel(parceiroOptions, dadosGerais.compradorId)}
          onOpen={() => onOpenPnPicker("comprador")}
          loading={loadingParceiros}
        />
        <PickerTriggerField
          label="Faturador"
          valueLabel={optionLabel(parceiroOptions, dadosGerais.faturadorId)}
          onOpen={() => onOpenPnPicker("faturador")}
          loading={loadingParceiros}
        />
        <PickerTriggerField
          label="Frigorífico Abate"
          valueLabel={optionLabel(parceiroOptions, dadosGerais.frigorificoId)}
          onOpen={() => onOpenPnPicker("frigorifico")}
          loading={loadingParceiros}
        />
        <PickerTriggerField
          label="Anuente"
          valueLabel={optionLabel(parceiroOptions, dadosGerais.anuenteId)}
          onOpen={() => onOpenPnPicker("anuente")}
          loading={loadingParceiros}
        />

        <label className="legacy-field">
          <span>Sexo</span>
          <select
            className="legacy-select"
            value={dadosGerais.sexo}
            onChange={(event) => onChangeDadosGerais((prev) => ({ ...prev, sexo: event.target.value }))}
          >
            <option value="">Selecione...</option>
            <option value="Macho">Macho</option>
            <option value="Fêmea">Fêmea</option>
            <option value="Misto">Misto</option>
          </select>
        </label>
        <label className="legacy-field">
          <span>Valor Arroba (R$/@)</span>
          <input
            className="legacy-input"
            value={dadosGerais.valorArroba}
            onChange={(event) => onChangeDadosGerais((prev) => ({ ...prev, valorArroba: formatCurrencyBr(event.target.value) }))}
          />
        </label>
        <label className="legacy-field">
          <span>RC Fixo(%)</span>
          <input
            className="legacy-input"
            value={dadosGerais.rcFixo}
            onChange={(event) => onChangeDadosGerais((prev) => ({ ...prev, rcFixo: formatCurrencyBr(event.target.value) }))}
          />
        </label>
        <label className="legacy-field">
          <span>Data Embarque</span>
          <input
            type="date"
            className="legacy-input"
            value={dadosGerais.dataEmbarque}
            onChange={(event) => onChangeDadosGerais((prev) => ({ ...prev, dataEmbarque: event.target.value }))}
          />
        </label>
        <label className="legacy-field">
          <span>Data Pesagem</span>
          <input
            type="date"
            className="legacy-input"
            value={dadosGerais.dataPesagem}
            onChange={(event) => onChangeDadosGerais((prev) => ({ ...prev, dataPesagem: event.target.value }))}
          />
        </label>
        <label className="legacy-field">
          <span>Data Abate</span>
          <input
            type="date"
            className="legacy-input"
            value={dadosGerais.dataAbate}
            onChange={(event) => onChangeDadosGerais((prev) => ({ ...prev, dataAbate: event.target.value }))}
          />
        </label>
        <label className="legacy-field">
          <span>Quantidade Negociada</span>
          <input
            className="legacy-input"
            value={dadosGerais.quantidadeNegociada}
            onChange={(event) => onChangeDadosGerais((prev) => ({ ...prev, quantidadeNegociada: onlyDecimal(event.target.value) }))}
          />
        </label>
        <label className="legacy-field">
          <span>Tipo Saída</span>
          <select
            className="legacy-select"
            value={dadosGerais.tipoSaida}
            onChange={(event) => onChangeDadosGerais((prev) => ({ ...prev, tipoSaida: event.target.value }))}
          >
            <option value="Açougue">Açougue</option>
            <option value="Exportação">Exportação</option>
            <option value="Mercado Interno">Mercado Interno</option>
          </select>
        </label>
      </div>

      <p className="itens-title mt-3">Contrato lote</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={onAddLote}>Adicionar</button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Curral</th>
              <th>Categoria</th>
              <th>Quantidade Total</th>
              <th>Quantidade Selecionada</th>
              <th>Peso Médio Bruto</th>
              <th>Peso Médio Bruto</th>
              <th>Peso Médio Bruto</th>
              <th>Arrobas Produzidas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lotes.length === 0 && (
              <tr>
                <td colSpan={10} className="itens-empty">&nbsp;</td>
              </tr>
            )}
            {lotes.map((row, index) => (
              <tr key={`${row.lote ?? "lote"}-${index}`}>
                <td className="left">{row.lote || "-"}</td>
                <td className="left">{row.curral || "-"}</td>
                <td className="left">{row.categoria || "-"}</td>
                <td>{row.quantidadeTotal || "0"}</td>
                <td>{row.quantidadeSelecionada || "0"}</td>
                <td>{row.pesoMedioBruto || "0,00"}</td>
                <td>{row.pesoMedioBruto2 || "0,00"}</td>
                <td>{row.pesoMedioBruto3 || "0,00"}</td>
                <td>{row.arrobasProduzidas || "0,00"}</td>
                <td>
                  <button type="button" className="legacy-btn" onClick={() => onRemoveLote(index)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="itens-title mt-3">Contrato GTA</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={onAddGta}>Adicionar</button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <thead>
            <tr>
              <th>GTA</th>
              <th>Peso</th>
              <th>Qtd</th>
              <th>Qtd Macho</th>
              <th>Qtd Fêmea</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {gtaRows.length === 0 && (
              <tr>
                <td colSpan={6} className="itens-empty">&nbsp;</td>
              </tr>
            )}
            {gtaRows.map((row, index) => (
              <tr key={`${row.gta ?? "gta"}-${index}`}>
                <td className="left">{row.gta || "-"}</td>
                <td>{row.peso || "0,00"}</td>
                <td>{row.qtd || "0,00"}</td>
                <td>{row.qtdMacho || "0,00"}</td>
                <td>{row.qtdFemea || "0,00"}</td>
                <td>
                  <button type="button" className="legacy-btn" onClick={() => onRemoveGta(index)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="itens-title mt-3">Abates</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={onAddAbate}>Adicionar</button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Data</th>
              <th>Valor Abate</th>
              <th>Valor Frete @</th>
              <th>Cabeças</th>
              <th>Cabeças Exportação</th>
              <th>Peso Vivo Total KG</th>
              <th>Peso Médio Carcaça @</th>
              <th>RC Fixo %</th>
              <th>RC Real %</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {abates.length === 0 && (
              <tr>
                <td colSpan={11} className="itens-empty">&nbsp;</td>
              </tr>
            )}
            {abates.map((row, index) => (
              <tr key={`${row.tipo ?? "abate"}-${index}`}>
                <td>{row.status || "Aberto"}</td>
                <td>{row.data || "-"}</td>
                <td>{row.valorAbate || "0,00"}</td>
                <td>{row.valorFreteArroba || "0,00"}</td>
                <td>{row.cabecas || "0,00"}</td>
                <td>{row.cabecasExportacao || "0,00"}</td>
                <td>{row.pesoVivoTotalKg || "0,00"}</td>
                <td>{row.pesoMedioCarcacaArroba || "0,00"}</td>
                <td>{row.rcFixoPercentual || "0,00"}</td>
                <td>{row.rcRealPercentual || "0,00"}</td>
                <td>
                  <button type="button" className="legacy-btn" onClick={() => onRemoveAbate(index)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustosTab({
  resumo,
  onResumoChange,
  rows,
  onAdd,
  onRemove,
}: {
  resumo: CustosResumoForm;
  onResumoChange: (field: keyof CustosResumoForm, value: string) => void;
  rows: CustoCategoriaRow[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="mt-2">
      <div className="legacy-grid cols-6">
        <label className="legacy-field">
          <span>Valor Médio CEPEA</span>
          <input className="legacy-input" value={resumo.valorMedioCepea} onChange={(event) => onResumoChange("valorMedioCepea", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>% Parceria</span>
          <input className="legacy-input" value={resumo.percentualParceria} onChange={(event) => onResumoChange("percentualParceria", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>% Recria</span>
          <input className="legacy-input" value={resumo.percentualRecria} onChange={(event) => onResumoChange("percentualRecria", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Valor @</span>
          <input className="legacy-input" value={resumo.valorArroba} onChange={(event) => onResumoChange("valorArroba", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Valor Cabeça</span>
          <input className="legacy-input" value={resumo.valorCabeca} onChange={(event) => onResumoChange("valorCabeca", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Valor Frete (Cab)</span>
          <input className="legacy-input" value={resumo.valorFreteCab} onChange={(event) => onResumoChange("valorFreteCab", formatCurrencyBr(event.target.value))} />
        </label>

        <label className="legacy-field">
          <span>Valor ICMS R$/@</span>
          <input className="legacy-input" value={resumo.valorIcmsArroba} onChange={(event) => onResumoChange("valorIcmsArroba", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Valor ICMS Frete (Cab)</span>
          <input className="legacy-input" value={resumo.valorIcmsFreteCab} onChange={(event) => onResumoChange("valorIcmsFreteCab", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Valor Protocolo</span>
          <input className="legacy-input" value={resumo.valorProtocolo} onChange={(event) => onResumoChange("valorProtocolo", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Valor Brinco</span>
          <input className="legacy-input" value={resumo.valorBrinco} onChange={(event) => onResumoChange("valorBrinco", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Valor Total</span>
          <input className="legacy-input" value={resumo.valorTotal} onChange={(event) => onResumoChange("valorTotal", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Operacional Cab/Dia</span>
          <input className="legacy-input" value={resumo.operacionalCabDia} onChange={(event) => onResumoChange("operacionalCabDia", formatCurrencyBr(event.target.value))} />
        </label>

        <label className="legacy-field">
          <span>Operac Cab/Dia Vendido</span>
          <input className="legacy-input" value={resumo.operacionalCabDiaVendido} onChange={(event) => onResumoChange("operacionalCabDiaVendido", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Custo Tonelada MS</span>
          <input className="legacy-input" value={resumo.custoToneladaMs} onChange={(event) => onResumoChange("custoToneladaMs", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Custo Tonelada MS Vendido</span>
          <input className="legacy-input" value={resumo.custoToneladaMsVendido} onChange={(event) => onResumoChange("custoToneladaMsVendido", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Valor @ Produzida</span>
          <input className="legacy-input" value={resumo.valorArrobaProduzida} onChange={(event) => onResumoChange("valorArrobaProduzida", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Animais Previsto</span>
          <input className="legacy-input" value={resumo.animaisPrevisto} onChange={(event) => onResumoChange("animaisPrevisto", formatCurrencyBr(event.target.value))} />
        </label>
        <label className="legacy-field">
          <span>Desconto Venda R$/@</span>
          <input className="legacy-input" value={resumo.descontoVendaArroba} onChange={(event) => onResumoChange("descontoVendaArroba", formatCurrencyBr(event.target.value))} />
        </label>
      </div>

      <p className="itens-title mt-2">Contrato categoria</p>
      <div className="legacy-actions mt-2">
        <button type="button" className="legacy-btn itens-add-btn" onClick={onAdd}>Adicionar</button>
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <thead>
            <tr>
              <th style={{ width: "34px" }}>
                <input type="checkbox" disabled />
              </th>
              <th>Categoria</th>
              <th>Qualidade</th>
              <th>Raça</th>
              <th>Quantidade</th>
              <th>Rendimento Carcaça (%)</th>
              <th>Peso Médio</th>
              <th>Valor Tabela</th>
              <th>Valor Negociado</th>
              <th>Valor Total</th>
              <th>Valor Frete</th>
              <th>Valor ICMS R$/@</th>
              <th>Cabeças</th>
              <th>Condição Pagto</th>
              <th>Observação</th>
              <th>Contraoferta</th>
              <th>Track count</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={18} className="itens-empty">&nbsp;</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={`${row.categoria}-${row.raca}-${index}`}>
                <td>
                  <input type="checkbox" disabled />
                </td>
                <td className="left">{row.categoria || "-"}</td>
                <td className="left">{row.qualidade || "-"}</td>
                <td className="left">{row.raca || "-"}</td>
                <td>{row.quantidade || "0,00"}</td>
                <td>{row.rendimentoCarcaca || "0,00"}</td>
                <td>{row.pesoMedio || "0,00"}</td>
                <td>{row.valorTabela || "0,00"}</td>
                <td>{row.valorNegociado || "0,00"}</td>
                <td>{row.valorTotal || "0,00"}</td>
                <td>{row.valorFrete || "0,00"}</td>
                <td>{row.valorIcmsArroba || "0,00"}</td>
                <td>{row.cabecas || "-"}</td>
                <td className="left">{row.condicaoPagamento || "-"}</td>
                <td className="left">{row.observacao || "-"}</td>
                <td>{row.contraoferta || "0,00"}</td>
                <td>{row.trackCount || "-"}</td>
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
      </div>
      <div className="itens-table-wrap mt-2">
        <table className="itens-table">
          <thead>
            <tr>
              <th style={{ width: "36px" }}>
                <input type="checkbox" disabled />
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
              <tr key={`${row.codigo ?? "cl"}-${row.referencia ?? "ref"}-${index}`}>
                <td>
                  <input type="checkbox" disabled />
                </td>
                <td>{row.codigo || "-"}</td>
                <td className="left">{row.referencia || "-"}</td>
                <td className="left">{row.descricao || "-"}</td>
                <td>
                  <button type="button" className="legacy-btn mr-1" onClick={() => onEditar(index)}>Editar</button>
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
          <thead><tr>{headers.length === 0 ? <th>Registro</th> : headers.map((header) => <th key={header}>{formatTabHeaderLabel(header)}</th>)}<th>Ações</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={headers.length + 1} className="legacy-empty">Nenhum registro adicionado.</td></tr>}
            {rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.length === 0 ? <td>-</td> : headers.map((header) => <td key={header} className={header === "item" || header === "descricao" ? "left" : ""}>{row[header] || "-"}</td>)}<td><button type="button" className="legacy-btn" onClick={() => onRemove(rowIndex)}>Remover</button></td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatTabHeaderLabel(header: string): string {
  const labels: Record<string, string> = {
    numeroMapa: "Número Mapa",
    dataJejum: "Data Jejum",
    horaInicioJejum: "Hora Início Jejum",
    horaFimJejum: "Hora Fim Jejum",
    dataPesagem: "Data Pesagem",
    horaInicioPesagem: "Hora Início Pesagem",
    horaFimPesagem: "Hora Fim Pesagem",
    qualidade: "Qualidade",
    placa: "Placa",
    motorista: "Motorista",
    rendimentoCarcaca: "Rendimento Carcaça",
    pesoBrutoKg: "Peso Bruto (KG)",
    pesoTotalArroba: "Peso Total (@)",
    pesoMedioArroba: "Peso Médio (@)",
    quantidadeAnimais: "Quantidade Animais",
    pesoLiquidoArroba: "Peso Líquido (@)",
    valorArroba: "Valor (R$/@)",
    valorTotal: "Valor Total",
    valorComissao: "Valor Comissão",
    comprador: "Comprador",
    responsavel: "Responsável",
    telefoneResponsavel: "Telefone Responsável",
    cpfResponsavel: "CPF Responsável",
    observacao: "Observação",
    animaisJson: "Animais",
    dataInicio: "Data Início",
    quantidade: "Quantidade",
    pesoTotalKg: "Peso Total (KG)",
    descricao: "Descrição",
  };

  if (labels[header]) return labels[header];

  return header
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function Placeholder({ text }: { text: string }) {
  return <section className="mt-2 rounded-md border border-[#cdd1df] bg-white p-4"><p className="text-sm text-[#51597a]">{text}</p></section>;
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
  const selectedOption = findCatalogOptionByValue(options, value);
  const selectedLabel = selectedOption?.label ?? "";
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
    // Enquanto digita, nao seleciona automaticamente para evitar preencher com valor errado.
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

function createEmptyItemDraft(catalog: ItemCatalog): ItemDraft {
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
  if (!value) {
    if (fallback) return fallback;
    return "";
  }
  if (options.some((option) => option.value === value)) return value;
  return value;
}

function preferBrMoeda(options: CatalogOption[]): string {
  const brl = options.find((option) => option.label.toUpperCase().includes("BRL") || option.label.toUpperCase().includes("REAL"));
  return brl?.value ?? options[0]?.value ?? "";
}

function optionLabel(options: CatalogOption[], value: string): string {
  if (!value) return "";
  return findCatalogOptionByValue(options, value)?.label ?? "";
}

function optionLabelByItemValue(options: CatalogOption[], value: string): string {
  if (!value) return "";
  const exact = options.find((option) => option.value === value);
  if (exact) return exact.label;
  const normalizedValue = stripSapPrefix(value).toUpperCase();
  if (!normalizedValue) return "";
  const fuzzy = options.find((option) => stripSapPrefix(option.value).toUpperCase() === normalizedValue);
  return fuzzy?.label ?? "";
}

function findCatalogOptionByValue(options: CatalogOption[], value: string): CatalogOption | null {
  if (!value) return null;
  const exact = options.find((option) => option.value === value);
  if (exact) return exact;
  const normalizedValue = stripSapPrefix(value).toUpperCase();
  if (!normalizedValue) return null;
  return options.find((option) => stripSapPrefix(option.value).toUpperCase() === normalizedValue) ?? null;
}

function normalizeItemDisplayLabel(value: string): string {
  const stripped = stripSapPrefix(value);
  if (!stripped) return "";
  return stripped.replace(/\s*-\s*-\s*/g, " - ").trim();
}

function stripSapPrefix(value: string): string {
  return String(value ?? "").replace(/^sap:[^:]+:/i, "").trim();
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

function filterCatalogOptions(options: CatalogOption[], search: string, selectedValue?: string): CatalogOption[] {
  const term = normalizeSearchTerm(search);
  if (!term) return options;

  const filtered = options.filter((option) => {
    const label = normalizeSearchTerm(option.label);
    const value = normalizeSearchTerm(option.value);
    return label.includes(term) || value.includes(term);
  });

  if (selectedValue && !filtered.some((option) => option.value === selectedValue)) {
    const selected = findCatalogOptionByValue(options, selectedValue);
    if (selected) return [selected, ...filtered];
  }

  return filtered;
}

function normalizeSearchTerm(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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
    banco: asText(row.banco) || "",
    agencia: asText(row.agencia) || "",
    conta: asText(row.conta) || "",
    digito: asText(row.digito) || "",
  };
}

function mapCustoCategoriaRowFromApi(row: Record<string, unknown>): CustoCategoriaRow {
  return {
    categoria: asText(row.categoria),
    qualidade: asText(row.qualidade),
    raca: asText(row.raca),
    quantidade: formatCurrencyFromUnknown(row.quantidade),
    rendimentoCarcaca: formatCurrencyFromUnknown(row.rendimentoCarcaca),
    pesoMedio: formatCurrencyFromUnknown(row.pesoMedio),
    valorTabela: formatCurrencyFromUnknown(row.valorTabela),
    valorNegociado: formatCurrencyFromUnknown(row.valorNegociado),
    valorFrete: formatCurrencyFromUnknown(row.valorFrete),
    valorIcmsArroba: formatCurrencyFromUnknown(row.valorIcmsArroba),
    cabecas: asText(row.cabecas),
    condicaoPagamento: asText(row.condicaoPagamento),
    valorTotal: formatCurrencyFromUnknown(row.valorTotal),
    observacao: asText(row.observacao),
    contraoferta: formatCurrencyFromUnknown(row.contraoferta),
    trackCount: asText(row.trackCount),
  };
}

function mapGenericRowFromApi(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, asText(value)]),
  );
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "t" || normalized === "sim";
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

function formatNumberFromUnknown(value: unknown): string {
  const parsed = parseUnknownNumber(value);
  if (Number.isNaN(parsed)) return "";
  return String(parsed).replace(".", ",");
}

function parseUnknownNumber(value: unknown): number {
  const text = asText(value);
  if (!text) return Number.NaN;
  if (text.includes(",")) {
    return Number(text.replace(/\./g, "").replace(",", "."));
  }
  return Number(text);
}

function normalizeResponsavelFrete(value: string): BasicForm["responsavelFrete"] {
  if (value === "parceiro" || value === "terceiro") return value;
  return "empresa";
}

function normalizeCalculoFrete(value: string): BasicForm["calculoFrete"] {
  if (value === "peso") return "peso";
  return "km_rodado";
}

function normalizeStatusValue(value: string): ContratoStatus {
  const normalized = normalizeSearchTerm(value).replace(/\s+/g, "_");
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

function joinTextParts(parts: string[]): string {
  return parts.map((item) => item.trim()).filter((item) => item.length > 0).join(" - ");
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

function formatCurrencyBr(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number.parseInt(digits, 10) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePnOptionParts(label: string): { codigo: string; nome: string; documento: string } {
  const text = String(label ?? "").trim();
  if (!text) return { codigo: "", nome: "", documento: "" };
  const parts = text.split(" - ").map((item) => item.trim()).filter((item) => item.length > 0);
  if (parts.length === 1) return { codigo: "", nome: parts[0], documento: "" };
  if (parts.length === 2) return { codigo: parts[0], nome: parts[1], documento: "" };
  return {
    codigo: parts[0],
    nome: parts[1],
    documento: parts.slice(2).join(" - "),
  };
}

function toDadosGeraisPayload(
  dadosGerais: DadosGeraisForm,
  extra?: {
    lotes?: Record<string, string>[];
    gtaContratos?: Record<string, string>[];
    abates?: Record<string, string>[];
    pnSnapshots?: {
      comprador?: { codigo: string; nome: string; documento: string };
      faturador?: { codigo: string; nome: string; documento: string };
      frigorifico?: { codigo: string; nome: string; documento: string };
      anuente?: { codigo: string; nome: string; documento: string };
    };
  },
) {
  return {
    tipoEntrada: toOptionalString(dadosGerais.tipoEntrada),
    tabelaPreco: toOptionalString(dadosGerais.tabelaPreco),
    originador: toOptionalString(dadosGerais.originador),
    compradorId: toOptionalString(dadosGerais.compradorId),
    compradorCodigo: toOptionalString(extra?.pnSnapshots?.comprador?.codigo ?? ""),
    compradorNome: toOptionalString(extra?.pnSnapshots?.comprador?.nome ?? ""),
    compradorDocumento: toOptionalString(extra?.pnSnapshots?.comprador?.documento ?? ""),
    faturadorId: toOptionalString(dadosGerais.faturadorId),
    faturadorCodigo: toOptionalString(extra?.pnSnapshots?.faturador?.codigo ?? ""),
    faturadorNome: toOptionalString(extra?.pnSnapshots?.faturador?.nome ?? ""),
    faturadorDocumento: toOptionalString(extra?.pnSnapshots?.faturador?.documento ?? ""),
    frigorificoId: toOptionalString(dadosGerais.frigorificoId),
    frigorificoCodigo: toOptionalString(extra?.pnSnapshots?.frigorifico?.codigo ?? ""),
    frigorificoNome: toOptionalString(extra?.pnSnapshots?.frigorifico?.nome ?? ""),
    frigorificoDocumento: toOptionalString(extra?.pnSnapshots?.frigorifico?.documento ?? ""),
    anuenteId: toOptionalString(dadosGerais.anuenteId),
    anuenteCodigo: toOptionalString(extra?.pnSnapshots?.anuente?.codigo ?? ""),
    anuenteNome: toOptionalString(extra?.pnSnapshots?.anuente?.nome ?? ""),
    anuenteDocumento: toOptionalString(extra?.pnSnapshots?.anuente?.documento ?? ""),
    sexo: toOptionalString(dadosGerais.sexo),
    valorArroba: toOptionalNumber(dadosGerais.valorArroba) ?? null,
    rcFixo: toOptionalNumber(dadosGerais.rcFixo) ?? null,
    dataEmbarque: toOptionalString(dadosGerais.dataEmbarque),
    dataPesagem: toOptionalString(dadosGerais.dataPesagem),
    dataAbate: toOptionalString(dadosGerais.dataAbate),
    tipoSaida: toOptionalString(dadosGerais.tipoSaida),
    quantidadeNegociada: toOptionalNumber(dadosGerais.quantidadeNegociada) ?? null,
    animaisMapa: toOptionalNumber(dadosGerais.animaisMapa) ?? null,
    pesoMapaKg: toOptionalNumber(dadosGerais.pesoMapaKg) ?? null,
    quantidadeGta: toOptionalNumber(dadosGerais.quantidadeGta) ?? null,
    animaisMortos: toOptionalNumber(dadosGerais.animaisMortos) ?? null,
    animaisLesionados: toOptionalNumber(dadosGerais.animaisLesionados) ?? null,
    animaisChegada: toOptionalNumber(dadosGerais.animaisChegada) ?? null,
    pesoChegadaKg: toOptionalNumber(dadosGerais.pesoChegadaKg) ?? null,
    quebraKg: toOptionalNumber(dadosGerais.quebraKg) ?? null,
    quebraArroba: toOptionalNumber(dadosGerais.quebraArroba) ?? null,
    quebraPercentual: toOptionalNumber(dadosGerais.quebraPercentual) ?? null,
    animaisDesembarcados: toOptionalNumber(dadosGerais.animaisDesembarcados) ?? null,
    animaisProcessado: toOptionalNumber(dadosGerais.animaisProcessado) ?? null,
    pesoIdentificacaoKg: toOptionalNumber(dadosGerais.pesoIdentificacaoKg) ?? null,
    pesoBrutoCabeca: toOptionalNumber(dadosGerais.pesoBrutoCabeca) ?? null,
    rcEntrada: toOptionalNumber(dadosGerais.rcEntrada) ?? null,
    pesoComRc: toOptionalNumber(dadosGerais.pesoComRc) ?? null,
    pesoConsideradoArroba: toOptionalNumber(dadosGerais.pesoConsideradoArroba) ?? null,
    pesoConsideradoKg: toOptionalNumber(dadosGerais.pesoConsideradoKg) ?? null,
    pesoMedioAbate: toOptionalNumber(dadosGerais.pesoMedioAbate) ?? null,
    dls: toOptionalString(dadosGerais.dls),
    gmd: toOptionalNumber(dadosGerais.gmd) ?? null,
    gmc: toOptionalNumber(dadosGerais.gmc) ?? null,
    consumoPercentualPv: toOptionalNumber(dadosGerais.consumoPercentualPv) ?? null,
    categoria: toOptionalString(dadosGerais.categoria),
    racaPredominante: toOptionalString(dadosGerais.racaPredominante),
    precoVendaFutura: dadosGerais.precoVendaFutura,
    lotes: extra?.lotes ?? [],
    gtaContratos: extra?.gtaContratos ?? [],
    abates: extra?.abates ?? [],
  };
}

function toCustosResumoPayload(custosResumo: CustosResumoForm) {
  return {
    valorMedioCepea: toOptionalNumber(custosResumo.valorMedioCepea) ?? null,
    percentualParceria: toOptionalNumber(custosResumo.percentualParceria) ?? null,
    percentualRecria: toOptionalNumber(custosResumo.percentualRecria) ?? null,
    valorArroba: toOptionalNumber(custosResumo.valorArroba) ?? null,
    valorCabeca: toOptionalNumber(custosResumo.valorCabeca) ?? null,
    valorFreteCab: toOptionalNumber(custosResumo.valorFreteCab) ?? null,
    valorIcmsArroba: toOptionalNumber(custosResumo.valorIcmsArroba) ?? null,
    valorIcmsFreteCab: toOptionalNumber(custosResumo.valorIcmsFreteCab) ?? null,
    valorProtocolo: toOptionalNumber(custosResumo.valorProtocolo) ?? null,
    valorBrinco: toOptionalNumber(custosResumo.valorBrinco) ?? null,
    valorTotal: toOptionalNumber(custosResumo.valorTotal) ?? null,
    operacionalCabDia: toOptionalNumber(custosResumo.operacionalCabDia) ?? null,
    operacionalCabDiaVendido: toOptionalNumber(custosResumo.operacionalCabDiaVendido) ?? null,
    custoToneladaMs: toOptionalNumber(custosResumo.custoToneladaMs) ?? null,
    custoToneladaMsVendido: toOptionalNumber(custosResumo.custoToneladaMsVendido) ?? null,
    valorArrobaProduzida: toOptionalNumber(custosResumo.valorArrobaProduzida) ?? null,
    animaisPrevisto: toOptionalNumber(custosResumo.animaisPrevisto) ?? null,
    descontoVendaArroba: toOptionalNumber(custosResumo.descontoVendaArroba) ?? null,
  };
}

function toOutrosPayload(outros: OutrosForm) {
  return {
    dataEmbarque: toOptionalString(outros.dataEmbarque) ?? null,
    dataPrevistaChegada: toOptionalString(outros.dataPrevistaChegada) ?? null,
    freteConfinamento: toOptionalString(outros.freteConfinamento) ?? null,
    fazendaDestino: toOptionalString(outros.fazendaDestino) ?? null,
    fazendaOrigem: toOptionalString(outros.fazendaOrigem) ?? null,
    descontoAcerto: outros.descontoAcerto,
    descricaoDesconto: toOptionalString(outros.descricaoDesconto) ?? null,
    pesoReferencia: toOptionalString(outros.pesoReferencia) ?? null,
    observacao: toOptionalString(outros.observacao) ?? null,
  };
}

