"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { ModuleHeader } from "@/components/module-header";
import type { ContratoEntradaAnimaisListItem, ContratoStatus } from "@/lib/types/contrato";

type ListResponse = {
  items: ContratoEntradaAnimaisListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const statusOptions: Array<{ value: ""; label: string } | { value: ContratoStatus; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "ativo", label: "Ativo" },
  { value: "contendo_parc", label: "Conferido Parcialmente" },
  { value: "encerrado", label: "Encerrado" },
  { value: "inativo_cancelado", label: "Inativo/Cancelado" },
];

export default function ContratoEntradaAnimaisListPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContratoEntradaAnimaisListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState<ContratoStatus | "">("");
  const [exercicio, setExercicio] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCreatedId(params.get("created"));
    const updated = params.get("updated");
    if (updated) setSuccess(`Contrato #${updated} atualizado com sucesso.`);
  }, []);

  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (status) params.set("status", status);
      if (exercicio.trim()) params.set("exercicio", exercicio.trim());
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const response = await fetch(`/api/contratos/entrada-animais?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao carregar contratos.");
      }

      const data = (await response.json()) as ListResponse;
      setItems(data.items);
      setTotal(data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [exercicio, page, pageSize, searchTerm, status]);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  const paginationLabel = useMemo(() => {
    if (total === 0) return "0 - 0 / 0";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start} - ${end} / ${total}`;
  }, [page, pageSize, total]);

  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <FormPageHeader
          title="Contratos de Entrada de Animais"
          subtitle="Consulte, filtre e acompanhe o status dos contratos em um único painel."
          backHref="/"
          backLabel="Início"
        />
        <ModuleHeader />

        <section className="card p-3">
          <div className="legacy-toolbar">
            <div className="legacy-toolbar-left">
              <h1 className="legacy-title">Contrato de Entrada de Animais</h1>
              <div className="legacy-actions">
                <Link href="/contratos/entrada-animais/novo" className="legacy-btn primary">
                  Criar
                </Link>
                <button type="button" className="legacy-btn" onClick={() => loadData()} disabled={loading}>
                  {loading ? "Atualizando..." : "Atualizar"}
                </button>
              </div>
            </div>
            <div className="legacy-toolbar-right">
              <input
                className="legacy-input search"
                placeholder="Pesquisar..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setPage(1);
                    setSearchTerm(searchInput);
                  }
                }}
              />
              <div className="legacy-filters">
                <select
                  className="legacy-select"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as ContratoStatus | "");
                    setPage(1);
                  }}
                >
                  {statusOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  className="legacy-input short"
                  placeholder="Exercício"
                  value={exercicio}
                  onChange={(event) => {
                    setExercicio(event.target.value.replace(/[^0-9]/g, "").slice(0, 4));
                    setPage(1);
                  }}
                />
                <button
                  type="button"
                  className="legacy-btn"
                  onClick={() => {
                    setPage(1);
                    setSearchTerm(searchInput);
                  }}
                >
                  Filtrar
                </button>
              </div>
            </div>
          </div>

          {createdId && (
            <p className="legacy-message success">
              Contrato #{createdId} criado com sucesso.
            </p>
          )}

          {success && <p className="legacy-message success">{success}</p>}
          {error && <p className="legacy-message error">{error}</p>}

          <div className="legacy-table-wrap">
            <table className="legacy-table">
              <thead>
                <tr>
                  <th>Exercício</th>
                  <th>ID</th>
                  <th>Referência do Contrato</th>
                  <th>Número</th>
                  <th>Parceiro</th>
                  <th>Status</th>
                  <th>Tipo de Contrato</th>
                  <th>Início</th>
                  <th>Valor Pago SAP</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="legacy-empty">
                      Carregando contratos...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="legacy-empty">
                      Nenhum contrato encontrado.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/contratos/entrada-animais/novo?id=${item.id}`)}
                      className="cursor-pointer"
                      title={`Abrir contrato #${item.id}`}
                    >
                      <td>{item.exercicio}</td>
                      <td>{item.id}</td>
                      <td className="left">{item.referenciaContrato}</td>
                      <td>{item.numero}</td>
                      <td className="left">{item.parceiro ?? "-"}</td>
                      <td>
                        <span className={`status-pill ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                      </td>
                      <td>{tipoLabel(item.tipoContrato)}</td>
                      <td>{toDateLabel(item.inicioEm)}</td>
                      <td>{toMoney(item.valorPagoSap)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="legacy-pagination">
            <span>{paginationLabel}</span>
            <div className="legacy-actions">
              <button type="button" className="legacy-btn" disabled={page <= 1 || loading} onClick={() => setPage((prev) => prev - 1)}>
                {"<"}
              </button>
              <button
                type="button"
                className="legacy-btn"
                disabled={page >= maxPage || loading}
                onClick={() => setPage((prev) => prev + 1)}
              >
                {">"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function statusLabel(status: ContratoStatus): string {
  switch (status) {
    case "aguardando_aprovacao":
      return "Aguardando aprovação";
    case "ativo":
      return "Ativo";
    case "contendo_parc":
      return "Conferido Parcialmente";
    case "encerrado":
      return "Encerrado";
    case "inativo_cancelado":
      return "Inativo/Cancelado";
    default:
      return status;
  }
}

function statusClass(status: ContratoStatus): "synced" | "pending" | "failed" {
  if (status === "ativo") return "synced";
  if (status === "encerrado" || status === "inativo_cancelado") return "failed";
  return "pending";
}

function tipoLabel(tipo: string): string {
  if (tipo === "entrada_animais") return "Entrada de Animais";
  return tipo;
}

function toDateLabel(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function toMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

