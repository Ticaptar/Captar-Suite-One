"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  contrato: {
    id: number;
    numero?: string | null;
    descricao?: string | null;
    parceiro_nome_base?: string | null;
    dadosGerais?: {
      animaisMapa?: number | null;
      pesoMapaKg?: number | null;
    };
  };
  mapas?: Record<string, string>[];
};

type MapaLinha = {
  idLocal: string;
  dataInicio: string;
  placa: string;
  motorista: string;
  quantidade: string;
  pesoTotalKg: string;
  observacao: string;
};

type MapaDraft = Omit<MapaLinha, "idLocal">;

const EMPTY_DRAFT: MapaDraft = {
  dataInicio: "",
  placa: "",
  motorista: "",
  quantidade: "",
  pesoTotalKg: "",
  observacao: "",
};

export default function MapaPesagemPage() {
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
  const [searchTerm, setSearchTerm] = useState("");

  const [mapas, setMapas] = useState<MapaLinha[]>([]);
  const [draft, setDraft] = useState<MapaDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(true);
  const [resumoContrato, setResumoContrato] = useState<ContratoDetalheResponse["contrato"] | null>(null);

  useEffect(() => {
    if (!contratoIdFromQuery) return;
    setSelectedContratoId(contratoIdFromQuery);
  }, [contratoIdFromQuery]);

  useEffect(() => {
    setOnline(window.navigator.onLine);
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadContratos = useCallback(async () => {
    setLoadingContratos(true);
    setError("");
    try {
      const response = await fetch("/api/contratos/entrada-animais?page=1&pageSize=100", {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao carregar contratos.");
      }
      const data = (await response.json()) as ListaResponse;
      setContratos(data.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar contratos.");
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
      setMapas([]);
      setResumoContrato(null);
      return;
    }

    setLoadingDetalhe(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/contratos/entrada-animais/${selectedContratoId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao carregar mapa do contrato.");
      }

      const data = (await response.json()) as ContratoDetalheResponse;
      setResumoContrato(data.contrato ?? null);
      setMapas(
        (data.mapas ?? []).map((row, index) => ({
          idLocal: `${Date.now()}-${index}`,
          dataInicio: row.dataInicio ?? row.dtInicio ?? row.dt_inicio ?? "",
          placa: row.placa ?? "",
          motorista: row.motorista ?? "",
          quantidade: row.quantidade ?? row.qt ?? "",
          pesoTotalKg: row.pesoTotalKg ?? row.pesoKg ?? row.peso_mapa_kg ?? "",
          observacao: row.observacao ?? row.descricao ?? "",
        })),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar dados do contrato.");
      setMapas([]);
      setResumoContrato(null);
    } finally {
      setLoadingDetalhe(false);
    }
  }, [selectedContratoId]);

  useEffect(() => {
    loadContratoDetalhe().catch(() => undefined);
  }, [loadContratoDetalhe]);

  const contratosFiltrados = useMemo(() => {
    const normalized = normalizeSearch(searchTerm);
    if (!normalized) return contratos;
    return contratos.filter((item) => {
      return (
        normalizeSearch(item.referenciaContrato).includes(normalized) ||
        normalizeSearch(item.numero).includes(normalized) ||
        normalizeSearch(item.parceiro ?? "").includes(normalized) ||
        String(item.id).includes(normalized)
      );
    });
  }, [contratos, searchTerm]);

  const totais = useMemo(() => {
    return mapas.reduce(
      (acc, row) => {
        acc.animais += parseDecimalBr(row.quantidade);
        acc.pesoKg += parseDecimalBr(row.pesoTotalKg);
        return acc;
      },
      { animais: 0, pesoKg: 0 },
    );
  }, [mapas]);

  function addMapa() {
    if (!draft.dataInicio || !draft.quantidade) {
      setError("Informe data e quantidade para adicionar o mapa.");
      return;
    }
    setError("");
    setMessage("");
    setMapas((prev) => [
      ...prev,
      {
        ...draft,
        idLocal: `mapa-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
    ]);
    setDraft(EMPTY_DRAFT);
  }

  function removeMapa(idLocal: string) {
    setMapas((prev) => prev.filter((row) => row.idLocal !== idLocal));
  }

  function iniciarNovoMapa() {
    if (!selectedContratoId) {
      setError("Selecione um contrato.");
      return;
    }
    setError("");
    setMessage("Novo mapa iniciado. Adicione as linhas e salve.");
    setDraft(EMPTY_DRAFT);
    setMapas([]);
  }

  async function salvarMapas() {
    if (!selectedContratoId) {
      setError("Selecione um contrato.");
      return;
    }
    if (!online) {
      setError("Sem conexão no momento. Reconecte para salvar.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payloadMapas = mapas.map((row) => ({
        dataInicio: row.dataInicio,
        quantidade: toDecimalString(parseDecimalBr(row.quantidade)),
        placa: row.placa,
        motorista: row.motorista,
        pesoTotalKg: toDecimalString(parseDecimalBr(row.pesoTotalKg)),
        observacao: row.observacao,
        descricao: row.placa || row.motorista ? `${row.placa} ${row.motorista}`.trim() : "Mapa de pesagem",
      }));

      const response = await fetch(`/api/contratos/entrada-animais/${selectedContratoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapas: payloadMapas,
          dadosGerais: {
            animaisMapa: totais.animais,
            pesoMapaKg: totais.pesoKg,
          },
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao salvar mapas.");
      }

      setMessage("Mapa de pesagem salvo com sucesso.");
      await loadContratoDetalhe();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar mapas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell mapa-pesagem-page min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <FormPageHeader
          title="Mapa de Pesagem"
          subtitle="Cadastro responsivo para embarque, vinculado ao contrato de entrada de animais."
          backHref="/contratos/entrada-animais"
          backLabel="Contratos"
        />
        <ModuleHeader />

        <section className="card p-3 mapa-pesagem-card">
          <div className="legacy-toolbar">
            <div className="legacy-toolbar-left">
              <h1 className="legacy-title">Mapa de Pesagem</h1>
              <p className="status-detail">
                Selecione o contrato e preencha os mapas do embarque.
              </p>
            </div>
            <div className="legacy-toolbar-right mapa-pesagem-toolbar-right">
              <input
                className="legacy-input"
                placeholder="Buscar contrato por id, numero, parceiro..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <select
                className="legacy-select"
                value={selectedContratoId}
                onChange={(event) => setSelectedContratoId(event.target.value)}
                disabled={loadingContratos}
              >
                <option value="">Selecione o contrato</option>
                {contratosFiltrados.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id} | {item.numero || "s/n"} | {item.parceiro ?? "Sem parceiro"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!online && <p className="legacy-message error">Modo offline ativo. O salvamento exige conexão.</p>}
          {error && <p className="legacy-message error">{error}</p>}
          {message && <p className="legacy-message success">{message}</p>}

          {selectedContratoId && (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <article className="card p-3 md:col-span-2">
                <p className="status-label">Contrato</p>
                <p className="status-title">{resumoContrato?.descricao ?? "-"}</p>
                <p className="status-detail">
                  Numero: {resumoContrato?.numero ?? "-"} | Parceiro: {resumoContrato?.parceiro_nome_base ?? "-"}
                </p>
              </article>
              <article className="card p-3">
                <p className="status-label">Resumo do Mapa</p>
                <p className="status-title">{toNumberBr(totais.animais)} animais</p>
                <p className="status-detail">{toNumberBr(totais.pesoKg)} kg</p>
              </article>
            </div>
          )}

          {selectedContratoId && (
            <div className="legacy-form mt-3 mapa-pesagem-form">
              <div className="legacy-grid cols-4">
                <label className="legacy-field">
                  <span>Data Pesagem</span>
                  <input
                    type="date"
                    className="legacy-input"
                    value={draft.dataInicio}
                    onChange={(event) => setDraft((prev) => ({ ...prev, dataInicio: event.target.value }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Placa</span>
                  <input
                    className="legacy-input"
                    value={draft.placa}
                    onChange={(event) => setDraft((prev) => ({ ...prev, placa: event.target.value.toUpperCase() }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Motorista</span>
                  <input
                    className="legacy-input"
                    value={draft.motorista}
                    onChange={(event) => setDraft((prev) => ({ ...prev, motorista: event.target.value }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Quantidade de Animais</span>
                  <input
                    className="legacy-input"
                    value={draft.quantidade}
                    onChange={(event) => setDraft((prev) => ({ ...prev, quantidade: onlyDecimal(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field">
                  <span>Peso Total (kg)</span>
                  <input
                    className="legacy-input"
                    value={draft.pesoTotalKg}
                    onChange={(event) => setDraft((prev) => ({ ...prev, pesoTotalKg: onlyDecimal(event.target.value) }))}
                  />
                </label>
                <label className="legacy-field col-span-3">
                  <span>Observacao</span>
                  <input
                    className="legacy-input"
                    value={draft.observacao}
                    onChange={(event) => setDraft((prev) => ({ ...prev, observacao: event.target.value }))}
                  />
                </label>
              </div>
              <div className="legacy-actions mt-3 mapa-pesagem-actions">
                <button type="button" className="legacy-btn" onClick={addMapa}>
                  Adicionar Linha
                </button>
                <button type="button" className="legacy-btn" onClick={iniciarNovoMapa}>
                  Novo Mapa
                </button>
                <button
                  type="button"
                  className="legacy-btn primary"
                  onClick={salvarMapas}
                  disabled={saving || loadingDetalhe || !selectedContratoId}
                >
                  {saving ? "Salvando..." : "Salvar no Contrato"}
                </button>
              </div>
            </div>
          )}

          <div className="itens-table-wrap mt-3 mapa-pesagem-table-wrap">
            <table className="itens-table mapa-pesagem-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Placa</th>
                  <th>Motorista</th>
                  <th>Qtd Animais</th>
                  <th>Peso (kg)</th>
                  <th>Observacao</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {(loadingContratos || loadingDetalhe) && (
                  <tr>
                    <td colSpan={7} className="itens-empty" data-label="">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!loadingContratos && !loadingDetalhe && !selectedContratoId && (
                  <tr>
                    <td colSpan={7} className="itens-empty" data-label="">
                      Selecione um contrato para iniciar o mapa de pesagem.
                    </td>
                  </tr>
                )}
                {!loadingContratos && !loadingDetalhe && Boolean(selectedContratoId) && mapas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="itens-empty" data-label="">
                      Nenhum mapa cadastrado.
                    </td>
                  </tr>
                )}
                {!loadingContratos &&
                  !loadingDetalhe &&
                  mapas.map((row) => (
                    <tr key={row.idLocal}>
                      <td data-label="Data">{toDateLabel(row.dataInicio)}</td>
                      <td data-label="Placa">{row.placa || "-"}</td>
                      <td className="left" data-label="Motorista">{row.motorista || "-"}</td>
                      <td data-label="Qtd Animais">{row.quantidade || "0"}</td>
                      <td data-label="Peso (kg)">{row.pesoTotalKg || "0"}</td>
                      <td className="left" data-label="Observação">{row.observacao || "-"}</td>
                      <td className="action-cell" data-label="Ações">
                        <button type="button" className="legacy-btn" onClick={() => removeMapa(row.idLocal)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
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

function parseDecimalBr(value: string): number {
  const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toDecimalString(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

function onlyDecimal(value: string): string {
  return value.replace(/[^0-9.,-]/g, "").replace(",", ".");
}

function toNumberBr(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function toDateLabel(value: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}
