"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import { preloadPnCatalog, queryPnCatalog } from "@/lib/pn-catalog-client";
import type { FrotaViagemRecord, FrotaViagemStatus } from "@/lib/types/frota-viagem";

type ContratoOption = { id: number; numero: string | null; descricao: string | null };
type CatalogOption = { value: string; label: string };
type EquipamentoOption = { id: string; codigo: string | null; descricao: string };
type CidadeOption = { codigo: string; nome: string; uf: string; label: string };
type ParceiroOption = { id: number; codigo: string | null; nome: string; documento: string | null };
type CidadeApiResponse = { items?: CidadeOption[] };

type FormState = {
  numero: string;
  status: FrotaViagemStatus;
  equipamentoId: string;
  equipamentoDescricao: string;
  reboque: string;
  rota: string;
  motorista: string;
  responsavel: string;
  contratoId: string;
  contratoReferencia: string;
  transportadorId: string;
  transportadorNome: string;
  dataSaida: string;
  dataRetorno: string;
  dataValidade: string;
  motivo: string;
  localOrigem: string;
  localDestino: string;
  condicaoPagamentoId: string;
  condicaoPagamento: string;
  excessos: string;
  kmPrevisto: string;
  kmReal: string;
  pesoPrevisto: string;
  pesoRealizado: string;
  cidadeOrigemCodigo: string;
  cidadeOrigemNome: string;
  cidadeDestinoCodigo: string;
  cidadeDestinoNome: string;
  odometroSaida: string;
  observacao: string;
  declaracaoResponsabilidade: string;
};

const EMPTY_FORM: FormState = {
  numero: "",
  status: "rascunho",
  equipamentoId: "",
  equipamentoDescricao: "",
  reboque: "",
  rota: "",
  motorista: "",
  responsavel: "",
  contratoId: "",
  contratoReferencia: "",
  transportadorId: "",
  transportadorNome: "",
  dataSaida: "",
  dataRetorno: "",
  dataValidade: "",
  motivo: "",
  localOrigem: "",
  localDestino: "",
  condicaoPagamentoId: "",
  condicaoPagamento: "",
  excessos: "",
  kmPrevisto: "0,00",
  kmReal: "0,00",
  pesoPrevisto: "0,00",
  pesoRealizado: "0,00",
  cidadeOrigemCodigo: "",
  cidadeOrigemNome: "",
  cidadeDestinoCodigo: "",
  cidadeDestinoNome: "",
  odometroSaida: "0,00",
  observacao: "",
  declaracaoResponsabilidade: "",
};

const statusOptions: Array<{ value: FrotaViagemStatus; label: string }> = [
  { value: "rascunho", label: "Rascunho" },
  { value: "aprovado", label: "Aprovado" },
  { value: "encerrado", label: "Encerrado" },
  { value: "cancelado", label: "Cancelado" },
];

