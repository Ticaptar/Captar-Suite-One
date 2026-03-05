"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { LegacyFormSkeleton } from "@/components/legacy-skeleton";
import { ModuleHeader } from "@/components/module-header";
import type { GtaRecord, GtaStatus, GtaTipo } from "@/lib/types/gta";

type GtaFormPageProps = {
  routeTipo: GtaTipo;
  title: string;
  basePath: string;
};

type TabKey = "eras" | "temporaria";

type EraRowState = {
  era: string;
  quantidade: string;
  quantidadeEntrada: string;
  quantidadeIdentificado: string;
};

type GtaTemporariaRowState = {
  descricao: string;
  quantidade: string;
  quantidadeEntrada: string;
};

type FormState = {
  tipo: GtaTipo;
  status: GtaStatus;
  numero: string;
  serie: string;
  local: string;
  contrato: string;
  estado: string;
  especie: string;
  finalidade: string;
  transporte: string;
  dataEmissao: string;
  horaEmissao: string;
  dataValidade: string;
  quantidadeMachos: string;
  quantidadeFemeas: string;
  total: string;
  totalEntrada: string;
  totalIdentificados: string;
  totalPesagem: string;
  proprietario: string;
  produtor: string;
  propriedadeOrigem: string;
  vendaInterna: boolean;
  animaisRastreados: boolean;
  valorGta: string;
  eras: EraRowState[];
  gtaTemporariaRows: GtaTemporariaRowState[];
};

type GtaPdfImportResponse = {
  numeroGta: string | null;
  serie: string | null;
  dataEmissao: string | null;
  horaEmissao: string | null;
  dataValidade: string | null;
  transporte: string | null;
  finalidade: string | null;
  especie: string | null;
  estabelecimentoOrigem: string | null;
  estabelecimentoDestino: string | null;
  localOrigem: string | null;
  localDestino: string | null;
  produtor: string | null;
  quantidadeMachos: number;
  quantidadeFemeas: number;
  quantidadeTotal: number;
  confidencePercent: number;
  warnings?: string[];
};

type ContratoAtivoItemApi = {
  id: number;
  numero: string | null;
  referenciaContrato: string | null;
};

type ContratoAtivoApiResponse = {
  items?: ContratoAtivoItemApi[];
};

type ContratoAtivoOption = {
  key: string;
  value: string;
  label: string;
};

type ContratoAtivoSource = "entrada" | "saida";

const tipoOptions: Array<{ value: GtaTipo; label: string }> = [
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
  { value: "temporaria", label: "Temporária" },
];

const statusOptions: Array<{ value: GtaStatus; label: string }> = [
  { value: "ativo", label: "Ativo" },
  { value: "desembarcado", label: "Desembarcado" },
  { value: "encerrado", label: "Encerrado" },
  { value: "cancelado", label: "Cancelado" },
];

const finalidadeOptions = ["Engorda", "Recria", "Abate", "Reposicao", "Outro"];
const transporteOptions = ["Rodoviario", "Ferroviario", "Aereo", "Outro"];
const especieOptions = ["Bovino", "Bubalino", "Ovino", "Caprino", "Suino", "Outro"];

const ERA_OPTIONS = [
  "Bovino Macho de 0 a 12 Meses",
  "Bovino Macho de 13 a 24 Meses",
  "Bovino Macho de 25 a 36 Meses",
  "Bovino Macho de 36 Meses",
  "Bovino Femea de 0 a 12 Meses",
  "Bovino Femea de 13 a 24 Meses",
  "Bovino Femea de 25 a 36 Meses",
  "Bovino Femea de 36 Meses",
];

