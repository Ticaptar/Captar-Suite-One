"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import type { VisitaAtividadePayload, VisitaCategoriaItemPayload, VisitaRecord, VisitaStatus, VisitaTipoContrato } from "@/lib/types/visita";

type EmpresaOption = { id: number; codigo: string | null; nome: string };
type ParceiroOption = { id: number; codigo: string | null; nome: string; documento: string | null };
type VisitaDetalheResponse = { visita: VisitaRecord; atividades: VisitaAtividadePayload[] };
type CepLookupResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};
type TabKey = "atividade" | "categoria";
type PnPickerTarget = "parceiro" | "responsavel" | "atividade_responsavel";

type FormState = {
  empresaId: string;
  status: VisitaStatus;
  dataVisita: string;
  parceiroId: string;
  parceiroBusca: string;
  parceiroCodigo: string;
  parceiroNome: string;
  responsavelId: string;
  responsavelBusca: string;
  responsavelCodigo: string;
  responsavelNome: string;
  cep: string;
  endereco: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  telefone: string;
  email: string;
  rebanhoAtual: string;
  informacoesDetalhadas: string;
  categoria: string;
  raca: string;
  observacoes: string;
  tipoContratoSugerido: VisitaTipoContrato;
};

const STATUS_OPTIONS: Array<{ value: VisitaStatus; label: string }> = [
  { value: "oportunidade", label: "Oportunidade" },
  { value: "em_analise", label: "Em analise" },
  { value: "negociacao", label: "Negociacao" },
  { value: "contrato_gerado", label: "Contrato gerado" },
  { value: "perdida", label: "Perdida" },
  { value: "arquivada", label: "Arquivada" },
];
const TIPO_ATIVIDADE_OPTIONS = ["E-mail", "Ligar", "Reuniao", "Visita", "Acompanhamento de Abate"];
const CATEGORIA_OPTIONS = ["BEZERRO", "GARROTE", "BOI", "BEZERRA", "NOVILHA", "VACA", "CRUZADO", "NELORE", "GABIRU", "BOICHINA"];
const RACA_PREDOMINANTE_OPTIONS = ["MESTICO", "CRUZAMENTO INDUSTRIAL", "NELORE", "LEITEIRO", "CRUZADO", "CRUZADO RUIM", "ABERDEEN ANGUS", "COMPOSTO", "RED ANGUS", "NONE", "GABIRU", "CARACU"];
const QUALIDADE_OPTIONS = ["MERCADO INTERNO", "EXPORTACAO", "None", "Ruim"];
const CONDICAO_PAGTO_OPTIONS = ["A vista", "15 dias", "30 dias", "A vista, 30 e 60 dias", "30, 60 e 90 dias", "45 dias", "45 e 90 dias", "15, 30 e 45 dias", "45, 90, 135 e 180 dias"];

const EMPTY_ATIVIDADE: VisitaAtividadePayload = { tipoAtividade: "", dataVencimento: "", resumo: "", responsavel: "", dataRealizacao: "", descricaoAtividade: "" };
const EMPTY_CATEGORIA: VisitaCategoriaItemPayload = { categoria: "", raca: "", qualidade: "", condicaoPagto: "", pesoAproxArroba: "0,00", rcPercentual: "0,00", valorArroba: "0,00", valorTabelaArroba: "0,00", freteArroba: "0,00", valorIcmsArroba: "0,00", cabecas: "" };

