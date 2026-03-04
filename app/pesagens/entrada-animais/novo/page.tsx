"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import type { PesagemStatus } from "@/lib/types/pesagem";

type ContratoOption = { id: number; numero: string | null; descricao: string | null };
type DocumentoFiscal = { documento: string };
type MotivoRow = { motivo: string; tempoMinutos: string };
type CalendarioRow = { data: string; dia: string; feriado: boolean; pago: boolean; valor: string };
type TabKey = "documento" | "atraso" | "espera" | "calendario";

type FormState = {
  status: PesagemStatus;
  contratoId: string;
  contratoReferencia: string;
  itemDescricao: string;
  fazendaNome: string;
  tipoFrete: string;
  responsavelFrete: string;
  transportadorNome: string;
  contratanteNome: string;
  motoristaNome: string;
  dataChegada: string;
  horaChegada: string;
  dataSaida: string;
  horaSaida: string;
  numeroTicket: string;
  placa: string;
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
  itemDescricao: "",
  fazendaNome: "",
  tipoFrete: "",
  responsavelFrete: "empresa",
  transportadorNome: "",
  contratanteNome: "",
  motoristaNome: "",
  dataChegada: "",
  horaChegada: "",
  dataSaida: "",
  horaSaida: "",
  numeroTicket: "",
  placa: "",
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
  operacao: "",
};

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
  const [documentosFiscais, setDocumentosFiscais] = useState<DocumentoFiscal[]>([]);
  const [motivosAtraso, setMotivosAtraso] = useState<MotivoRow[]>([]);
  const [motivosEspera, setMotivosEspera] = useState<MotivoRow[]>([]);
  const [calendario, setCalendario] = useState<CalendarioRow[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number.parseInt(params.get("id") ?? "", 10);
    if (Number.isFinite(id) && id > 0) setEditingId(id);
  }, []);

  useEffect(() => {
    async function loadOpcoes() {
      try {
        const response = await fetch("/api/pesagens/entrada-animais/opcoes", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { contratos?: ContratoOption[] };
        setContratos(Array.isArray(data.contratos) ? data.contratos : []);
      } catch {}
    }
    loadOpcoes().catch(() => undefined);
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
        setForm((prev) => ({
          ...prev,
          status: normalizeStatus(String(data.status ?? "disponivel")),
          contratoId: toText(data.contratoId),
          contratoReferencia: toText(data.contratoReferencia),
          itemDescricao: toText(data.itemDescricao),
          fazendaNome: toText(data.fazendaNome),
          tipoFrete: toText(data.tipoFrete),
          responsavelFrete: toText(data.responsavelFrete) || "empresa",
          transportadorNome: toText(data.transportadorNome),
          contratanteNome: toText(data.contratanteNome),
          motoristaNome: toText(data.motoristaNome),
          dataChegada: toDateInput(data.dataChegada),
          horaChegada: toTimeInput(data.horaChegada),
          dataSaida: toDateInput(data.dataSaida),
          horaSaida: toTimeInput(data.horaSaida),
          numeroTicket: toText(data.numeroTicket),
          placa: toText(data.placa),
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar pesagem.");
      } finally {
        setLoading(false);
      }
    }
    loadData().catch(() => undefined);
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
    try {
      const response = await fetch("/api/pesagens/entrada-animais/capturar-peso", { cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao capturar peso.");
      const data = (await response.json()) as { peso?: number };
      setForm((prev) => ({ ...prev, [target]: formatCurrency(Number(data.peso ?? 0)) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao capturar peso.");
    }
  }

  async function salvar() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...form,
        tipo: "entrada_animais",
        contratoId: toNullableInt(form.contratoId),
        kmInicial: parseCurrency(form.kmInicial),
        kmFinal: parseCurrency(form.kmFinal),
        kmTotal: parseCurrency(form.kmTotal),
        pesoBruto: parseCurrency(form.pesoBruto),
        pesoTara: parseCurrency(form.pesoTara),
        pesoLiquido: parseCurrency(form.pesoLiquido),
        documentosFiscais,
        motivosAtraso: motivosAtraso.map((item) => ({ motivo: item.motivo, tempoMinutos: Number(item.tempoMinutos || 0) })),
        motivosEspera: motivosEspera.map((item) => ({ motivo: item.motivo, tempoMinutos: Number(item.tempoMinutos || 0) })),
        calendario: calendario.map((item) => ({ ...item, valor: parseCurrency(item.valor) })),
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
              <label className="legacy-field"><span>Item</span><input className="legacy-input" value={form.itemDescricao} onChange={(e) => setForm((p) => ({ ...p, itemDescricao: e.target.value }))} /></label>
              <label className="legacy-field"><span>Fazenda</span><input className="legacy-input" value={form.fazendaNome} onChange={(e) => setForm((p) => ({ ...p, fazendaNome: e.target.value }))} /></label>
              <label className="legacy-field"><span>Tipo de Frete</span><input className="legacy-input" value={form.tipoFrete} onChange={(e) => setForm((p) => ({ ...p, tipoFrete: e.target.value }))} /></label>
              <label className="legacy-field"><span>Responsavel Frete</span><select className="legacy-select" value={form.responsavelFrete} onChange={(e) => setForm((p) => ({ ...p, responsavelFrete: e.target.value }))}><option value="empresa">Empresa</option><option value="parceiro">Parceiro</option><option value="terceiro">Terceiro</option></select></label>
              <label className="legacy-field"><span>Transportador</span><input className="legacy-input" value={form.transportadorNome} onChange={(e) => setForm((p) => ({ ...p, transportadorNome: e.target.value }))} /></label>
              <label className="legacy-field"><span>Contratante</span><input className="legacy-input" value={form.contratanteNome} onChange={(e) => setForm((p) => ({ ...p, contratanteNome: e.target.value }))} /></label>
              <label className="legacy-field"><span>Motorista</span><input className="legacy-input" value={form.motoristaNome} onChange={(e) => setForm((p) => ({ ...p, motoristaNome: e.target.value }))} /></label>
              <label className="legacy-field"><span>Data Chegada</span><input type="date" className="legacy-input" value={form.dataChegada} onChange={(e) => setForm((p) => ({ ...p, dataChegada: e.target.value }))} /></label>
              <label className="legacy-field"><span>Hora Chegada</span><input type="time" className="legacy-input" value={form.horaChegada} onChange={(e) => setForm((p) => ({ ...p, horaChegada: e.target.value }))} /></label>
              <label className="legacy-field"><span>Data Saida</span><input type="date" className="legacy-input" value={form.dataSaida} onChange={(e) => setForm((p) => ({ ...p, dataSaida: e.target.value }))} /></label>
              <label className="legacy-field"><span>Hora Saida</span><input type="time" className="legacy-input" value={form.horaSaida} onChange={(e) => setForm((p) => ({ ...p, horaSaida: e.target.value }))} /></label>
              <label className="legacy-field"><span>N Ticket</span><input className="legacy-input" value={form.numeroTicket} onChange={(e) => setForm((p) => ({ ...p, numeroTicket: e.target.value }))} /></label>
              <label className="legacy-field"><span>Placa</span><input className="legacy-input" value={form.placa} onChange={(e) => setForm((p) => ({ ...p, placa: e.target.value.toUpperCase() }))} /></label>
              <label className="legacy-field"><span>Equipamento</span><input className="legacy-input" value={form.equipamentoNome} onChange={(e) => setForm((p) => ({ ...p, equipamentoNome: e.target.value }))} /></label>
              <label className="legacy-field"><span>Viagem</span><input className="legacy-input" value={form.viagem} onChange={(e) => setForm((p) => ({ ...p, viagem: e.target.value }))} /></label>
              <label className="legacy-field"><span>Data Inicio</span><input type="date" className="legacy-input" value={form.dataInicio} onChange={(e) => setForm((p) => ({ ...p, dataInicio: e.target.value }))} /></label>
              <label className="legacy-field"><span>Data Fim</span><input type="date" className="legacy-input" value={form.dataFim} onChange={(e) => setForm((p) => ({ ...p, dataFim: e.target.value }))} /></label>
              <label className="legacy-field"><span>Operacao</span><input className="legacy-input" value={form.operacao} onChange={(e) => setForm((p) => ({ ...p, operacao: e.target.value }))} /></label>
              <label className="legacy-field"><span>KM Inicial</span><input className="legacy-input" value={form.kmInicial} onChange={(e) => setForm((p) => ({ ...p, kmInicial: sanitizeDecimal(e.target.value) }))} /></label>
              <label className="legacy-field"><span>KM Final</span><input className="legacy-input" value={form.kmFinal} onChange={(e) => setForm((p) => ({ ...p, kmFinal: sanitizeDecimal(e.target.value) }))} /></label>
              <label className="legacy-field"><span>KM Total</span><input className="legacy-input" value={form.kmTotal} readOnly /></label>
              <label className="legacy-field col-span-2"><span>Observacao</span><textarea className="legacy-textarea" value={form.observacao} onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))} /></label>
              <label className="legacy-field"><span>Peso Bruto</span><input className="legacy-input" value={form.pesoBruto} onChange={(e) => setForm((p) => ({ ...p, pesoBruto: sanitizeDecimal(e.target.value) }))} /></label>
              <div className="legacy-field"><span>&nbsp;</span><button type="button" className="legacy-btn" onClick={() => capturarPeso("pesoBruto")}>Capturar Bruto</button></div>
              <label className="legacy-field"><span>Peso Tara</span><input className="legacy-input" value={form.pesoTara} onChange={(e) => setForm((p) => ({ ...p, pesoTara: sanitizeDecimal(e.target.value) }))} /></label>
              <div className="legacy-field"><span>&nbsp;</span><button type="button" className="legacy-btn" onClick={() => capturarPeso("pesoTara")}>Capturar Tara</button></div>
              <label className="legacy-field"><span>Peso Liquido</span><input className="legacy-input" value={form.pesoLiquido} readOnly /></label>
              <label className="legacy-field"><span>Status</span><select className="legacy-select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: normalizeStatus(e.target.value) }))}><option value="disponivel">Disponivel</option><option value="peso_finalizado">Peso Finalizado</option><option value="fechado">Fechado</option><option value="cancelado">Cancelado</option></select></label>
            </div>

            <div className="legacy-tabs mt-3">
              <button type="button" className={`legacy-tab ${activeTab === "documento" ? "active" : ""}`} onClick={() => setActiveTab("documento")}>Documento Fiscal</button>
              <button type="button" className={`legacy-tab ${activeTab === "atraso" ? "active" : ""}`} onClick={() => setActiveTab("atraso")}>Motivo Atraso</button>
              <button type="button" className={`legacy-tab ${activeTab === "espera" ? "active" : ""}`} onClick={() => setActiveTab("espera")}>Motivo Espera</button>
              <button type="button" className={`legacy-tab ${activeTab === "calendario" ? "active" : ""}`} onClick={() => setActiveTab("calendario")}>Calendario</button>
            </div>

            {activeTab === "documento" && <SimpleListEditor rows={documentosFiscais} setRows={setDocumentosFiscais} keyName="documento" label="Documento" />}
            {activeTab === "atraso" && <MotivoListEditor rows={motivosAtraso} setRows={setMotivosAtraso} />}
            {activeTab === "espera" && <MotivoListEditor rows={motivosEspera} setRows={setMotivosEspera} />}
            {activeTab === "calendario" && <CalendarioEditor rows={calendario} setRows={setCalendario} />}
          </div>
        </section>
      </main>
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

function normalizeStatus(value: string): PesagemStatus { const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); if (normalized === "peso_finalizado") return "peso_finalizado"; if (normalized === "fechado") return "fechado"; if (normalized === "cancelado") return "cancelado"; return "disponivel"; }
function parseCurrency(value: string): number { const parsed = Number(String(value ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
function formatCurrency(value: number): string { return (Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function sanitizeDecimal(value: string): string { return value.replace(/[^0-9,.-]/g, ""); }
function toText(value: unknown): string { return String(value ?? "").trim(); }
function toNullableInt(value: string): number | null { const parsed = Number.parseInt(value, 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function toCurrency(value: unknown): string { const parsed = Number(value); return Number.isFinite(parsed) ? formatCurrency(parsed) : "0,00"; }
function toDateInput(value: unknown): string { const text = toText(value); const m = text.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(text); return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10); }
function toTimeInput(value: unknown): string { const text = toText(value); const m = text.match(/^(\d{2}:\d{2})/); return m?.[1] ?? ""; }
function parseDocumentosRows(value: unknown): DocumentoFiscal[] { if (!Array.isArray(value)) return []; return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => ({ documento: toText((item as Record<string, unknown>).documento) })); }
function parseMotivoRows(value: unknown): MotivoRow[] { if (!Array.isArray(value)) return []; return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => { const row = item as Record<string, unknown>; return { motivo: toText(row.motivo), tempoMinutos: String(Number.parseInt(String(row.tempoMinutos ?? 0), 10) || 0) }; }); }
function parseCalendarioRows(value: unknown): CalendarioRow[] { if (!Array.isArray(value)) return []; return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => { const row = item as Record<string, unknown>; return { data: toDateInput(row.data), dia: toText(row.dia), feriado: Boolean(row.feriado), pago: Boolean(row.pago), valor: toCurrency(row.valor) }; }); }