function createEmptyForm(tipo: GtaTipo): FormState {
  return {
    tipo,
    status: "ativo",
    numero: "",
    serie: "",
    local: "",
    contrato: "",
    estado: "",
    especie: "Bovino",
    finalidade: "Engorda",
    transporte: "Rodoviario",
    dataEmissao: new Date().toISOString().slice(0, 10),
    horaEmissao: "",
    dataValidade: "",
    quantidadeMachos: "0",
    quantidadeFemeas: "0",
    total: "0",
    totalEntrada: "0",
    totalIdentificados: "0",
    totalPesagem: "0",
    proprietario: "",
    produtor: "",
    propriedadeOrigem: "",
    vendaInterna: false,
    animaisRastreados: false,
    valorGta: "0,00",
    eras: [],
    gtaTemporariaRows: [],
  };
}

export function GtaFormPage({ routeTipo, title, basePath }: GtaFormPageProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("eras");
  const [form, setForm] = useState<FormState>(() => createEmptyForm(routeTipo));
  const [showEraModal, setShowEraModal] = useState(false);
  const [showTemporariaModal, setShowTemporariaModal] = useState(false);
  const [eraDraft, setEraDraft] = useState<EraRowState>({
    era: "",
    quantidade: "0",
    quantidadeEntrada: "0",
    quantidadeIdentificado: "0",
  });
  const [temporariaDraft, setTemporariaDraft] = useState<GtaTemporariaRowState>({
    descricao: "",
    quantidade: "0",
    quantidadeEntrada: "0",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [contratoSearch, setContratoSearch] = useState("");
  const [contratoOptions, setContratoOptions] = useState<ContratoAtivoOption[]>([]);
  const [loadingContratos, setLoadingContratos] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number.parseInt(params.get("id") ?? "", 10);
    if (Number.isFinite(id) && id > 0) {
      setEditingId(id);
      return;
    }
    setEditingId(null);
    setForm(createEmptyForm(routeTipo));
  }, [routeTipo]);

  useEffect(() => {
    if (!editingId) return;
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/gta/${editingId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar GTA.");
        const data = (await response.json()) as GtaRecord;
        if (!active) return;
        setForm(recordToForm(data));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar GTA.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [editingId]);

  useEffect(() => {
    const total = String(parseInteger(form.quantidadeMachos) + parseInteger(form.quantidadeFemeas));
    setForm((prev) => {
      if (prev.total === total) return prev;
      return {
        ...prev,
        total,
      };
    });
  }, [form.quantidadeMachos, form.quantidadeFemeas]);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(async () => {
      setLoadingContratos(true);
      try {
        const search = contratoSearch.trim();
        const ts = Date.now();
        const sources = getContratoAtivoSources(form.tipo);
        const responses = await Promise.all(
          sources.map(async ({ source, url }) => {
            const params = new URLSearchParams({
              status: "ativo",
              page: "1",
              pageSize: "120",
              _ts: String(ts),
            });
            if (search) params.set("search", search);
            const response = await fetch(`${url}?${params.toString()}`, { cache: "no-store" });
            if (!response.ok) {
              return { source, items: [] as ContratoAtivoItemApi[] };
            }
            const payload = (await response.json()) as ContratoAtivoApiResponse;
            return { source, items: Array.isArray(payload.items) ? payload.items : [] };
          }),
        );

        if (!active) return;

        const loaded = responses.flatMap(({ source, items }) =>
          items.map((item) => toContratoAtivoOption(item, source, form.tipo === "temporaria")),
        );
        setContratoOptions((previous) => mergeContratoAtivoOptions(loaded, previous, form.contrato));
      } catch {
        if (!active) return;
        setContratoOptions((previous) => mergeContratoAtivoOptions([], previous, form.contrato));
      } finally {
        if (active) setLoadingContratos(false);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.tipo, form.contrato, contratoSearch]);

  const handleTipoChange = (nextTipoValue: string) => {
    const nextTipo = nextTipoValue as GtaTipo;
    setContratoSearch("");
    setForm((prev) => ({
      ...prev,
      tipo: nextTipo,
      contrato: prev.tipo === nextTipo ? prev.contrato : "",
    }));
  };

  const addEraRow = () => {
    if (!eraDraft.era.trim()) {
      setError("Informe a era para adicionar.");
      return;
    }
    setError("");
    setForm((prev) => ({
      ...prev,
      eras: [...prev.eras, eraDraft],
    }));
    setEraDraft({
      era: "",
      quantidade: "0",
      quantidadeEntrada: "0",
      quantidadeIdentificado: "0",
    });
    setShowEraModal(false);
  };

  const addTemporariaRow = () => {
    if (!temporariaDraft.descricao.trim()) {
      setError("Informe a GTA temporaria para adicionar.");
      return;
    }
    setError("");
    setForm((prev) => ({
      ...prev,
      gtaTemporariaRows: [...prev.gtaTemporariaRows, temporariaDraft],
    }));
    setTemporariaDraft({
      descricao: "",
      quantidade: "0",
      quantidadeEntrada: "0",
    });
    setShowTemporariaModal(false);
  };

  const importGtaPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setImportMessage("");

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Selecione um arquivo PDF valido.");
      return;
    }

    try {
      setImportingPdf(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/gta/importar-pdf", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as GtaPdfImportResponse | { error?: string } | null;
      if (!response.ok) {
        const message = payload && "error" in payload ? payload.error : null;
        throw new Error(message || "Falha ao importar PDF da GTA.");
      }

      const parsed = payload as GtaPdfImportResponse;
      const quantidadeMachos = Math.max(0, Math.trunc(Number(parsed.quantidadeMachos ?? 0)));
      const quantidadeFemeas = Math.max(0, Math.trunc(Number(parsed.quantidadeFemeas ?? 0)));
      const quantidadeTotalRaw = Math.max(0, Math.trunc(Number(parsed.quantidadeTotal ?? 0)));
      const quantidadeTotal = quantidadeTotalRaw > 0 ? quantidadeTotalRaw : quantidadeMachos + quantidadeFemeas;

      setForm((prev) => ({
        ...prev,
        numero: parsed.numeroGta ?? prev.numero,
        serie: parsed.serie ?? prev.serie,
        dataEmissao: parsed.dataEmissao ?? prev.dataEmissao,
        horaEmissao: parsed.horaEmissao ?? prev.horaEmissao,
        dataValidade: parsed.dataValidade ?? prev.dataValidade,
        transporte: parsed.transporte ?? prev.transporte,
        finalidade: parsed.finalidade ?? prev.finalidade,
        especie: parsed.especie ?? prev.especie,
        local:
          parsed.localOrigem && parsed.localDestino
            ? `${parsed.localOrigem} -> ${parsed.localDestino}`
            : parsed.localOrigem ?? prev.local,
        propriedadeOrigem: parsed.estabelecimentoOrigem ?? prev.propriedadeOrigem,
        produtor: parsed.produtor ?? prev.produtor,
        quantidadeMachos: String(quantidadeMachos),
        quantidadeFemeas: String(quantidadeFemeas),
        total: String(quantidadeTotal),
      }));

      const confidence = Number.isFinite(parsed.confidencePercent) ? Math.max(0, Math.trunc(parsed.confidencePercent)) : 0;
      const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter(Boolean) : [];
      const warningSuffix = warnings.length > 0 ? ` Aviso: ${warnings.join(" ")}` : "";
      setImportMessage(`PDF importado (${confidence}% de acertabilidade).${warningSuffix}`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Falha ao importar PDF da GTA.");
    } finally {
      setImportingPdf(false);
    }
  };

  const saveGta = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = formToPayload(form);
      const response = await fetch(editingId ? `/api/gta/${editingId}` : "/api/gta", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao salvar GTA.");
      }

      const saved = (await response.json()) as GtaRecord | null;
      const savedId = saved?.id ?? editingId;
      if (!savedId) {
        setSuccess("GTA salva com sucesso.");
        return;
      }
      router.push(`${basePath}?${editingId ? "updated" : "created"}=${savedId}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar GTA.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <FormPageHeader
          title={editingId ? `${title} #${editingId}` : `${title} / (Novo)`}
          subtitle="Formulário único para cadastro de GTA de entrada, saída e temporária."
          backHref={basePath}
          backLabel={title}
        />
        <ModuleHeader />

        <section className="card p-3">
          <div className="legacy-actions">
            <button type="button" className="legacy-btn primary" onClick={saveGta} disabled={saving || loading}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <Link href={basePath} className="legacy-btn">
              Descartar
            </Link>
            <button
              type="button"
              className="legacy-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || saving || importingPdf}
            >
              {importingPdf ? "Importando PDF..." : "Importar PDF GTA"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={importGtaPdf}
            />
          </div>

          {importMessage && <p className="legacy-message">{importMessage}</p>}
          {success && <p className="legacy-message success">{success}</p>}
          {error && <p className="legacy-message error">{error}</p>}
          {loading && <LegacyFormSkeleton fields={26} />}

          <fieldset disabled={loading || saving} className={`mt-2 min-w-0 border-0 p-0 ${loading ? "hidden" : ""}`}>
            <div className="legacy-grid cols-6">
              <FieldSelect
                label="Tipo"
                value={form.tipo}
                onChange={handleTipoChange}
                options={tipoOptions}
              />
              <FieldInput
                label="Número"
                value={form.numero}
                onChange={(value) => setForm((prev) => ({ ...prev, numero: value }))}
              />
              <FieldInput
                label="Série"
                value={form.serie}
                onChange={(value) => setForm((prev) => ({ ...prev, serie: value }))}
              />
              <FieldInput
                label="Local"
                className="col-span-2"
                value={form.local}
                onChange={(value) => setForm((prev) => ({ ...prev, local: value }))}
              />
              <label className="legacy-field col-span-2">
                <span>Pesquisar Contrato Ativo</span>
                <input
                  className="legacy-input"
                  placeholder="Digite ID, numero ou descricao..."
                  value={contratoSearch}
                  onChange={(event) => setContratoSearch(event.target.value)}
                />
              </label>
              <label className="legacy-field col-span-2">
                <span>Contrato Ativo (Gado)</span>
                <select
                  className="legacy-select"
                  value={form.contrato}
                  onChange={(event) => setForm((prev) => ({ ...prev, contrato: event.target.value }))}
                >
                  <option value="">Selecione contrato ativo...</option>
                  {contratoOptions.map((option) => (
                    <option key={option.key} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {loadingContratos && <small className="mt-1 block text-xs text-[#6b7394]">Carregando contratos...</small>}
                {!loadingContratos && contratoOptions.length === 0 && (
                  <small className="mt-1 block text-xs text-[#6b7394]">Nenhum contrato ativo encontrado para o filtro informado.</small>
                )}
              </label>

              <FieldSelect
                label="Status"
                value={form.status}
                onChange={(value) => setForm((prev) => ({ ...prev, status: value as GtaStatus }))}
                options={statusOptions}
              />
              <FieldSelect
                label="Espécie"
                value={form.especie}
                onChange={(value) => setForm((prev) => ({ ...prev, especie: value }))}
                options={especieOptions.map((item) => ({ value: item, label: item }))}
              />
              <FieldSelect
                label="Finalidade"
                value={form.finalidade}
                onChange={(value) => setForm((prev) => ({ ...prev, finalidade: value }))}
                options={finalidadeOptions.map((item) => ({ value: item, label: item }))}
              />
              <FieldSelect
                label="Transporte"
                value={form.transporte}
                onChange={(value) => setForm((prev) => ({ ...prev, transporte: value }))}
                options={transporteOptions.map((item) => ({ value: item, label: item }))}
              />
              <FieldInput
                label="Data de Emissão"
                type="date"
                value={form.dataEmissao}
                onChange={(value) => setForm((prev) => ({ ...prev, dataEmissao: value }))}
              />
              <FieldInput
                label="Hora de Emissão"
                type="time"
                value={form.horaEmissao}
                onChange={(value) => setForm((prev) => ({ ...prev, horaEmissao: value }))}
              />

              <FieldInput
                label="Estado"
                value={form.estado}
                onChange={(value) => setForm((prev) => ({ ...prev, estado: value }))}
              />
              <FieldInput
                label="Data de Validade"
                type="date"
                value={form.dataValidade}
                onChange={(value) => setForm((prev) => ({ ...prev, dataValidade: value }))}
              />
              <FieldInput
                label="Quantidade Machos"
                value={form.quantidadeMachos}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    quantidadeMachos: sanitizeInteger(value),
                  }))
                }
              />
              <FieldInput
                label="Quantidade Fêmeas"
                value={form.quantidadeFemeas}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    quantidadeFemeas: sanitizeInteger(value),
                  }))
                }
              />
              <FieldInput label="Total" value={form.total} onChange={() => undefined} readOnly />
              <FieldInput
                label="Total Entrada"
                value={form.totalEntrada}
                onChange={(value) => setForm((prev) => ({ ...prev, totalEntrada: sanitizeInteger(value) }))}
              />

              <FieldInput
                label="Total de Identificados"
                value={form.totalIdentificados}
                onChange={(value) => setForm((prev) => ({ ...prev, totalIdentificados: sanitizeInteger(value) }))}
              />
              <FieldInput
                label="Total Pesagem"
                value={form.totalPesagem}
                onChange={(value) => setForm((prev) => ({ ...prev, totalPesagem: sanitizeInteger(value) }))}
              />
              <FieldInput
                label="Proprietário"
                className="col-span-2"
                value={form.proprietario}
                onChange={(value) => setForm((prev) => ({ ...prev, proprietario: value }))}
              />
              <FieldInput
                label="Produtor"
                className="col-span-2"
                value={form.produtor}
                onChange={(value) => setForm((prev) => ({ ...prev, produtor: value }))}
              />
              <FieldInput
                label="Propriedade de Origem"
                className="col-span-2"
                value={form.propriedadeOrigem}
                onChange={(value) => setForm((prev) => ({ ...prev, propriedadeOrigem: value }))}
              />
              <FieldCheckbox
                label="Venda interna"
                checked={form.vendaInterna}
                onChange={(checked) => setForm((prev) => ({ ...prev, vendaInterna: checked }))}
              />
              <FieldCheckbox
                label="Animais rastreados"
                checked={form.animaisRastreados}
                onChange={(checked) => setForm((prev) => ({ ...prev, animaisRastreados: checked }))}
              />
              <FieldInput
                label="Valor GTA"
                value={form.valorGta}
                onChange={(value) => setForm((prev) => ({ ...prev, valorGta: sanitizeDecimal(value) }))}
              />
            </div>

            <div className="legacy-tabs mt-3">
              <button
                type="button"
                className={`legacy-tab ${activeTab === "eras" ? "active" : ""}`}
                onClick={() => setActiveTab("eras")}
              >
                Eras
              </button>
              <button
                type="button"
                className={`legacy-tab ${activeTab === "temporaria" ? "active" : ""}`}
                onClick={() => setActiveTab("temporaria")}
              >
                GTA Temporária
              </button>
            </div>

            {activeTab === "eras" && (
              <section className="mt-2">
                <div className="legacy-actions">
                  <button type="button" className="legacy-btn" onClick={() => setShowEraModal(true)}>
                    Adicionar
                  </button>
                </div>
                <div className="legacy-table-wrap mt-2">
                  <table className="legacy-table">
                    <thead>
                      <tr>
                        <th>Era</th>
                        <th>Quantidade</th>
                        <th>Quantidade Entrada</th>
                        <th>Quantidade Identificada</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.eras.length === 0 && (
                        <tr>
                          <td colSpan={5} className="legacy-empty">
                            Nenhuma era adicionada.
                          </td>
                        </tr>
                      )}
                      {form.eras.map((row, index) => (
                        <tr key={`${row.era}-${index}`}>
                          <td className="left">{row.era || "-"}</td>
                          <td>{toNumberLabel(row.quantidade)}</td>
                          <td>{toNumberLabel(row.quantidadeEntrada)}</td>
                          <td>{toNumberLabel(row.quantidadeIdentificado)}</td>
                          <td>
                            <button
                              type="button"
                              className="legacy-btn"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  eras: prev.eras.filter((_, rowIndex) => rowIndex !== index),
                                }))
                              }
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "temporaria" && (
              <section className="mt-2">
                <div className="legacy-actions">
                  <button type="button" className="legacy-btn" onClick={() => setShowTemporariaModal(true)}>
                    Adicionar
                  </button>
                </div>
                <div className="legacy-table-wrap mt-2">
                  <table className="legacy-table">
                    <thead>
                      <tr>
                        <th>GTA Temporária</th>
                        <th>Quantidade</th>
                        <th>Quantidade Entrada</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.gtaTemporariaRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="legacy-empty">
                            Nenhum item de GTA temporaria adicionado.
                          </td>
                        </tr>
                      )}
                      {form.gtaTemporariaRows.map((row, index) => (
                        <tr key={`${row.descricao}-${index}`}>
                          <td className="left">{row.descricao || "-"}</td>
                          <td>{toNumberLabel(row.quantidade)}</td>
                          <td>{toNumberLabel(row.quantidadeEntrada)}</td>
                          <td>
                            <button
                              type="button"
                              className="legacy-btn"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  gtaTemporariaRows: prev.gtaTemporariaRows.filter((_, rowIndex) => rowIndex !== index),
                                }))
                              }
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </fieldset>
        </section>

        {showEraModal && (
          <LegacyModal title="Adicionar Era" onClose={() => setShowEraModal(false)}>
            <div className="legacy-grid cols-4">
              <FieldSelect
                label="Era"
                className="col-span-2"
                value={eraDraft.era}
                onChange={(value) => setEraDraft((prev) => ({ ...prev, era: value }))}
                options={[{ value: "", label: "Selecione..." }, ...ERA_OPTIONS.map((item) => ({ value: item, label: item }))]}
              />
              <FieldInput
                label="Quantidade"
                value={eraDraft.quantidade}
                onChange={(value) => setEraDraft((prev) => ({ ...prev, quantidade: sanitizeInteger(value) }))}
              />
              <FieldInput
                label="Quantidade Entrada"
                value={eraDraft.quantidadeEntrada}
                onChange={(value) => setEraDraft((prev) => ({ ...prev, quantidadeEntrada: sanitizeInteger(value) }))}
              />
              <FieldInput
                label="Quantidade Identificado"
                value={eraDraft.quantidadeIdentificado}
                onChange={(value) =>
                  setEraDraft((prev) => ({
                    ...prev,
                    quantidadeIdentificado: sanitizeInteger(value),
                  }))
                }
              />
            </div>
            <div className="legacy-actions mt-3">
              <button type="button" className="legacy-btn primary" onClick={addEraRow}>
                Salvar
              </button>
              <button type="button" className="legacy-btn" onClick={() => setShowEraModal(false)}>
                Descartar
              </button>
            </div>
          </LegacyModal>
        )}

        {showTemporariaModal && (
          <LegacyModal title="Adicionar GTA Temporária" onClose={() => setShowTemporariaModal(false)}>
            <div className="legacy-grid cols-4">
              <FieldInput
                label="GTA Temporária"
                className="col-span-2"
                value={temporariaDraft.descricao}
                onChange={(value) => setTemporariaDraft((prev) => ({ ...prev, descricao: value }))}
              />
              <FieldInput
                label="Quantidade"
                value={temporariaDraft.quantidade}
                onChange={(value) => setTemporariaDraft((prev) => ({ ...prev, quantidade: sanitizeInteger(value) }))}
              />
              <FieldInput
                label="Quantidade Entrada"
                value={temporariaDraft.quantidadeEntrada}
                onChange={(value) =>
                  setTemporariaDraft((prev) => ({ ...prev, quantidadeEntrada: sanitizeInteger(value) }))
                }
              />
            </div>
            <div className="legacy-actions mt-3">
              <button type="button" className="legacy-btn primary" onClick={addTemporariaRow}>
                Salvar
              </button>
              <button type="button" className="legacy-btn" onClick={() => setShowTemporariaModal(false)}>
                Descartar
              </button>
            </div>
          </LegacyModal>
        )}
      </main>
    </div>
  );
}