export function VisitaFormPage({ visitaId }: { visitaId?: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(visitaId));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepFeedback, setCepFeedback] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<TabKey>("atividade");

  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [parceiros, setParceiros] = useState<ParceiroOption[]>([]);
  const [pnPickerTarget, setPnPickerTarget] = useState<PnPickerTarget | null>(null);
  const [pnPickerSearch, setPnPickerSearch] = useState("");
  const [pnPickerLoading, setPnPickerLoading] = useState(false);
  const [pnPickerOptions, setPnPickerOptions] = useState<ParceiroOption[]>([]);

  const [form, setForm] = useState<FormState>({
    empresaId: "",
    status: "oportunidade",
    dataVisita: new Date().toISOString().slice(0, 10),
    parceiroId: "",
    parceiroBusca: "",
    parceiroCodigo: "",
    parceiroNome: "",
    responsavelId: "",
    responsavelBusca: "",
    responsavelCodigo: "",
    responsavelNome: "",
    cep: "",
    endereco: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    telefone: "",
    email: "",
    rebanhoAtual: "0,00",
    informacoesDetalhadas: "",
    categoria: "",
    raca: "",
    observacoes: "",
    tipoContratoSugerido: "entrada_animais",
  });

  const [atividades, setAtividades] = useState<VisitaAtividadePayload[]>([]);
  const [atividadeDraft, setAtividadeDraft] = useState<VisitaAtividadePayload>(EMPTY_ATIVIDADE);
  const [categoriaItens, setCategoriaItens] = useState<VisitaCategoriaItemPayload[]>([]);
  const [categoriaDraft, setCategoriaDraft] = useState<VisitaCategoriaItemPayload>(EMPTY_CATEGORIA);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await fetch("/api/cadastros/empresas", { cache: "no-store" });
        if (!r.ok) throw new Error("Falha ao carregar empresas.");
        const data = (await r.json()) as EmpresaOption[];
        if (!on) return;
        setEmpresas(data);
        const first = data.find((x) => x.id !== 0)?.id;
        setForm((p) => ({ ...p, empresaId: p.empresaId || String(first ?? "") }));
      } catch (e) {
        if (!on) return;
        setError(e instanceof Error ? e.message : "Falha ao carregar empresas.");
      }
    })().catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const data = await fetchParceiros("");
        if (!on) return;
        setParceiros(data);
      } catch {
        if (!on) return;
      }
    })().catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    if (!visitaId) return;
    let on = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/visitas/${visitaId}`, { cache: "no-store" });
        if (!r.ok) throw new Error("Falha ao carregar visita.");
        const data = (await r.json()) as VisitaDetalheResponse;
        if (!on) return;
        setIsLocked(Boolean(data.visita.contratoGeradoId) || data.visita.status === "contrato_gerado");
        setForm((p) => ({ ...p, empresaId: String(data.visita.empresaId), status: data.visita.status, dataVisita: normalizeDateForInput(data.visita.dataVisita), parceiroId: data.visita.parceiroId ? String(data.visita.parceiroId) : "", parceiroBusca: buildLabel(data.visita.parceiroCodigo, data.visita.parceiroNome), parceiroCodigo: data.visita.parceiroCodigo ?? "", parceiroNome: data.visita.parceiroNome ?? "", responsavelId: data.visita.responsavelId ? String(data.visita.responsavelId) : "", responsavelBusca: buildLabel(data.visita.responsavelCodigo, data.visita.responsavelNome), responsavelCodigo: data.visita.responsavelCodigo ?? "", responsavelNome: data.visita.responsavelNome ?? "", cep: data.visita.cep ?? "", endereco: data.visita.endereco ?? "", complemento: data.visita.complemento ?? "", bairro: data.visita.bairro ?? "", cidade: data.visita.cidade ?? "", estado: data.visita.estado ?? "", telefone: data.visita.telefone ?? "", email: data.visita.email ?? "", rebanhoAtual: toDecimal(data.visita.rebanhoAtual), informacoesDetalhadas: data.visita.informacoesDetalhadas ?? "", categoria: data.visita.categoria ?? "", raca: data.visita.raca ?? "", observacoes: data.visita.observacoes ?? "", tipoContratoSugerido: "entrada_animais" }));
        setAtividades((data.atividades ?? []).map((item) => ({
          ...item,
          dataVencimento: normalizeDateForInput(item.dataVencimento),
          dataRealizacao: normalizeDateForInput(item.dataRealizacao),
        })));
        setCategoriaItens(data.visita.categoriaItens ?? []);
      } catch (e) {
        if (!on) return;
        setError(e instanceof Error ? e.message : "Falha ao carregar visita.");
      } finally {
        if (on) setLoading(false);
      }
    })().catch(() => undefined);
    return () => {
      on = false;
    };
  }, [visitaId]);

  useEffect(() => {
    if (!pnPickerTarget) return;
    if (!pnPickerSearch.trim() && parceiros.length > 0) {
      setPnPickerOptions(parceiros);
      setPnPickerLoading(false);
      return;
    }
    let active = true;
    const timeout = window.setTimeout(async () => {
      setPnPickerLoading(true);
      try {
        const options = await fetchParceiros(pnPickerSearch);
        if (!active) return;
        setPnPickerOptions(options);
      } finally {
        if (active) setPnPickerLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [parceiros, pnPickerSearch, pnPickerTarget]);

  const openPnPicker = (target: PnPickerTarget) => {
    setPnPickerTarget(target);
    setPnPickerSearch("");
    setPnPickerOptions(parceiros);
  };

  const closePnPicker = () => {
    setPnPickerTarget(null);
    setPnPickerSearch("");
    setPnPickerOptions([]);
    setPnPickerLoading(false);
  };

  const bindParceiroOption = (option: ParceiroOption) => {
    if (pnPickerTarget === "parceiro") {
      setForm((p) => ({
        ...p,
        parceiroBusca: labelOption(option),
        parceiroId: String(option.id),
        parceiroCodigo: option.codigo ?? "",
        parceiroNome: option.nome ?? "",
      }));
      setParceiros((prev) => upsertParceiroOption(prev, option));
    } else if (pnPickerTarget === "responsavel") {
      setForm((p) => ({
        ...p,
        responsavelBusca: labelOption(option),
        responsavelId: String(option.id),
        responsavelCodigo: option.codigo ?? "",
        responsavelNome: option.nome ?? "",
      }));
    } else if (pnPickerTarget === "atividade_responsavel") {
      setAtividadeDraft((p) => ({
        ...p,
        responsavel: labelOption(option),
      }));
    }
    closePnPicker();
  };

  const addAtividade = () => {
    if (!atividadeDraft.tipoAtividade.trim() || !atividadeDraft.resumo.trim()) return setError("Informe tipo e resumo da atividade.");
    setError("");
    setAtividades((p) => [...p, atividadeDraft]);
    setAtividadeDraft(EMPTY_ATIVIDADE);
  };
  const addCategoria = () => {
    if (!categoriaDraft.categoria.trim()) return setError("Informe a categoria.");
    setError("");
    setCategoriaItens((p) => [...p, categoriaDraft]);
    setCategoriaDraft(EMPTY_CATEGORIA);
  };

  const saveVisita = async () => {
    if (isLocked) {
      setError("Visita com contrato gerado nao pode ser editada.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const empresaId = toSignedInt(form.empresaId) ?? empresas.find((x) => x.id !== 0)?.id;
      if (!empresaId) throw new Error("Empresa nao encontrada. Recarregue a pagina.");
      if (!form.dataVisita) throw new Error("Informe a data da visita.");
      const payload = {
        empresaId,
        status: form.status,
        dataVisita: form.dataVisita,
        parceiroId: toInt(form.parceiroId),
        parceiroCodigo: toStr(form.parceiroCodigo),
        parceiroNome: toStr(form.parceiroNome),
        responsavelId: toInt(form.responsavelId),
        responsavelCodigo: toStr(form.responsavelCodigo),
        responsavelNome: toStr(form.responsavelNome),
        cep: toStr(form.cep),
        endereco: toStr(form.endereco),
        complemento: toStr(form.complemento),
        bairro: toStr(form.bairro),
        cidade: toStr(form.cidade),
        estado: toStr(form.estado),
        telefone: toStr(form.telefone),
        email: toStr(form.email),
        rebanhoAtual: parseDecimal(form.rebanhoAtual),
        informacoesDetalhadas: toStr(form.informacoesDetalhadas),
        categoria: toStr(form.categoria),
        raca: toStr(form.raca),
        observacoes: toStr(form.observacoes),
        tipoContratoSugerido: "entrada_animais",
        atividades,
        categoriaItens,
      };
      const r = await fetch(visitaId ? `/api/visitas/${visitaId}` : "/api/visitas", { method: visitaId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) {
        const b = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? "Falha ao salvar visita.");
      }
      const saved = (await r.json()) as VisitaDetalheResponse;
      if (!visitaId && saved.visita?.id) router.replace(`/visitas/${saved.visita.id}?created=1`);
      else setMessage("Visita salva com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar visita.");
    } finally { setSaving(false); }
  };

  const gerarContrato = async () => {
    if (!visitaId || isLocked) return;
    setGenerating(true); setError(""); setMessage("");
    try {
      const r = await fetch(`/api/visitas/${visitaId}/gerar-contrato`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipoContrato: "entrada_animais" }) });
      if (!r.ok) throw new Error("Falha ao gerar contrato.");
      const data = (await r.json()) as { contratoId: number; url?: string; jaExistente?: boolean };
      setMessage(data.jaExistente ? `Contrato #${data.contratoId} ja estava vinculado.` : `Contrato #${data.contratoId} gerado com sucesso.`);
      if (data.url) router.push(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar contrato.");
    } finally { setGenerating(false); }
  };

  const handleCepChange = (value: string) => {
    setCepFeedback("");
    setForm((p) => ({ ...p, cep: formatCep(value) }));
  };

  const lookupCep = async (rawCep: string) => {
    const digits = onlyNumber(rawCep).slice(0, 8);
    if (!digits) {
      setCepFeedback("");
      return;
    }
    if (digits.length !== 8) {
      setCepFeedback("CEP invalido. Informe 8 digitos.");
      return;
    }

    setCepLoading(true);
    setCepFeedback("Buscando CEP...");
    try {
      const response = await fetch(`/api/cep/${digits}`, { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as
        | (CepLookupResponse & { error?: string })
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Falha ao consultar CEP.");
      }

      setForm((p) => ({
        ...p,
        cep: formatCep(body?.cep ?? digits),
        endereco: normalizeAddressField(body?.logradouro) || p.endereco,
        complemento: p.complemento || normalizeAddressField(body?.complemento) || p.complemento,
        bairro: normalizeAddressField(body?.bairro) || p.bairro,
        cidade: normalizeAddressField(body?.cidade) || p.cidade,
        estado: normalizeAddressField(body?.estado) || p.estado,
      }));
      setCepFeedback("Endereco preenchido a partir do CEP.");
    } catch (e) {
      setCepFeedback(e instanceof Error ? e.message : "Falha ao consultar CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <FormPageHeader title={visitaId ? `Visita #${visitaId}` : "Nova Visita"} subtitle="Registro de lead/oportunidade em campo, com possibilidade de gerar contrato." backHref="/visitas" backLabel="Visitas" />
        <ModuleHeader />
        <section className="card p-3">
          <div className="legacy-actions"><button type="button" className="legacy-btn primary" onClick={saveVisita} disabled={saving || loading || isLocked}>{saving ? "Salvando..." : "Salvar"}</button><Link href="/visitas" className="legacy-btn">Descartar</Link>{visitaId && !isLocked && <button type="button" className="legacy-btn" onClick={gerarContrato} disabled={generating || loading}>{generating ? "Gerando..." : "Gerar Contrato"}</button>}</div>
          {message && <p className="legacy-message success">{message}</p>}
          {error && <p className="legacy-message error">{error}</p>}
          {visitaId && isLocked && <p className="legacy-message success">Visita com contrato gerado: edicao bloqueada.</p>}

          <fieldset disabled={loading || isLocked} className="mt-2 min-w-0 border-0 p-0">
            <div className="legacy-grid cols-4">
              <FieldSelect label="Empresa" value={form.empresaId} onChange={(v) => setForm((p) => ({ ...p, empresaId: v }))} options={[{ value: "", label: "Selecione..." }, ...empresas.map((e) => ({ value: String(e.id), label: `${e.codigo ?? "SEM-COD"} - ${e.nome}` }))]} />
              <FieldSelect label="Status" value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v as VisitaStatus }))} options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <FieldInput label="Data Visita" type="date" value={form.dataVisita} onChange={(v) => setForm((p) => ({ ...p, dataVisita: v }))} />
              <FieldSelect label="Tipo Contrato Sugerido" value={form.tipoContratoSugerido} onChange={() => setForm((p) => ({ ...p, tipoContratoSugerido: "entrada_animais" }))} options={[{ value: "entrada_animais", label: "Entrada de Animais" }]} />
              <PickerTriggerField label="Parceiro (PN/Lead)" className="col-span-2" valueLabel={form.parceiroBusca} onOpen={() => openPnPicker("parceiro")} />
              <PickerTriggerField label="Responsavel (PN)" className="col-span-2" valueLabel={form.responsavelBusca} onOpen={() => openPnPicker("responsavel")} />
              <FieldInput label={cepLoading ? "CEP (Buscando...)" : "CEP"} value={form.cep} onChange={handleCepChange} onBlur={() => { void lookupCep(form.cep); }} />
              <FieldInput label="Endereco" className="col-span-2" value={form.endereco} onChange={(v) => setForm((p) => ({ ...p, endereco: v }))} />
              <FieldInput label="Complemento" value={form.complemento} onChange={(v) => setForm((p) => ({ ...p, complemento: v }))} />
              <FieldInput label="Bairro" value={form.bairro} onChange={(v) => setForm((p) => ({ ...p, bairro: v }))} />
              <FieldInput label="Cidade" value={form.cidade} onChange={(v) => setForm((p) => ({ ...p, cidade: v }))} />
              <FieldInput label="Estado" value={form.estado} onChange={(v) => setForm((p) => ({ ...p, estado: v }))} />
              <FieldInput label="Telefone" value={form.telefone} onChange={(v) => setForm((p) => ({ ...p, telefone: v }))} />
              <FieldInput label="E-mail" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} />
              <FieldInput label="Rebanho Atual" value={form.rebanhoAtual} onChange={(v) => setForm((p) => ({ ...p, rebanhoAtual: formatCurrencyBr(v) }))} />
              <FieldSelect label="Categoria" value={form.categoria} onChange={(v) => setForm((p) => ({ ...p, categoria: v }))} options={[{ value: "", label: "Selecione..." }, ...CATEGORIA_OPTIONS.map((x) => ({ value: x, label: x }))]} />
              <FieldSelect label="Raca" value={form.raca} onChange={(v) => setForm((p) => ({ ...p, raca: v }))} options={[{ value: "", label: "Selecione..." }, ...RACA_PREDOMINANTE_OPTIONS.map((x) => ({ value: x, label: x }))]} />
              <FieldTextArea label="Informacoes detalhadas da visita" className="col-span-2" value={form.informacoesDetalhadas} onChange={(v) => setForm((p) => ({ ...p, informacoesDetalhadas: v }))} />
            </div>
            {cepFeedback && <p className="legacy-message">{cepFeedback}</p>}

            <div className="legacy-tabs mt-3"><button type="button" className={`legacy-tab ${tab === "atividade" ? "active" : ""}`} onClick={() => setTab("atividade")}>Atividade</button><button type="button" className={`legacy-tab ${tab === "categoria" ? "active" : ""}`} onClick={() => setTab("categoria")}>Categoria</button></div>

            {tab === "atividade" && (
              <section className="mt-2">
                <div className="legacy-grid cols-4">
                  <FieldSelect label="Tipo de Atividade" value={atividadeDraft.tipoAtividade} onChange={(v) => setAtividadeDraft((p) => ({ ...p, tipoAtividade: v }))} options={[{ value: "", label: "Selecione..." }, ...TIPO_ATIVIDADE_OPTIONS.map((x) => ({ value: x, label: x }))]} />
                  <FieldInput label="Data Vencimento" type="date" value={atividadeDraft.dataVencimento} onChange={(v) => setAtividadeDraft((p) => ({ ...p, dataVencimento: v }))} />
                  <PickerTriggerField label="Responsavel" valueLabel={atividadeDraft.responsavel} onOpen={() => openPnPicker("atividade_responsavel")} />
                  <FieldInput label="Resumo" value={atividadeDraft.resumo} onChange={(v) => setAtividadeDraft((p) => ({ ...p, resumo: v }))} />
                  <FieldInput label="Data Realizacao" type="date" value={atividadeDraft.dataRealizacao} onChange={(v) => setAtividadeDraft((p) => ({ ...p, dataRealizacao: v }))} />
                  <FieldTextArea label="Descricao Atividade" className="col-span-3" value={atividadeDraft.descricaoAtividade} onChange={(v) => setAtividadeDraft((p) => ({ ...p, descricaoAtividade: v }))} />
                </div>
                <div className="legacy-actions mt-2"><button type="button" className="legacy-btn" onClick={addAtividade}>Adicionar</button></div>
                <SimpleTable headers={["Tipo de Atividade", "Data Vencimento", "Resumo", "Responsavel", "Data Realizacao", "Descricao Atividade"]} rows={atividades.map((a) => [a.tipoAtividade, toDate(a.dataVencimento), a.resumo, a.responsavel, toDate(a.dataRealizacao), a.descricaoAtividade])} onRemove={(i) => setAtividades((p) => p.filter((_, idx) => idx !== i))} />
              </section>
            )}

            {tab === "categoria" && (
              <section className="mt-2">
                <div className="legacy-grid cols-4">
                  <FieldSelect label="Categoria" value={categoriaDraft.categoria} onChange={(v) => setCategoriaDraft((p) => ({ ...p, categoria: v }))} options={[{ value: "", label: "Selecione..." }, ...CATEGORIA_OPTIONS.map((x) => ({ value: x, label: x }))]} />
                  <FieldSelect label="Raca" value={categoriaDraft.raca} onChange={(v) => setCategoriaDraft((p) => ({ ...p, raca: v }))} options={[{ value: "", label: "Selecione..." }, ...RACA_PREDOMINANTE_OPTIONS.map((x) => ({ value: x, label: x }))]} />
                  <FieldSelect label="Qualidade" value={categoriaDraft.qualidade} onChange={(v) => setCategoriaDraft((p) => ({ ...p, qualidade: v }))} options={[{ value: "", label: "Selecione..." }, ...QUALIDADE_OPTIONS.map((x) => ({ value: x, label: x }))]} />
                  <FieldSelect label="Condicao Pagto" value={categoriaDraft.condicaoPagto} onChange={(v) => setCategoriaDraft((p) => ({ ...p, condicaoPagto: v }))} options={[{ value: "", label: "Selecione..." }, ...CONDICAO_PAGTO_OPTIONS.map((x) => ({ value: x, label: x }))]} />
                  <FieldInput label="Peso Aprox (@)" value={categoriaDraft.pesoAproxArroba} onChange={(v) => setCategoriaDraft((p) => ({ ...p, pesoAproxArroba: formatCurrencyBr(v) }))} />
                  <FieldInput label="RC %" value={categoriaDraft.rcPercentual} onChange={(v) => setCategoriaDraft((p) => ({ ...p, rcPercentual: formatCurrencyBr(v) }))} />
                  <FieldInput label="Valor R$/@" value={categoriaDraft.valorArroba} onChange={(v) => setCategoriaDraft((p) => ({ ...p, valorArroba: formatCurrencyBr(v) }))} />
                  <FieldInput label="Valor Tabela R$/@" value={categoriaDraft.valorTabelaArroba} onChange={(v) => setCategoriaDraft((p) => ({ ...p, valorTabelaArroba: formatCurrencyBr(v) }))} />
                  <FieldInput label="Frete R$/@" value={categoriaDraft.freteArroba} onChange={(v) => setCategoriaDraft((p) => ({ ...p, freteArroba: formatCurrencyBr(v) }))} />
                  <FieldInput label="Valor ICMS R$/@" value={categoriaDraft.valorIcmsArroba} onChange={(v) => setCategoriaDraft((p) => ({ ...p, valorIcmsArroba: formatCurrencyBr(v) }))} />
                  <FieldInput label="Cabecas" value={categoriaDraft.cabecas} onChange={(v) => setCategoriaDraft((p) => ({ ...p, cabecas: onlyNumber(v) }))} />
                  <FieldTextArea label="Observacoes" className="col-span-4" value={form.observacoes} onChange={(v) => setForm((p) => ({ ...p, observacoes: v }))} />
                </div>
                <div className="legacy-actions mt-2"><button type="button" className="legacy-btn" onClick={addCategoria}>Adicionar</button></div>
                <SimpleTable headers={["Categoria", "Raca", "Qualidade", "Condicao Pagto", "Peso Aprox (@)", "RC %", "Valor R$/@", "Valor Tabela R$/@", "Frete R$/@", "Valor ICMS R$/@", "Cabecas"]} rows={categoriaItens.map((c) => [c.categoria, c.raca, c.qualidade, c.condicaoPagto, c.pesoAproxArroba, c.rcPercentual, c.valorArroba, c.valorTabelaArroba, c.freteArroba, c.valorIcmsArroba, c.cabecas])} onRemove={(i) => setCategoriaItens((p) => p.filter((_, idx) => idx !== i))} />
              </section>
            )}
          </fieldset>

          {pnPickerTarget && (
            <LegacyModal title="Pesquisar Parceiro (PN)" onClose={closePnPicker} zIndex={220}>
              <label className="legacy-field">
                <span>Pesquisar por nome, codigo ou documento</span>
                <input
                  className="legacy-input"
                  placeholder="Digite para buscar..."
                  value={pnPickerSearch}
                  onChange={(event) => setPnPickerSearch(event.target.value)}
                />
              </label>
              {pnPickerLoading && <p className="mt-2 text-xs text-[#6b7394]">Carregando...</p>}
              <div className="legacy-table-wrap mt-2 max-h-[320px]">
                <table className="legacy-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nome</th>
                      <th>Documento</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnPickerOptions.length === 0 && !pnPickerLoading && (
                      <tr>
                        <td colSpan={4} className="legacy-empty">Nenhum parceiro encontrado.</td>
                      </tr>
                    )}
                    {pnPickerOptions.map((option) => (
                      <tr key={`${option.id}-${option.codigo ?? "sem-cod"}-${option.nome}`}>
                        <td>{option.codigo || "-"}</td>
                        <td className="left">{option.nome || "-"}</td>
                        <td>{option.documento || "-"}</td>
                        <td>
                          <button type="button" className="legacy-btn primary" onClick={() => bindParceiroOption(option)}>
                            Selecionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </LegacyModal>
          )}
        </section>
      </main>
    </div>
  );
}

