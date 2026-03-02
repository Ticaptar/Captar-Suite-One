"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import type { ContratoStatus } from "@/lib/types/contrato";

const RESPONSAVEL_JURIDICO_FIXO = "CAMILA CARMO DE CARVALHO - 05500424580";

type TabKey = "dados" | "itens" | "frete" | "financeiro" | "notas" | "clausulas" | "previsoes" | "entrada_saida" | "sap_b1";
type ModalType = "item" | "frete" | "financeiro" | "nota" | "previsao" | null;
type PnPickerTarget = "parceiro";

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
  valor: string;
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
  { key: "clausulas", label: "clausulas" },
  { key: "previsoes", label: "previsoes" },
  { key: "entrada_saida", label: "Entrada/Saída de Insumos" },
  { key: "sap_b1", label: "SAP B1" },
];

export default function NovoContratoSaidaInsumosPage() {
  const router = useRouter();
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
  const parceiroCatalogOptions = useMemo(
    () =>
      parceiros.map((parceiro) => ({
        value: String(parceiro.id),
        label: `${parceiro.codigo ?? "SEM-COD"} - ${parceiro.nome}${parceiro.documento ? ` - ${formatCpfCnpj(parceiro.documento)}` : ""}`,
      })),
    [parceiros],
  );

  const [itens, setItens] = useState<Record<string, string>[]>([]);
  const [fretes, setFretes] = useState<Record<string, string>[]>([]);
  const [financeiros, setFinanceiros] = useState<Record<string, string>[]>([]);
  const [notas, setNotas] = useState<Record<string, string>[]>([]);
  const [clausulas, setClausulas] = useState<Record<string, string>[]>([]);
  const [previsoes, setPrevisoes] = useState<Record<string, string>[]>([]);
  const [clausulaCodigo, setClausulaCodigo] = useState("");
  const [clausulaTitulo, setClausulaTitulo] = useState("");

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
    valor: "",
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
        const params = new URLSearchParams();
        params.set("limit", term.length >= 2 ? "200" : "80");
        if (term) params.set("search", term);
        const parceirosUrl = `/api/cadastros/parceiros?${params.toString()}`;
        if (typeof window !== "undefined") {
          console.info("[DEBUG PN][Saida] URL:", parceirosUrl);
        }
        const response = await fetch(parceirosUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Falha ao carregar parceiros.");
        const data = (await response.json()) as ParceiroOption[];
        if (active) {
          setParceiros((prev) => {
            const selectedId = String(form.parceiroId ?? "").trim();
            if (!selectedId) return data;
            const selectedFromPrev = prev.find(
              (item) => String(item.id) === selectedId && !data.some((next) => next.id === item.id),
            );
            if (!selectedFromPrev) return data;
            return [selectedFromPrev, ...data];
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
  }, [form.parceiroId, parceiroSearch]);

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
    }
    closePnPicker();
  }

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
          empresaId: empresaId ?? empresaSyntheticId ?? prev.empresaId,
          exercicio: asText(contrato.ano) || prev.exercicio,
          numero: asText(contrato.numero) || "",
          parceiroId: parceiroId ?? parceiroSyntheticId ?? "",
          referenciaContrato: asText(contrato.descricao) || "",
          inicioEm: toDateInputValue(contrato.dt_inicio),
          vencimentoEm: toDateInputValue(contrato.dt_vencimento),
          assinaturaEm: toDateInputValue(contrato.dt_assinatura),
          prazoEntregaEm: toDateInputValue(contrato.prazo_entrega),
          valor: formatCurrencyFromUnknown(contrato.vl),
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

        setItens((payload.itens ?? []).map(mapGenericRowFromApi));
        setFretes((payload.fretes ?? []).map(mapGenericRowFromApi));
        setFinanceiros((payload.financeiro ?? []).map(mapGenericRowFromApi));
        setNotas((payload.notas ?? []).map(mapGenericRowFromApi));
        setClausulas((payload.clausulas ?? []).map(mapGenericRowFromApi));
        setPrevisoes((payload.previsoes ?? []).map(mapGenericRowFromApi));

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

  function openModal(type: ModalType) {
    setError("");
    setModalType(type);
    if (type === "item") setDraft({ item: "", und: "TON", valorUnitario: "0,00", quantidade: "0,00", prazoEntrega: "", condicaoPagamento: "", deposito: "", centroCusto: "", utilizAção: "", moeda: "BRL", valorComissao: "0,00" });
    if (type === "frete") setDraft({ frete: "CIF", transportador: "", cpfMotorista: "", observacao: "", valor: "0,00", qtd: "0,00", qtdChegada: "0,00", km: "0,00", dataEmbarque: "", dataEntrega: "", equipamento: "" });
    if (type === "financeiro") setDraft({ descricao: "", data: "", valor: "0,00", taxaJuros: "0,00", diasReferencia: "", condicaoPagamento: "", formaPagamento: "" });
    if (type === "nota") setDraft({ nf: "" });
    if (type === "previsao") setDraft({ dataInicio: "", descricao: "", valor: "0,00" });
  }

  function saveModal() {
    if (!modalType) return;
    if (modalType === "item") return setItens((prev) => [...prev, { ...draft, valorTotal: toDecimal(parseDecimal(draft.valorUnitario) * parseDecimal(draft.quantidade)) }]), setModalType(null);
    if (modalType === "frete") return setFretes((prev) => [...prev, draft]), setModalType(null);
    if (modalType === "financeiro") return setFinanceiros((prev) => [...prev, draft]), setModalType(null);
    if (modalType === "nota") {
      if (!draft.nf?.trim()) return setError("Informe a NF.");
      return setNotas((prev) => [...prev, draft]), setModalType(null);
    }
    if (modalType === "previsao") return setPrevisoes((prev) => [...prev, draft]), setModalType(null);
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
    if (!isEditMode && !toOptionalInt(form.numero)) return setError("Informe o número do contrato.");
    if (!form.referenciaContrato.trim()) return setError("Referência do contrato é obrigatória.");
    const currentContratoId = isEditMode && editingContratoId ? editingContratoId : savedContratoId;
    const method = currentContratoId ? "PATCH" : "POST";
    const endpoint = currentContratoId
      ? `/api/contratos/saida-insumos/${currentContratoId}`
      : "/api/contratos/saida-insumos";

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
          valor: toOptionalNumber(form.valor),
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
          previsoes,
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
        router.replace(`/contratos/saida-insumos/novo?id=${contratoId}`);
        if (options?.gerarPdf) {
          window.open(`/api/contratos/saida-insumos/${contratoId}/pdf`, "_blank", "noopener,noreferrer");
          return;
        }
        return;
      }
      router.push("/contratos/saida-insumos");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatus(nextStatus: ContratoStatus) {
    const contratoId = savedContratoId ?? editingContratoId ?? null;
    if (!contratoId || Number.isNaN(contratoId)) {
      setError("Salve o contrato antes de atualizar o status.");
      return;
    }

    setError("");
    setSuccess("");
    setStatusUpdating(true);
    try {
      const response = await fetch(`/api/contratos/saida-insumos/${contratoId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao atualizar status.");
      }

      setCurrentStatus(nextStatus);
      setSuccess(`Status atualizado para "${statusLabel(nextStatus)}".`);
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
          title={isEditMode ? "Editar Contrato de Saída de Insumos" : "Novo Contrato de Saída de Insumos"}
          subtitle="Use as abas para preencher Dados Básicos, itens, frete, financeiro e validações do contrato."
          backHref="/contratos/saida-insumos"
        />
        <ModuleHeader />
        <section className="card p-3">
          <div className="legacy-toolbar">
            <div className="legacy-toolbar-left">
              <h1 className="legacy-title">
                Contrato de Saída de Insumos / {isEditMode ? `(ID ${editingContratoId})` : "(Novo)"}
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
              onClick={() => handleChangeStatus("ativo")}
              disabled={saving || statusUpdating || loadingContrato}
            >
              {statusUpdating ? "Atualizando..." : "Aprovar/Gerar Pedido"}
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
              <label className="legacy-field"><span>Tipo Contrato</span><input className="legacy-input" value="Saída de Insumos" disabled /></label>
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
                <label className="legacy-field"><span>Valor</span><input className="legacy-input" value={form.valor} onChange={(event) => setForm((prev) => ({ ...prev, valor: formatCurrencyBr(event.target.value) }))} /></label>
                <label className="legacy-field"><span>Assinatura Parceiro</span><input className="legacy-input" value={form.assinaturaParceiro} onChange={(event) => setForm((prev) => ({ ...prev, assinaturaParceiro: event.target.value }))} /></label>
                <label className="legacy-field"><span>Assinatura Empresa</span><input className="legacy-input" value={form.assinaturaEmpresa} onChange={(event) => setForm((prev) => ({ ...prev, assinaturaEmpresa: event.target.value }))} /></label>
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

            {activeTab !== "dados" && activeTab !== "clausulas" && activeTab !== "entrada_saida" && activeTab !== "sap_b1" && (
              <TabTable onAdd={() => openModal(activeTab === "itens" ? "item" : activeTab === "frete" ? "frete" : activeTab === "financeiro" ? "financeiro" : activeTab === "notas" ? "nota" : "previsao")} rows={activeTab === "itens" ? itens : activeTab === "frete" ? fretes : activeTab === "financeiro" ? financeiros : activeTab === "notas" ? notas : previsoes} onRemove={(index) => activeTab === "itens" ? setItens((prev) => prev.filter((_, i) => i !== index)) : activeTab === "frete" ? setFretes((prev) => prev.filter((_, i) => i !== index)) : activeTab === "financeiro" ? setFinanceiros((prev) => prev.filter((_, i) => i !== index)) : activeTab === "notas" ? setNotas((prev) => prev.filter((_, i) => i !== index)) : setPrevisoes((prev) => prev.filter((_, i) => i !== index))} />
            )}
            {activeTab === "clausulas" && <div className="mt-2"><div className="legacy-grid cols-4"><label className="legacy-field"><span>Clausula</span><select className="legacy-select" value={clausulaCodigo} onChange={(event) => setClausulaCodigo(event.target.value)}><option value="">Selecione...</option><option value="CL01">CL01</option><option value="CL02">CL02</option><option value="CL03">CL03</option></select></label><label className="legacy-field"><span>Titulo</span><input className="legacy-input" value={clausulaTitulo} onChange={(event) => setClausulaTitulo(event.target.value)} /></label></div><div className="legacy-actions mt-2"><button type="button" className="legacy-btn" onClick={() => { if (!clausulaCodigo || !clausulaTitulo.trim()) return setError("Informe cláusula e título."); setClausulas((prev) => [...prev, { codigo: clausulaCodigo, referencia: clausulaTitulo.trim(), descricao: clausulaTitulo.trim() }]); setClausulaCodigo(""); setClausulaTitulo(""); }}>Adicionar</button></div><TabTable rows={clausulas} onRemove={(index) => setClausulas((prev) => prev.filter((_, i) => i !== index))} /></div>}
            {activeTab === "entrada_saida" && <Placeholder text="Aba pronta para receber o fluxo de Entrada/Saída de Insumos." />}
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
        <LegacyModal title={`Adicionar ${modalType === "item" ? "Item" : modalType === "frete" ? "Frete" : modalType === "financeiro" ? "Financeiro" : modalType === "nota" ? "Nota" : "previsao"}`} onClose={() => setModalType(null)}>
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
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";
  const [text, setText] = useState(selectedLabel);
  const [isFocused, setIsFocused] = useState(false);
  const inputValue = isFocused ? text : value ? selectedLabel : text;
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
      const valueTerm = normalizeSearchTerm(option.value);
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
          if (value && selectedLabel) {
            setText(selectedLabel);
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

function mapGenericRowFromApi(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, asText(value)]),
  );
}

function optionLabel(options: CatalogOption[], value: string): string {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label ?? "";
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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