function recordToForm(record: GtaRecord): FormState {
  return {
    tipo: record.tipo,
    status: record.status,
    numero: record.numero ?? "",
    serie: record.serie ?? "",
    local: record.local ?? "",
    contrato: record.contrato ?? "",
    estado: record.estado ?? "",
    especie: record.especie ?? "",
    finalidade: record.finalidade ?? "",
    transporte: record.transporte ?? "",
    dataEmissao: record.dataEmissao ?? "",
    horaEmissao: record.horaEmissao ?? "",
    dataValidade: record.dataValidade ?? "",
    quantidadeMachos: String(record.quantidadeMachos ?? 0),
    quantidadeFemeas: String(record.quantidadeFemeas ?? 0),
    total: String(record.total ?? 0),
    totalEntrada: String(record.totalEntrada ?? 0),
    totalIdentificados: String(record.totalIdentificados ?? 0),
    totalPesagem: String(record.totalPesagem ?? 0),
    proprietario: record.proprietario ?? "",
    produtor: record.produtor ?? "",
    propriedadeOrigem: record.propriedadeOrigem ?? "",
    vendaInterna: Boolean(record.vendaInterna),
    animaisRastreados: Boolean(record.animaisRastreados),
    valorGta: formatCurrency(record.valorGta ?? 0),
    eras: (record.eras ?? []).map((row) => ({
      era: row.era ?? "",
      quantidade: String(row.quantidade ?? 0),
      quantidadeEntrada: String(row.quantidadeEntrada ?? 0),
      quantidadeIdentificado: String(row.quantidadeIdentificado ?? 0),
    })),
    gtaTemporariaRows: (record.gtaTemporariaRows ?? []).map((row) => ({
      descricao: row.descricao ?? "",
      quantidade: String(row.quantidade ?? 0),
      quantidadeEntrada: String(row.quantidadeEntrada ?? 0),
    })),
  };
}

