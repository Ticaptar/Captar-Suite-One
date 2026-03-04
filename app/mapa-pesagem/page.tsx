"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import type { ContratoEntradaAnimaisListItem } from "@/lib/types/contrato";

type ListaResponse = {
  items: ContratoEntradaAnimaisListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type ContratoDetalheResponse = {
  contrato?: {
    id: number;
    numero?: string | null;
    descricao?: string | null;
    parceiro_nome_base?: string | null;
    dadosGerais?: (Record<string, unknown> & {
      animaisMapa?: number | null;
      pesoMapaKg?: number | null;
      animaisChegada?: number | null;
      pesoChegadaKg?: number | null;
      animaisMortos?: number | null;
      animaisLesionados?: number | null;
    }) | null;
  };
  mapas?: Record<string, string>[];
};

type AnimalLinha = {
  idLocal: string;
  ordem: string;
  quantidadeAnimal: string;
  pesoMedioKg: string;
  pesoVivoKg: string;
};

type MapaDraft = {
  numeroMapa: string;
  dataJejum: string;
  horaInicioJejum: string;
  horaFimJejum: string;
  dataPesagem: string;
  horaInicioPesagem: string;
  horaFimPesagem: string;
  qualidade: string;
  placa: string;
  motorista: string;
  rendimentoCarcaca: string;
  pesoBrutoKg: string;
  pesoTotalArroba: string;
  pesoMedioArroba: string;
  quantidadeAnimais: string;
  pesoLiquidoArroba: string;
  valorArroba: string;
  valorTotal: string;
  valorComissao: string;
  comprador: string;
  responsavel: string;
  telefoneResponsavel: string;
  cpfResponsavel: string;
  observacao: string;
};

type FieldDef = {
  key: keyof MapaDraft;
  label: string;
  type?: "text" | "date" | "time";
  span?: number;
  decimal?: boolean;
  calculated?: boolean;
  options?: string[];
};

const EMPTY_MAPA: MapaDraft = {
  numeroMapa: "",
  dataJejum: "",
  horaInicioJejum: "",
  horaFimJejum: "",
  dataPesagem: "",
  horaInicioPesagem: "",
  horaFimPesagem: "",
  qualidade: "",
  placa: "",
  motorista: "",
  rendimentoCarcaca: "",
  pesoBrutoKg: "",
  pesoTotalArroba: "",
  pesoMedioArroba: "",
  quantidadeAnimais: "",
  pesoLiquidoArroba: "",
  valorArroba: "",
  valorTotal: "",
  valorComissao: "",
  comprador: "",
  responsavel: "",
  telefoneResponsavel: "",
  cpfResponsavel: "",
  observacao: "",
};

const EMPTY_ANIMAL: Omit<AnimalLinha, "idLocal"> = {
  ordem: "",
  quantidadeAnimal: "",
  pesoMedioKg: "",
  pesoVivoKg: "",
};

const QUALIDADES = ["MERCADO INTERNO", "EXPORTACAO", "MESTICO", "NELORE", "CRUZADO"];

const MAPA_FIELDS: FieldDef[] = [
  { key: "numeroMapa", label: "Numero Mapa" },
  { key: "dataJejum", label: "Data Jejum", type: "date" },
  { key: "horaInicioJejum", label: "Hora Inicio Jejum", type: "time" },
  { key: "horaFimJejum", label: "Hora Fim Jejum", type: "time" },
  { key: "dataPesagem", label: "Data Pesagem", type: "date" },
  { key: "horaInicioPesagem", label: "Hora Inicio Pesagem", type: "time" },
  { key: "horaFimPesagem", label: "Hora Fim Pesagem", type: "time" },
  { key: "qualidade", label: "Qualidade", options: QUALIDADES },
  { key: "placa", label: "Placa" },
  { key: "motorista", label: "Motorista" },
  { key: "rendimentoCarcaca", label: "Rendimento Carcaca", decimal: true },
  { key: "pesoBrutoKg", label: "Peso Bruto(KG)", decimal: true },
  { key: "pesoTotalArroba", label: "Peso Total(@)", decimal: true, calculated: true },
  { key: "pesoMedioArroba", label: "Peso Medio(@)", decimal: true, calculated: true },
  { key: "quantidadeAnimais", label: "Quantidade Animais", decimal: true },
  { key: "pesoLiquidoArroba", label: "Peso Liquido(@)", decimal: true, calculated: true },
  { key: "valorArroba", label: "Valor (R$/@)", decimal: true },
  { key: "valorTotal", label: "Valor Total", decimal: true, calculated: true },
  { key: "valorComissao", label: "Valor Comissao", decimal: true },
  { key: "comprador", label: "Comprador" },
  { key: "responsavel", label: "Responsavel" },
  { key: "telefoneResponsavel", label: "Telefone Responsavel" },
  { key: "cpfResponsavel", label: "CPF Responsavel" },
  { key: "observacao", label: "Observacao", span: 2 },
];

export default function MapaPesagemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contratoIdFromQuery = useMemo(() => {
    const raw = searchParams.get("contratoId");
    if (!raw) return "";
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? "" : String(parsed);
  }, [searchParams]);

  const [contratos, setContratos] = useState<ContratoEntradaAnimaisListItem[]>([]);
  const [selectedContratoId, setSelectedContratoId] = useState("");
  const [loadingContratos, setLoadingContratos] = useState(true);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [resumoContrato, setResumoContrato] = useState<ContratoDetalheResponse["contrato"] | null>(null);
  const [mapasSalvosContrato, setMapasSalvosContrato] = useState<Record<string, string>[]>([]);
  const [novoMapa, setNovoMapa] = useState(false);

  const [mapaDraft, setMapaDraft] = useState<MapaDraft>(EMPTY_MAPA);
  const [animalLinhas, setAnimalLinhas] = useState<AnimalLinha[]>([]);
  const [animalModalOpen, setAnimalModalOpen] = useState(false);
  const [animalDraft, setAnimalDraft] = useState(EMPTY_ANIMAL);
  const [animalEditId, setAnimalEditId] = useState<string | null>(null);

  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (contratoIdFromQuery) setSelectedContratoId(contratoIdFromQuery);
  }, [contratoIdFromQuery]);

  useEffect(() => {
    setOnline(window.navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  const contratosFiltrados = useMemo(() => {
    const term = normalizeSearch(searchTerm);
    if (!term) return contratos;
    return contratos.filter((item) => {
      return (
        normalizeSearch(item.referenciaContrato).includes(term) ||
        normalizeSearch(item.numero).includes(term) ||
        normalizeSearch(item.parceiro ?? "").includes(term) ||
        String(item.id).includes(term)
      );
    });
  }, [contratos, searchTerm]);

  const totaisAnimais = useMemo(() => {
    return animalLinhas.reduce(
      (acc, row) => {
        acc.qtd += parseDecimal(row.quantidadeAnimal);
        acc.peso += parseDecimal(row.pesoVivoKg);
        return acc;
      },
      { qtd: 0, peso: 0 },
    );
  }, [animalLinhas]);

  const loadContratos = useCallback(async () => {
    setLoadingContratos(true);
    setError("");
    try {
      const response = await fetch("/api/contratos/entrada-animais?page=1&pageSize=500", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao carregar contratos.");
      }
      const data = (await response.json()) as ListaResponse;
      setContratos(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar contratos.");
      setContratos([]);
    } finally {
      setLoadingContratos(false);
    }
  }, []);

  useEffect(() => {
    loadContratos().catch(() => undefined);
  }, [loadContratos]);

  const loadContratoDetalhe = useCallback(async () => {
    if (!selectedContratoId) {
      setResumoContrato(null);
      setMapaDraft(EMPTY_MAPA);
      setAnimalLinhas([]);
      setMapasSalvosContrato([]);
      setNovoMapa(false);
      return;
    }

    setLoadingDetalhe(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/contratos/entrada-animais/${selectedContratoId}`, { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao carregar dados do contrato.");
      }

      const data = (await response.json()) as ContratoDetalheResponse;
      const contrato = data.contrato ?? null;
      const mapas = data.mapas ?? [];
      setResumoContrato(contrato);
      setMapasSalvosContrato(mapas);
      setNovoMapa(false);

      if (mapas.length > 0) {
        const parsed = parseMapaPayload(mapas[mapas.length - 1]);
        setMapaDraft({ ...parsed.draft, comprador: parsed.draft.comprador || contrato?.parceiro_nome_base || "" });
        setAnimalLinhas(parsed.animais);
      } else {
        setMapaDraft({
          ...EMPTY_MAPA,
          comprador: contrato?.parceiro_nome_base ?? "",
          quantidadeAnimais: toDecimalString(contrato?.dadosGerais?.animaisMapa),
          pesoBrutoKg: toDecimalString(contrato?.dadosGerais?.pesoMapaKg),
        });
        setAnimalLinhas([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados do contrato.");
      setResumoContrato(null);
      setMapaDraft(EMPTY_MAPA);
      setAnimalLinhas([]);
      setMapasSalvosContrato([]);
      setNovoMapa(false);
    } finally {
      setLoadingDetalhe(false);
    }
  }, [selectedContratoId]);

  useEffect(() => {
    loadContratoDetalhe().catch(() => undefined);
  }, [loadContratoDetalhe]);

  function onChangeField(field: FieldDef, value: string) {
    if (field.calculated) return;
    if (animalLinhas.length > 0 && (field.key === "quantidadeAnimais" || field.key === "pesoBrutoKg")) return;
    setMapaDraft((prev) => ({ ...prev, [field.key]: field.decimal ? sanitizeDecimal(value) : value }));
  }

  useEffect(() => {
    if (animalLinhas.length === 0) return;
    const quantidadeAnimais = animalLinhas.reduce((acc, row) => acc + parseDecimal(row.quantidadeAnimal), 0);
    const pesoBrutoKg = animalLinhas.reduce((acc, row) => acc + parseDecimal(row.pesoVivoKg), 0);
    const quantidadeFormatada = formatDecimalInput(quantidadeAnimais);
    const pesoBrutoFormatado = formatDecimalInput(pesoBrutoKg);

    setMapaDraft((prev) => {
      if (prev.quantidadeAnimais === quantidadeFormatada && prev.pesoBrutoKg === pesoBrutoFormatado) {
        return prev;
      }
      return {
        ...prev,
        quantidadeAnimais: quantidadeFormatada,
        pesoBrutoKg: pesoBrutoFormatado,
      };
    });
  }, [animalLinhas]);

  useEffect(() => {
    const pesoBrutoKg = parseDecimal(mapaDraft.pesoBrutoKg);
    const quantidadeAnimais = parseDecimal(mapaDraft.quantidadeAnimais);
    const valorArroba = parseDecimal(mapaDraft.valorArroba);

    const pesoTotalArroba = pesoBrutoKg > 0 ? pesoBrutoKg / 15 : 0;
    const pesoMedioArroba = quantidadeAnimais > 0 ? pesoTotalArroba / quantidadeAnimais : 0;
    // Peso liquido segue o mapa de animais (sem aplicar rendimento de carcaca).
    const pesoLiquidoArroba = pesoTotalArroba;
    const valorTotal = pesoLiquidoArroba * valorArroba;

    const proximoPesoTotal = formatDecimalInput(pesoTotalArroba);
    const proximoPesoMedio = formatDecimalInput(pesoMedioArroba);
    const proximoPesoLiquido = formatDecimalInput(pesoLiquidoArroba);
    const proximoValorTotal = formatDecimalInput(valorTotal);

    setMapaDraft((prev) => {
      if (
        prev.pesoTotalArroba === proximoPesoTotal &&
        prev.pesoMedioArroba === proximoPesoMedio &&
        prev.pesoLiquidoArroba === proximoPesoLiquido &&
        prev.valorTotal === proximoValorTotal
      ) {
        return prev;
      }

      return {
        ...prev,
        pesoTotalArroba: proximoPesoTotal,
        pesoMedioArroba: proximoPesoMedio,
        pesoLiquidoArroba: proximoPesoLiquido,
        valorTotal: proximoValorTotal,
      };
    });
  }, [
    // Mantemos 4 dependencias fixas para evitar erro de tamanho no Fast Refresh.
    mapaDraft.pesoBrutoKg,
    mapaDraft.quantidadeAnimais,
    mapaDraft.rendimentoCarcaca,
    mapaDraft.valorArroba,
  ]);

  function openAddAnimal() {
    setAnimalEditId(null);
    setAnimalDraft(EMPTY_ANIMAL);
    setAnimalModalOpen(true);
  }

  function openEditAnimal(idLocal: string) {
    const row = animalLinhas.find((item) => item.idLocal === idLocal);
    if (!row) return;
    setAnimalEditId(idLocal);
    setAnimalDraft({
      ordem: row.ordem,
      quantidadeAnimal: row.quantidadeAnimal,
      pesoMedioKg: row.pesoMedioKg,
      pesoVivoKg: row.pesoVivoKg,
    });
    setAnimalModalOpen(true);
  }

  function saveAnimal() {
    if (!animalDraft.quantidadeAnimal) {
      setError("Informe a quantidade de animal para salvar a linha.");
      return;
    }
    setError("");

    if (animalEditId) {
      setAnimalLinhas((prev) => prev.map((row) => (row.idLocal === animalEditId ? { ...row, ...animalDraft } : row)));
    } else {
      setAnimalLinhas((prev) => [
        ...prev,
        {
          idLocal: `animal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ...animalDraft,
        },
      ]);
    }

    setAnimalEditId(null);
    setAnimalDraft(EMPTY_ANIMAL);
    setAnimalModalOpen(false);
  }

  useEffect(() => {
    if (!animalModalOpen) return;
    const quantidade = parseDecimal(animalDraft.quantidadeAnimal);
    const pesoMedio = parseDecimal(animalDraft.pesoMedioKg);
    const pesoVivoCalculado = formatDecimalInput(quantidade * pesoMedio);
    if (pesoVivoCalculado !== animalDraft.pesoVivoKg) {
      setAnimalDraft((prev) => ({ ...prev, pesoVivoKg: pesoVivoCalculado }));
    }
  }, [animalDraft.pesoMedioKg, animalDraft.pesoVivoKg, animalDraft.quantidadeAnimal, animalModalOpen]);

  function novoMapaLocal() {
    if (!selectedContratoId) {
      setError("Selecione um contrato primeiro.");
      return;
    }
    setMapaDraft({ ...EMPTY_MAPA, comprador: resumoContrato?.parceiro_nome_base ?? "" });
    setAnimalLinhas([]);
    setNovoMapa(true);
    setError("");
    setMessage("Novo mapa iniciado.");
  }

  async function salvarNoContrato() {
    if (!selectedContratoId) {
      setError("Selecione um contrato para salvar.");
      return;
    }
    if (!online) {
      setError("Sem conexao no momento.");
      return;
    }
    if (!mapaDraft.dataPesagem) {
      setError("Informe a data da pesagem.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const novoPayload = serializeMapaPayload(mapaDraft, animalLinhas);
      const numeroMapa = normalizeText(mapaDraft.numeroMapa);
      const base = [...mapasSalvosContrato];
      let mapas: Record<string, string>[];

      if (novoMapa || base.length === 0) {
        mapas = [...base, novoPayload];
      } else {
        const index = numeroMapa ? base.findIndex((row) => normalizeText(row.numeroMapa) === numeroMapa) : -1;
        if (index >= 0) {
          mapas = base.map((row, rowIndex) => (rowIndex === index ? novoPayload : row));
        } else {
          mapas = base.map((row, rowIndex) => (rowIndex === base.length - 1 ? novoPayload : row));
        }
      }

      const totaisMapas = buildMapasTotals(mapas);
      const quantidadeAnimais =
        totaisMapas.quantidadeAnimais > 0
          ? totaisMapas.quantidadeAnimais
          : parseDecimal(mapaDraft.quantidadeAnimais || String(totaisAnimais.qtd));
      const pesoMapaKg =
        totaisMapas.pesoMapaKg > 0 ? totaisMapas.pesoMapaKg : parseDecimal(mapaDraft.pesoBrutoKg || String(totaisAnimais.peso));
      const pesoTotalArroba =
        totaisMapas.pesoTotalArroba > 0 ? totaisMapas.pesoTotalArroba : parseDecimal(mapaDraft.pesoTotalArroba);
      const pesoMedioArroba =
        quantidadeAnimais > 0
          ? pesoTotalArroba / quantidadeAnimais
          : totaisMapas.pesoMedioArroba > 0
            ? totaisMapas.pesoMedioArroba
            : parseDecimal(mapaDraft.pesoMedioArroba);
      const pesoLiquidoArroba =
        totaisMapas.pesoLiquidoArroba > 0 ? totaisMapas.pesoLiquidoArroba : parseDecimal(mapaDraft.pesoLiquidoArroba);
      const rendimentoCarcaca =
        totaisMapas.rendimentoCarcaca > 0 ? totaisMapas.rendimentoCarcaca : parseDecimal(mapaDraft.rendimentoCarcaca);
      const pesoBrutoCabeca = quantidadeAnimais > 0 ? pesoMapaKg / quantidadeAnimais : 0;
      const pesoConsideradoArroba = pesoLiquidoArroba > 0 ? pesoLiquidoArroba : pesoTotalArroba;
      const pesoConsideradoKg = pesoConsideradoArroba > 0 ? pesoConsideradoArroba * 15 : pesoMapaKg;
      // Regra: esses campos devem refletir o(s) mapa(s), sem reusar valor legado já salvo no contrato.
      const animaisChegada = quantidadeAnimais;
      const pesoLiquidoKg = pesoLiquidoArroba > 0 ? pesoLiquidoArroba * 15 : pesoMapaKg;
      const pesoChegadaKg = pesoLiquidoKg > 0 ? pesoLiquidoKg : pesoMapaKg;
      const quebraKg = Math.max(pesoMapaKg - pesoChegadaKg, 0);
      const quebraArroba = quebraKg / 15;
      const quebraPercentual = pesoMapaKg > 0 ? (quebraKg / pesoMapaKg) * 100 : 0;
      const animaisMortos = Math.max(quantidadeAnimais - animaisChegada, 0);
      const animaisLesionados = 0;

      const response = await fetch(`/api/contratos/entrada-animais/${selectedContratoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapas,
          dadosGerais: {
            ...(resumoContrato?.dadosGerais ?? {}),
            quantidadeNegociada: quantidadeAnimais,
            animaisMapa: quantidadeAnimais,
            pesoMapaKg,
            quantidadeGta: quantidadeAnimais,
            animaisChegada,
            pesoChegadaKg,
            quebraKg,
            quebraArroba,
            quebraPercentual,
            animaisDesembarcados: animaisChegada,
            animaisProcessado: quantidadeAnimais,
            animaisMortos,
            animaisLesionados,
            pesoBrutoCabeca,
            rcEntrada: rendimentoCarcaca,
            pesoConsideradoArroba,
            pesoConsideradoKg,
            pesoMedioAbate: pesoMedioArroba,
          },
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao salvar mapa no contrato.");
      }

      setMessage("Mapa salvo com sucesso. Redirecionando...");
      setTimeout(() => {
        router.push("/contratos/entrada-animais");
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar mapa no contrato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell mapa-pesagem-page min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <FormPageHeader
          title="Mapa de Pesagem"
          subtitle="Cadastro vinculado ao contrato de entrada de animais."
          backHref="/contratos/entrada-animais"
          backLabel="Contratos"
        />
        <ModuleHeader />

        <section className="card p-3 mapa-pesagem-card">
          <div className="legacy-toolbar compact-toolbar">
            <div className="legacy-toolbar-left">
              <div className="legacy-actions">
                <button type="button" className="legacy-btn" onClick={() => loadContratos()} disabled={loadingContratos}>
                  {loadingContratos ? "Atualizando..." : "Atualizar Contratos"}
                </button>
              </div>
            </div>
            <div className="legacy-toolbar-right mapa-pesagem-toolbar-right">
              <input
                className="legacy-input search"
                placeholder="Pesquisar contrato..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          {!online && <p className="legacy-message error">Modo offline ativo. O salvamento exige conexao.</p>}
          {error && <p className="legacy-message error">{error}</p>}
          {message && <p className="legacy-message success">{message}</p>}

          {resumoContrato && (
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <article className="card p-2 md:col-span-2">
                <p className="status-label">Contrato selecionado</p>
                <p className="status-title">{resumoContrato.descricao ?? "-"}</p>
                <p className="status-detail">
                  Numero: {resumoContrato.numero ?? "-"} | Parceiro: {resumoContrato.parceiro_nome_base ?? "-"}
                </p>
              </article>
              <article className="card p-2">
                <p className="status-label">Resumo animais</p>
                <p className="status-title">{totaisAnimais.qtd.toLocaleString("pt-BR")} cabecas</p>
                <p className="status-detail">{totaisAnimais.peso.toLocaleString("pt-BR")} kg</p>
              </article>
            </div>
          )}

          <div className="legacy-form mt-2">
            <div className="legacy-grid cols-4">
              <label className="legacy-field col-span-2">
                <span>Contrato</span>
                <select
                  className="legacy-select"
                  value={selectedContratoId}
                  onChange={(event) => setSelectedContratoId(event.target.value)}
                  disabled={loadingContratos}
                >
                  <option value="">Selecione...</option>
                  {contratosFiltrados.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} | {item.numero || "S/N"} | {item.parceiro ?? "SEM PARCEIRO"}
                    </option>
                  ))}
                </select>
              </label>

              {MAPA_FIELDS.map((field) => {
                const className = field.span ? `legacy-field col-span-${field.span}` : "legacy-field";
                const isAutoFromAnimal =
                  animalLinhas.length > 0 && (field.key === "quantidadeAnimais" || field.key === "pesoBrutoKg");
                const fieldDisabled = !selectedContratoId || loadingDetalhe || Boolean(field.calculated) || isAutoFromAnimal;
                if (field.options) {
                  return (
                    <label key={field.key} className={className}>
                      <span>{field.label}</span>
                      <select
                        className="legacy-select"
                        value={mapaDraft[field.key]}
                        onChange={(event) => onChangeField(field, event.target.value)}
                        disabled={fieldDisabled}
                      >
                        <option value="">Selecione...</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.key === "observacao") {
                  return (
                    <label key={field.key} className={className}>
                      <span>{field.label}</span>
                      <textarea
                        className="legacy-textarea"
                        value={mapaDraft[field.key]}
                        onChange={(event) => onChangeField(field, event.target.value)}
                        disabled={fieldDisabled}
                      />
                    </label>
                  );
                }

                return (
                  <label key={field.key} className={className}>
                    <span>{field.label}</span>
                    <input
                      type={field.type ?? "text"}
                      className="legacy-input"
                      value={mapaDraft[field.key]}
                      onChange={(event) => onChangeField(field, event.target.value)}
                      disabled={fieldDisabled}
                      readOnly={Boolean(field.calculated) || isAutoFromAnimal}
                    />
                  </label>
                );
              })}
            </div>

            <div className="legacy-actions mt-3 mapa-pesagem-actions">
              <button type="button" className="legacy-btn" onClick={novoMapaLocal} disabled={!selectedContratoId || loadingDetalhe}>
                Novo Mapa
              </button>
              <button
                type="button"
                className="legacy-btn primary"
                onClick={salvarNoContrato}
                disabled={!selectedContratoId || loadingDetalhe || saving}
              >
                {saving ? "Salvando..." : "Salvar no Contrato"}
              </button>
            </div>
          </div>

          <div className="mt-3">
            <p className="itens-title">Animal</p>
            <div className="legacy-actions mt-1">
              <button type="button" className="legacy-btn itens-add-btn" onClick={openAddAnimal} disabled={!selectedContratoId || loadingDetalhe}>
                Adicionar
              </button>
            </div>
          </div>

          <div className="itens-table-wrap mt-2 mapa-pesagem-table-wrap">
            <table className="itens-table mapa-pesagem-table">
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Quantidade Animal</th>
                  <th>Peso Vivo(KG)</th>
                  <th>Peso Medio(KG)</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loadingDetalhe && (
                  <tr>
                    <td colSpan={5} className="itens-empty" data-label="">
                      Carregando linhas do mapa...
                    </td>
                  </tr>
                )}
                {!loadingDetalhe && !selectedContratoId && (
                  <tr>
                    <td colSpan={5} className="itens-empty" data-label="">
                      Selecione um contrato para iniciar o mapa.
                    </td>
                  </tr>
                )}
                {!loadingDetalhe && selectedContratoId && animalLinhas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="itens-empty" data-label="">
                      Nenhuma linha adicionada.
                    </td>
                  </tr>
                )}
                {!loadingDetalhe &&
                  animalLinhas.map((row) => (
                    <tr key={row.idLocal}>
                      <td data-label="Ordem">{row.ordem || "-"}</td>
                      <td data-label="Quantidade Animal">{row.quantidadeAnimal || "0"}</td>
                      <td data-label="Peso Vivo(KG)">{row.pesoVivoKg || "0"}</td>
                      <td data-label="Peso Medio(KG)">{row.pesoMedioKg || "0"}</td>
                      <td className="action-cell" data-label="Acoes">
                        <div className="legacy-actions">
                          <button type="button" className="legacy-btn" onClick={() => openEditAnimal(row.idLocal)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="legacy-btn"
                            onClick={() => setAnimalLinhas((prev) => prev.filter((item) => item.idLocal !== row.idLocal))}
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {animalModalOpen && (
        <div className="legacy-modal-backdrop" role="dialog" aria-modal="true">
          <div className="legacy-modal" onClick={(event) => event.stopPropagation()}>
            <header className="legacy-modal-header">
              <h3>{animalEditId ? "Editar Linha Animal" : "Adicionar Linha Animal"}</h3>
              <button type="button" className="legacy-btn" onClick={() => setAnimalModalOpen(false)}>
                X
              </button>
            </header>
            <div className="legacy-modal-body">
              <div className="legacy-grid cols-4">
                <label className="legacy-field">
                  <span>Ordem</span>
                  <input
                    type="number"
                    className="legacy-input"
                    value={animalDraft.ordem}
                    onChange={(event) => setAnimalDraft((prev) => ({ ...prev, ordem: event.target.value }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Quantidade Animal</span>
                  <input
                    type="number"
                    step="0.01"
                    className="legacy-input"
                    value={animalDraft.quantidadeAnimal}
                    onChange={(event) =>
                      setAnimalDraft((prev) => ({ ...prev, quantidadeAnimal: sanitizeDecimal(event.target.value) }))
                    }
                  />
                </label>
                <label className="legacy-field">
                  <span>Peso Medio(KG)</span>
                  <input
                    type="number"
                    step="0.01"
                    className="legacy-input"
                    value={animalDraft.pesoMedioKg}
                    onChange={(event) =>
                      setAnimalDraft((prev) => ({ ...prev, pesoMedioKg: sanitizeDecimal(event.target.value) }))
                    }
                  />
                </label>
                <label className="legacy-field">
                  <span>Peso Vivo(KG)</span>
                  <input
                    className="legacy-input"
                    value={animalDraft.pesoVivoKg}
                    readOnly
                    disabled
                  />
                </label>
              </div>

              <div className="legacy-actions mt-3" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="legacy-btn" onClick={() => setAnimalModalOpen(false)}>
                  Descartar
                </button>
                <button type="button" className="legacy-btn primary" onClick={saveAnimal}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function sanitizeDecimal(value: string): string {
  return value.replace(/[^0-9,.-]/g, "");
}

function parseDecimal(value: string): number {
  const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toDecimalString(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  return String(value);
}

function formatDecimalInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMapaPayload(payload: Record<string, string>): { draft: MapaDraft; animais: AnimalLinha[] } {
  const animais = parseAnimaisJson(payload.animaisJson ?? "");
  return {
    draft: {
      numeroMapa: payload.numeroMapa ?? "",
      dataJejum: payload.dataJejum ?? "",
      horaInicioJejum: payload.horaInicioJejum ?? "",
      horaFimJejum: payload.horaFimJejum ?? "",
      dataPesagem: payload.dataPesagem ?? payload.dataInicio ?? payload.dt_inicio ?? "",
      horaInicioPesagem: payload.horaInicioPesagem ?? "",
      horaFimPesagem: payload.horaFimPesagem ?? "",
      qualidade: payload.qualidade ?? "",
      placa: payload.placa ?? "",
      motorista: payload.motorista ?? "",
      rendimentoCarcaca: payload.rendimentoCarcaca ?? "",
      pesoBrutoKg: payload.pesoBrutoKg ?? payload.pesoTotalKg ?? payload.pesoKg ?? "",
      pesoTotalArroba: payload.pesoTotalArroba ?? "",
      pesoMedioArroba: payload.pesoMedioArroba ?? "",
      quantidadeAnimais: payload.quantidadeAnimais ?? payload.quantidade ?? payload.qt ?? "",
      pesoLiquidoArroba: payload.pesoLiquidoArroba ?? "",
      valorArroba: payload.valorArroba ?? payload.valor ?? "",
      valorTotal: payload.valorTotal ?? "",
      valorComissao: payload.valorComissao ?? "",
      comprador: payload.comprador ?? "",
      responsavel: payload.responsavel ?? "",
      telefoneResponsavel: payload.telefoneResponsavel ?? "",
      cpfResponsavel: payload.cpfResponsavel ?? "",
      observacao: payload.observacao ?? "",
    },
    animais,
  };
}

function parseAnimaisJson(raw: string): AnimalLinha[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row, index) => ({
      idLocal: `animal-${index}-${Date.now()}`,
      ordem: String(row.ordem ?? ""),
      quantidadeAnimal: String(row.quantidadeAnimal ?? row.quantidade ?? ""),
      pesoMedioKg: String(row.pesoMedioKg ?? row.pesoMedio ?? ""),
      pesoVivoKg: String(row.pesoVivoKg ?? row.pesoVivo ?? ""),
    }));
  } catch {
    return [];
  }
}

function buildMapasTotals(mapas: Record<string, string>[]): {
  quantidadeAnimais: number;
  pesoMapaKg: number;
  pesoTotalArroba: number;
  pesoMedioArroba: number;
  pesoLiquidoArroba: number;
  rendimentoCarcaca: number;
} {
  return mapas.reduce(
    (acc, row) => {
      const parsed = parseMapaPayload(row);
      const quantidadeAnimaisMapa = parsed.animais.reduce((sum, animal) => sum + parseDecimal(animal.quantidadeAnimal), 0);
      const pesoBrutoMapa = parsed.animais.reduce((sum, animal) => sum + parseDecimal(animal.pesoVivoKg), 0);

      const quantidadeAnimais = parseDecimal(parsed.draft.quantidadeAnimais);
      const pesoMapaKg = parseDecimal(parsed.draft.pesoBrutoKg);
      const pesoTotalArroba = parseDecimal(parsed.draft.pesoTotalArroba);
      const pesoLiquidoArroba = parseDecimal(parsed.draft.pesoLiquidoArroba);
      const rendimentoCarcaca = parseDecimal(parsed.draft.rendimentoCarcaca);

      acc.quantidadeAnimais += quantidadeAnimais > 0 ? quantidadeAnimais : quantidadeAnimaisMapa;
      acc.pesoMapaKg += pesoMapaKg > 0 ? pesoMapaKg : pesoBrutoMapa;
      acc.pesoTotalArroba += pesoTotalArroba;
      acc.pesoLiquidoArroba += pesoLiquidoArroba;
      acc.rendimentoCarcaca += rendimentoCarcaca;
      return acc;
    },
    {
      quantidadeAnimais: 0,
      pesoMapaKg: 0,
      pesoTotalArroba: 0,
      pesoMedioArroba: 0,
      pesoLiquidoArroba: 0,
      rendimentoCarcaca: 0,
    },
  );
}

function serializeMapaPayload(draft: MapaDraft, animais: AnimalLinha[]): Record<string, string> {
  return {
    numeroMapa: draft.numeroMapa,
    dataJejum: draft.dataJejum,
    horaInicioJejum: draft.horaInicioJejum,
    horaFimJejum: draft.horaFimJejum,
    dataPesagem: draft.dataPesagem,
    horaInicioPesagem: draft.horaInicioPesagem,
    horaFimPesagem: draft.horaFimPesagem,
    qualidade: draft.qualidade,
    placa: draft.placa,
    motorista: draft.motorista,
    rendimentoCarcaca: draft.rendimentoCarcaca,
    pesoBrutoKg: draft.pesoBrutoKg,
    pesoTotalArroba: draft.pesoTotalArroba,
    pesoMedioArroba: draft.pesoMedioArroba,
    quantidadeAnimais: draft.quantidadeAnimais,
    pesoLiquidoArroba: draft.pesoLiquidoArroba,
    valorArroba: draft.valorArroba,
    valorTotal: draft.valorTotal,
    valorComissao: draft.valorComissao,
    comprador: draft.comprador,
    responsavel: draft.responsavel,
    telefoneResponsavel: draft.telefoneResponsavel,
    cpfResponsavel: draft.cpfResponsavel,
    observacao: draft.observacao,
    animaisJson: JSON.stringify(animais.map(({ ordem, quantidadeAnimal, pesoMedioKg, pesoVivoKg }) => ({ ordem, quantidadeAnimal, pesoMedioKg, pesoVivoKg }))),

    dataInicio: draft.dataPesagem,
    quantidade: draft.quantidadeAnimais,
    pesoTotalKg: draft.pesoBrutoKg,
    descricao: draft.placa || draft.motorista ? `${draft.placa} ${draft.motorista}`.trim() : "MAPA DE PESAGEM",
  };
}