function FieldInput({ label, value, onChange, onBlur, type = "text", className = "" }: { label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; type?: string; className?: string }) {
  return <label className={`legacy-field ${className}`}><span>{label}</span><input type={type} className="legacy-input" value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} /></label>;
}
function FieldTextArea({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return <label className={`legacy-field ${className}`}><span>{label}</span><textarea className="legacy-textarea" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="legacy-field"><span>{label}</span><select className="legacy-select" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={`${o.value}-${o.label}`} value={o.value}>{o.label}</option>)}</select></label>;
}
function LegacyModal({
  title,
  onClose,
  children,
  zIndex,
}: {
  title: string;
  onClose: () => void;
  children: import("react").ReactNode;
  zIndex?: number;
}) {
  return (
    <div className="legacy-modal-backdrop" role="dialog" aria-modal="true" style={zIndex ? { zIndex } : undefined}>
      <div className="legacy-modal">
        <div className="legacy-modal-header">
          <h3>{title}</h3>
          <button type="button" className="legacy-btn" onClick={onClose}>X</button>
        </div>
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
}: {
  label: string;
  valueLabel: string;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <label className={`legacy-field ${className ?? ""}`}>
      <span>{label}</span>
      <div className="legacy-inline">
        <input className="legacy-input" value={valueLabel || ""} placeholder="Nenhum selecionado" readOnly />
        <button type="button" className="legacy-btn" onClick={onOpen}>Pesquisar</button>
      </div>
    </label>
  );
}
function SimpleTable({ headers, rows, onRemove }: { headers: string[]; rows: string[][]; onRemove: (index: number) => void }) {
  return <div className="legacy-table-wrap mt-2"><table className="legacy-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}<th>Acoes</th></tr></thead><tbody>{rows.length === 0 && <tr><td colSpan={headers.length + 1} className="legacy-empty">Nenhum registro adicionado.</td></tr>}{rows.map((r, i) => <tr key={i}>{r.map((c, cIndex) => <td key={`${i}-${cIndex}`} className={cIndex === 0 ? "left" : ""}>{c || "-"}</td>)}<td><button type="button" className="legacy-btn" onClick={() => onRemove(i)}>Remover</button></td></tr>)}</tbody></table></div>;
}