function formToPayload(form: FormState) {
  return {
    tipo: form.tipo,
    status: form.status,
    numero: toNullableString(form.numero),
    serie: toNullableString(form.serie),
    local: toNullableString(form.local),
    contrato: toNullableString(form.contrato),
    estado: toNullableString(form.estado),
    especie: toNullableString(form.especie),
    finalidade: toNullableString(form.finalidade),
    transporte: toNullableString(form.transporte),
    dataEmissao: toNullableString(form.dataEmissao),
    horaEmissao: toNullableString(form.horaEmissao),
    dataValidade: toNullableString(form.dataValidade),
    quantidadeMachos: parseInteger(form.quantidadeMachos),
    quantidadeFemeas: parseInteger(form.quantidadeFemeas),
    total: parseInteger(form.total),
    totalEntrada: parseInteger(form.totalEntrada),
    totalIdentificados: parseInteger(form.totalIdentificados),
    totalPesagem: parseInteger(form.totalPesagem),
    proprietario: toNullableString(form.proprietario),
    produtor: toNullableString(form.produtor),
    propriedadeOrigem: toNullableString(form.propriedadeOrigem),
    vendaInterna: form.vendaInterna,
    animaisRastreados: form.animaisRastreados,
    valorGta: parseDecimal(form.valorGta),
    eras: form.eras.map((row) => ({
      era: toNullableString(row.era) ?? "",
      quantidade: parseInteger(row.quantidade),
      quantidadeEntrada: parseInteger(row.quantidadeEntrada),
      quantidadeIdentificado: parseInteger(row.quantidadeIdentificado),
    })),
    gtaTemporariaRows: form.gtaTemporariaRows.map((row) => ({
      descricao: toNullableString(row.descricao) ?? "",
      quantidade: parseInteger(row.quantidade),
      quantidadeEntrada: parseInteger(row.quantidadeEntrada),
    })),
  };
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <label className={`legacy-field ${className}`}>
      <span>{label}</span>
      <input
        type={type}
        className="legacy-input"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label className={`legacy-field ${className}`}>
      <span>{label}</span>
      <select className="legacy-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="legacy-field">
      <span>{label}</span>
      <div className="legacy-inline">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      </div>
    </label>
  );
}

function LegacyModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="legacy-modal-backdrop" role="dialog" aria-modal="true">
      <div className="legacy-modal">
        <div className="legacy-modal-header">
          <h3>{title}</h3>
          <button type="button" className="legacy-btn" onClick={onClose}>
            X
          </button>
        </div>
        <div className="legacy-modal-body">{children}</div>
      </div>
    </div>
  );
}

function sanitizeInteger(value: string): string {
  return value.replace(/\D/g, "");
}

function sanitizeDecimal(value: string): string {
  const normalized = value.replace(/[^\d,.-]/g, "");
  const commaParts = normalized.split(",");
  if (commaParts.length <= 2) return normalized;
  return `${commaParts[0]},${commaParts.slice(1).join("")}`;
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(String(value ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseDecimal(value: string): number {
  const normalized = String(value ?? "").replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toNullableString(value: string): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function toNumberLabel(value: string): string {
  return new Intl.NumberFormat("pt-BR").format(parseInteger(value));
}

function getContratoAtivoSources(tipo: GtaTipo): Array<{ source: ContratoAtivoSource; url: string }> {
  if (tipo === "entrada") {
    return [{ source: "entrada", url: "/api/contratos/entrada-animais" }];
  }
  if (tipo === "saida") {
    return [{ source: "saida", url: "/api/contratos/saida-animais" }];
  }
  return [
    { source: "entrada", url: "/api/contratos/entrada-animais" },
    { source: "saida", url: "/api/contratos/saida-animais" },
  ];
}

function toContratoAtivoOption(
  item: ContratoAtivoItemApi,
  source: ContratoAtivoSource,
  includeSourcePrefix: boolean,
): ContratoAtivoOption {
  const id = Number(item.id);
  const numero = String(item.numero ?? "").trim() || "S/N";
  const referencia = String(item.referenciaContrato ?? "").trim() || "-";
  const baseLabel = `#${id} | ${numero} | ${referencia}`;
  const prefix = includeSourcePrefix ? `[${source === "entrada" ? "ENTRADA" : "SAIDA"}] ` : "";
  const label = `${prefix}${baseLabel}`;
  return {
    key: `${source}:${id}`,
    value: label,
    label,
  };
}

function mergeContratoAtivoOptions(
  loaded: ContratoAtivoOption[],
  previous: ContratoAtivoOption[],
  selectedValue: string,
): ContratoAtivoOption[] {
  const merged = new Map<string, ContratoAtivoOption>();
  for (const option of loaded) {
    if (!merged.has(option.value)) merged.set(option.value, option);
  }

  const selected = selectedValue.trim();
  if (selected && !merged.has(selected)) {
    const previousSelected = previous.find((option) => option.value === selected);
    merged.set(
      selected,
      previousSelected ?? {
        key: `manual:${selected}`,
        value: selected,
        label: selected,
      },
    );
  }

  return Array.from(merged.values());
}