export default function FrotaViagemSaidaFormPage() {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [contratos, setContratos] = useState<ContratoOption[]>([]);
  const [contratoSearch, setContratoSearch] = useState("");
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [equipamentoSearch, setEquipamentoSearch] = useState("");
  const [condicoesPagamento, setCondicoesPagamento] = useState<CatalogOption[]>([]);
  const [condicaoSearch, setCondicaoSearch] = useState("");
  const [transportadores, setTransportadores] = useState<ParceiroOption[]>([]);
  const [transportadorSearch, setTransportadorSearch] = useState("");
  const [cidadesOrigem, setCidadesOrigem] = useState<CidadeOption[]>([]);
  const [cidadeOrigemSearch, setCidadeOrigemSearch] = useState("");
  const [cidadesDestino, setCidadesDestino] = useState<CidadeOption[]>([]);
  const [cidadeDestinoSearch, setCidadeDestinoSearch] = useState("");

  const contratoLabel = useMemo(
    () => contratos.find((item) => String(item.id) === form.contratoId)?.descricao ?? "",
    [contratos, form.contratoId],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number.parseInt(params.get("id") ?? "", 10);
    if (Number.isFinite(id) && id > 0) setEditingId(id);
  }, []);

  useEffect(() => {
    async function loadInitial() {
      const ts = Date.now();
      const [contratosRes, catalogRes, cidadesRes, parceirosSeed] = await Promise.all([
        fetch(`/api/frota/viagens/opcoes?contratoLimit=120&_ts=${ts}`, { cache: "no-store" }),
        fetch(`/api/cadastros/contratos/item-opcoes?limit=1200&_ts=${ts}`, { cache: "no-store" }),
        fetch(`/api/frota/cidades?limit=180&_ts=${ts}`, { cache: "no-store" }),
        preloadPnCatalog(false),
      ]);

      if (contratosRes.ok) {
        const payload = (await contratosRes.json()) as { contratos?: ContratoOption[] };
        setContratos(Array.isArray(payload.contratos) ? payload.contratos : []);
      }
      if (catalogRes.ok) {
        const payload = (await catalogRes.json()) as { itens?: CatalogOption[]; condicoesPagamento?: CatalogOption[] };
        setEquipamentos(mapCatalogOptions(payload.itens ?? []));
        setCondicoesPagamento(dedupeCatalog(payload.condicoesPagamento ?? []));
      }
      if (cidadesRes.ok) {
        const payload = (await cidadesRes.json()) as CidadeApiResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];
        setCidadesOrigem(items);
        setCidadesDestino(items);
      }
      setTransportadores((parceirosSeed as ParceiroOption[]).slice(0, 260));
    }

    loadInitial().catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const ts = Date.now();
      const response = await fetch(
        `/api/frota/viagens/opcoes?contratoLimit=120&contratoSearch=${encodeURIComponent(contratoSearch.trim())}&_ts=${ts}`,
        { cache: "no-store" },
      );
      if (!response.ok || !active) return;
      const payload = (await response.json()) as { contratos?: ContratoOption[] };
      setContratos(Array.isArray(payload.contratos) ? payload.contratos : []);
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [contratoSearch]);

  useEffect(() => {
    const term = equipamentoSearch.trim();
    if (!term) return;
    let active = true;
    const timer = setTimeout(async () => {
      const ts = Date.now();
      const response = await fetch(
        `/api/cadastros/contratos/item-opcoes?itemSearch=${encodeURIComponent(term)}&limit=1200&_ts=${ts}`,
        { cache: "no-store" },
      );
      if (!response.ok || !active) return;
      const payload = (await response.json()) as { itens?: CatalogOption[] };
      setEquipamentos(mapCatalogOptions(payload.itens ?? []));
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [equipamentoSearch]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const ts = Date.now();
      const response = await fetch(
        `/api/cadastros/contratos/item-opcoes?condicaoPagamento=${encodeURIComponent(condicaoSearch.trim())}&limit=1200&_ts=${ts}`,
        { cache: "no-store" },
      );
      if (!response.ok || !active) return;
      const payload = (await response.json()) as { condicoesPagamento?: CatalogOption[] };
      setCondicoesPagamento(dedupeCatalog(payload.condicoesPagamento ?? []));
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [condicaoSearch]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const data = (await queryPnCatalog(transportadorSearch.trim(), {
        emptyLimit: 180,
        searchLimit: 260,
      })) as ParceiroOption[];
      if (active) setTransportadores(Array.isArray(data) ? data : []);
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [transportadorSearch]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const ts = Date.now();
      const response = await fetch(`/api/frota/cidades?limit=220&search=${encodeURIComponent(cidadeOrigemSearch)}&_ts=${ts}`, {
        cache: "no-store",
      });
      if (!response.ok || !active) return;
      const payload = (await response.json()) as CidadeApiResponse;
      setCidadesOrigem(Array.isArray(payload.items) ? payload.items : []);
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cidadeOrigemSearch]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const ts = Date.now();
      const response = await fetch(`/api/frota/cidades?limit=220&search=${encodeURIComponent(cidadeDestinoSearch)}&_ts=${ts}`, {
        cache: "no-store",
      });
      if (!response.ok || !active) return;
      const payload = (await response.json()) as CidadeApiResponse;
      setCidadesDestino(Array.isArray(payload.items) ? payload.items : []);
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cidadeDestinoSearch]);

  useEffect(() => {
    if (!editingId) return;
    let active = true;

    async function loadRecord() {
      setLoading(true);
      const response = await fetch(`/api/frota/viagens/${editingId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao carregar viagem.");
      const data = (await response.json()) as FrotaViagemRecord;
      if (!active) return;
      setForm(recordToForm(data));
      setContratos((previous) => upsertContratoOption(previous, data.contratoId, data.contratoReferencia));
      setEquipamentos((previous) => upsertEquipamentoOption(previous, data.equipamentoId, data.equipamentoDescricao));
      setCondicoesPagamento((previous) =>
        upsertCatalogOption(previous, data.condicaoPagamentoId, data.condicaoPagamento),
      );
      setCidadesOrigem((previous) =>
        upsertCidadeOption(previous, data.cidadeOrigemCodigo, data.cidadeOrigemNome),
      );
      setCidadesDestino((previous) =>
        upsertCidadeOption(previous, data.cidadeDestinoCodigo, data.cidadeDestinoNome),
      );
      setTransportadores((previous) =>
        upsertParceiroOption(previous, Number(data.transportadorId ?? 0), String(data.transportadorNome ?? "")),
      );
    }

    loadRecord()
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar viagem."))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [editingId]);

  useEffect(() => {
    if (editingId || form.dataSaida) return;
    setForm((previous) => ({ ...previous, dataSaida: new Date().toISOString().slice(0, 10) }));
  }, [editingId, form.dataSaida]);

  async function salvar() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        contratoId: toNullableIntAllowNegative(form.contratoId),
        transportadorId: toNullableIntAllowNegative(form.transportadorId),
        kmPrevisto: parseDecimal(form.kmPrevisto),
        kmReal: parseDecimal(form.kmReal),
        pesoPrevisto: parseDecimal(form.pesoPrevisto),
        pesoRealizado: parseDecimal(form.pesoRealizado),
        odometroSaida: parseDecimal(form.odometroSaida),
      };

      const response = await fetch(editingId ? `/api/frota/viagens/${editingId}` : "/api/frota/viagens", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao salvar viagem.");
      }
      const data = (await response.json()) as { id?: number };
      router.push(`/frota/viagem-saida?${editingId ? "updated" : "created"}=${data.id ?? editingId ?? ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar viagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <FormPageHeader title={editingId ? `Viagem/Saida #${editingId}` : "Viagem/Saida / (Novo)"} subtitle="Cadastro de viagem de saida da frota." backHref="/frota/viagem-saida" backLabel="Viagem/Saida" />
        <ModuleHeader />
        <section className="card p-3">
          <div className="legacy-actions">
            <button type="button" className="legacy-btn primary" onClick={salvar} disabled={saving || loading}>{saving ? "Salvando..." : "Salvar"}</button>
            <button type="button" className="legacy-btn" onClick={() => router.push("/frota/viagem-saida")}>Cancelar</button>
          </div>
          {error && <p className="legacy-message error">{error}</p>}

          <fieldset disabled={saving || loading} className="mt-2 border-0 p-0">
            <div className="legacy-grid cols-4">
              <FieldSelect label="Status" value={form.status} options={statusOptions} onChange={(value) => setForm((p) => ({ ...p, status: value as FrotaViagemStatus }))} />
              <FieldInput label="Numero" value={form.numero} onChange={(value) => setForm((p) => ({ ...p, numero: value }))} />
              <SearchField label="Pesquisar Equipamento (SAP)" className="col-span-2" value={equipamentoSearch} onChange={setEquipamentoSearch} />
              <FieldSelect label="Equipamento (SAP)" className="col-span-2" value={form.equipamentoId} options={equipamentos.map((item) => ({ value: item.id, label: `${item.codigo ? `${item.codigo} - ` : ""}${item.descricao}` }))} onChange={(value) => { const selected = equipamentos.find((item) => item.id === value); setForm((p) => ({ ...p, equipamentoId: value, equipamentoDescricao: selected?.descricao ?? p.equipamentoDescricao })); }} />
              <FieldInput label="Reboque" value={form.reboque} onChange={(value) => setForm((p) => ({ ...p, reboque: value }))} />
              <FieldInput label="Rota" value={form.rota} onChange={(value) => setForm((p) => ({ ...p, rota: value }))} />
              <FieldInput label="Motorista" value={form.motorista} onChange={(value) => setForm((p) => ({ ...p, motorista: value }))} />
              <FieldInput label="Responsavel" value={form.responsavel} onChange={(value) => setForm((p) => ({ ...p, responsavel: value }))} />
              <SearchField label="Pesquisar Contrato Ativo" className="col-span-2" value={contratoSearch} onChange={setContratoSearch} />
              <FieldSelect label="Contrato" className="col-span-2" value={form.contratoId} options={contratos.map((item) => ({ value: String(item.id), label: `#${item.id} | ${item.numero || "S/N"} | ${item.descricao || "-"}` }))} onChange={(value) => { const selected = contratos.find((item) => String(item.id) === value); setForm((p) => ({ ...p, contratoId: value, contratoReferencia: selected?.descricao ?? p.contratoReferencia })); }} />
              <SearchField label="Pesquisar Transportador (PN)" value={transportadorSearch} onChange={setTransportadorSearch} />
              <FieldSelect label="Transportador (PN)" value={form.transportadorId} options={transportadores.map((item) => ({ value: String(item.id), label: `${item.codigo ?? "SEM-COD"} - ${item.nome}` }))} onChange={(value) => { const selected = transportadores.find((item) => String(item.id) === value); setForm((p) => ({ ...p, transportadorId: value, transportadorNome: selected?.nome ?? p.transportadorNome })); }} />
              <FieldInput label="Data Saida" type="date" value={form.dataSaida} onChange={(value) => setForm((p) => ({ ...p, dataSaida: value }))} />
              <FieldInput label="Data Retorno" type="date" value={form.dataRetorno} onChange={(value) => setForm((p) => ({ ...p, dataRetorno: value }))} />
              <FieldInput label="Data Validade" type="date" value={form.dataValidade} onChange={(value) => setForm((p) => ({ ...p, dataValidade: value }))} />
              <FieldInput label="Motivo" value={form.motivo} onChange={(value) => setForm((p) => ({ ...p, motivo: value }))} />
              <FieldInput label="Local Origem" value={form.localOrigem} onChange={(value) => setForm((p) => ({ ...p, localOrigem: value }))} />
              <FieldInput label="Local Destino" value={form.localDestino} onChange={(value) => setForm((p) => ({ ...p, localDestino: value }))} />
              <SearchField label="Pesquisar Condicao Pagamento (SAP)" className="col-span-2" value={condicaoSearch} onChange={setCondicaoSearch} />
              <FieldSelect label="Condicao Pagamento (SAP)" className="col-span-2" value={form.condicaoPagamentoId} options={condicoesPagamento} onChange={(value) => { const selected = condicoesPagamento.find((item) => item.value === value); setForm((p) => ({ ...p, condicaoPagamentoId: value, condicaoPagamento: selected?.label ?? p.condicaoPagamento })); }} />
              <FieldInput label="Excessos" value={form.excessos} onChange={(value) => setForm((p) => ({ ...p, excessos: value }))} />
              <FieldInput label="KM Previsto" value={form.kmPrevisto} onChange={(value) => setForm((p) => ({ ...p, kmPrevisto: sanitizeDecimal(value) }))} />
              <FieldInput label="KM Real" value={form.kmReal} onChange={(value) => setForm((p) => ({ ...p, kmReal: sanitizeDecimal(value) }))} />
              <FieldInput label="Peso Previsto" value={form.pesoPrevisto} onChange={(value) => setForm((p) => ({ ...p, pesoPrevisto: sanitizeDecimal(value) }))} />
              <FieldInput label="Peso Realizado" value={form.pesoRealizado} onChange={(value) => setForm((p) => ({ ...p, pesoRealizado: sanitizeDecimal(value) }))} />
              <SearchField label="Pesquisar Cidade Origem" value={cidadeOrigemSearch} onChange={setCidadeOrigemSearch} />
              <FieldSelect label="Cidade Origem" value={form.cidadeOrigemCodigo} options={cidadesOrigem.map((item) => ({ value: item.codigo, label: item.label }))} onChange={(value) => { const selected = cidadesOrigem.find((item) => item.codigo === value); setForm((p) => ({ ...p, cidadeOrigemCodigo: value, cidadeOrigemNome: selected?.nome ?? p.cidadeOrigemNome })); }} />
              <SearchField label="Pesquisar Cidade Destino" value={cidadeDestinoSearch} onChange={setCidadeDestinoSearch} />
              <FieldSelect label="Cidade Destino" value={form.cidadeDestinoCodigo} options={cidadesDestino.map((item) => ({ value: item.codigo, label: item.label }))} onChange={(value) => { const selected = cidadesDestino.find((item) => item.codigo === value); setForm((p) => ({ ...p, cidadeDestinoCodigo: value, cidadeDestinoNome: selected?.nome ?? p.cidadeDestinoNome })); }} />
              <FieldInput label="Odometro Saida" value={form.odometroSaida} onChange={(value) => setForm((p) => ({ ...p, odometroSaida: sanitizeDecimal(value) }))} />
              <FieldTextArea label="Observacao" className="col-span-2" value={form.observacao} onChange={(value) => setForm((p) => ({ ...p, observacao: value }))} />
              <FieldTextArea label="Declaracao de Responsabilidade" className="col-span-2" value={form.declaracaoResponsabilidade} onChange={(value) => setForm((p) => ({ ...p, declaracaoResponsabilidade: value }))} />
            </div>
            {contratoLabel && <p className="legacy-message mt-2">Contrato selecionado: {contratoLabel}</p>}
          </fieldset>
        </section>
      </main>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; className?: string }) {
  return <label className={`legacy-field ${className}`}><span>{label}</span><input type={type} className="legacy-input" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function FieldTextArea({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`legacy-field ${className}`}><span>{label}</span><textarea className="legacy-textarea" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function SearchField({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`legacy-field ${className}`}><span>{label}</span><input className="legacy-input" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function FieldSelect({ label, value, options, onChange, className = "" }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; className?: string }) {
  return <label className={`legacy-field ${className}`}><span>{label}</span><select className="legacy-select" value={value} onChange={(e) => onChange(e.target.value)}><option value="">Selecione...</option>{options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}</select></label>;
}

function mapCatalogOptions(options: CatalogOption[]): EquipamentoOption[] {
  const mapped = options.map((option, index) => {
    const rawLabel = String(option.label ?? "").trim();
    const [maybeCode, ...rest] = rawLabel.split(" - ");
    const hasCode = rest.length > 0;
    return {
      id: String(option.value ?? `catalog-${index}`),
      codigo: hasCode ? maybeCode.trim() : null,
      descricao: hasCode ? rest.join(" - ").trim() : rawLabel,
    };
  });
  const seen = new Set<string>();
  return mapped.filter((item) => {
    const key = `${item.id}|${item.descricao}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeCatalog(options: CatalogOption[]): CatalogOption[] {
  const seen = new Set<string>();
  const unique: CatalogOption[] = [];
  for (const option of options) {
    const value = String(option.value ?? "").trim();
    const label = String(option.label ?? "").trim();
    if (!value || !label) continue;
    const key = `${value}|${label}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ value, label });
  }
  return unique;
}

function recordToForm(record: FrotaViagemRecord): FormState {
  return {
    numero: toText(record.numero),
    status: record.status,
    equipamentoId: toText(record.equipamentoId),
    equipamentoDescricao: toText(record.equipamentoDescricao),
    reboque: toText(record.reboque),
    rota: toText(record.rota),
    motorista: toText(record.motorista),
    responsavel: toText(record.responsavel),
    contratoId: record.contratoId ? String(record.contratoId) : "",
    contratoReferencia: toText(record.contratoReferencia),
    transportadorId: record.transportadorId ? String(record.transportadorId) : "",
    transportadorNome: toText(record.transportadorNome),
    dataSaida: toDateInput(record.dataSaida),
    dataRetorno: toDateInput(record.dataRetorno),
    dataValidade: toDateInput(record.dataValidade),
    motivo: toText(record.motivo),
    localOrigem: toText(record.localOrigem),
    localDestino: toText(record.localDestino),
    condicaoPagamentoId: toText(record.condicaoPagamentoId),
    condicaoPagamento: toText(record.condicaoPagamento),
    excessos: toText(record.excessos),
    kmPrevisto: formatDecimal(record.kmPrevisto),
    kmReal: formatDecimal(record.kmReal),
    pesoPrevisto: formatDecimal(record.pesoPrevisto),
    pesoRealizado: formatDecimal(record.pesoRealizado),
    cidadeOrigemCodigo: toText(record.cidadeOrigemCodigo),
    cidadeOrigemNome: toText(record.cidadeOrigemNome),
    cidadeDestinoCodigo: toText(record.cidadeDestinoCodigo),
    cidadeDestinoNome: toText(record.cidadeDestinoNome),
    odometroSaida: formatDecimal(record.odometroSaida),
    observacao: toText(record.observacao),
    declaracaoResponsabilidade: toText(record.declaracaoResponsabilidade),
  };
}

function upsertContratoOption(
  current: ContratoOption[],
  id: number | null,
  descricao: string | null,
): ContratoOption[] {
  if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) return current;
  if (current.some((item) => item.id === id)) return current;
  return [{ id, numero: null, descricao: descricao ?? null }, ...current];
}

function upsertEquipamentoOption(
  current: EquipamentoOption[],
  id: string | null,
  descricao: string | null,
): EquipamentoOption[] {
  const parsedId = String(id ?? "").trim();
  const parsedDescricao = String(descricao ?? "").trim();
  if (!parsedId || !parsedDescricao) return current;
  if (current.some((item) => item.id === parsedId)) return current;
  return [{ id: parsedId, codigo: null, descricao: parsedDescricao }, ...current];
}

function upsertCatalogOption(current: CatalogOption[], value: string | null, label: string | null): CatalogOption[] {
  const parsedValue = String(value ?? "").trim();
  const parsedLabel = String(label ?? "").trim();
  if (!parsedValue || !parsedLabel) return current;
  if (current.some((item) => item.value === parsedValue)) return current;
  return [{ value: parsedValue, label: parsedLabel }, ...current];
}

function upsertCidadeOption(current: CidadeOption[], codigo: string | null, nome: string | null): CidadeOption[] {
  const parsedCodigo = String(codigo ?? "").trim();
  const parsedNome = String(nome ?? "").trim();
  if (!parsedCodigo || !parsedNome) return current;
  if (current.some((item) => item.codigo === parsedCodigo)) return current;
  return [{ codigo: parsedCodigo, nome: parsedNome, uf: "", label: parsedNome }, ...current];
}

function upsertParceiroOption(current: ParceiroOption[], id: number, nome: string): ParceiroOption[] {
  if (!Number.isFinite(id) || id === 0 || !nome.trim()) return current;
  if (current.some((item) => item.id === id)) return current;
  return [{ id, codigo: null, nome: nome.trim(), documento: null }, ...current];
}

function parseDecimal(value: string): number {
  const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeDecimal(value: string): string {
  return value.replace(/[^0-9,.-]/g, "");
}

function formatDecimal(value: number): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toNullableIntAllowNegative(value: string): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return parsed;
}

function toDateInput(value: string | null): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}