async function fetchParceiros(search: string): Promise<ParceiroOption[]> {
  const params = new URLSearchParams();
  const term = search.trim();
  if (term) params.set("search", term);
  params.set("limit", term ? "5000" : "1000");
  params.set("_ts", String(Date.now()));
  const r = await fetch(`/api/cadastros/parceiros?${params.toString()}`, { cache: "no-store" });
  if (!r.ok) return [];
  return (await r.json()) as ParceiroOption[];
}
function labelOption(o: ParceiroOption) { return `${o.codigo ?? "SEM-COD"} - ${o.nome}`; }
function upsertParceiroOption(list: ParceiroOption[], next: ParceiroOption): ParceiroOption[] {
  const idx = list.findIndex((item) => item.id === next.id);
  if (idx < 0) return [next, ...list];
  return list.map((item, index) => (index === idx ? next : item));
}
function buildLabel(codigo: string | null, nome: string | null) { return !codigo && !nome ? "" : `${codigo ?? "SEM-COD"} - ${nome ?? ""}`.trim(); }
function parseDecimal(v: string) { const n = Number(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isNaN(n) ? 0 : n; }
function toDecimal(v: number) { return Number(v ?? 0).toFixed(2).replace(".", ","); }
function toInt(v: string) { const n = Number.parseInt((v ?? "").trim(), 10); return Number.isNaN(n) || n <= 0 ? undefined : n; }
function toSignedInt(v: string) { const n = Number.parseInt((v ?? "").trim(), 10); return Number.isNaN(n) || n === 0 ? undefined : n; }
function toStr(v: string) { const t = (v ?? "").trim(); return t.length === 0 ? undefined : t; }
function toDate(v: string) { if (!v) return "-"; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR"); }
function onlyNumber(v: string) { return v.replace(/[^0-9]/g, ""); }
function formatCurrencyBr(v: string) { const d = v.replace(/\D/g, ""); if (!d) return ""; const amount = Number.parseInt(d, 10) / 100; return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function normalizeDateForInput(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];
  const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}
function formatCep(value: string): string {
  const digits = onlyNumber(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
function normalizeAddressField(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  return text ? text.toUpperCase() : "";
}
