"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { LegacyTableSkeleton } from "@/components/legacy-skeleton";
import { ModuleHeader } from "@/components/module-header";
import type { VisitaListItem, VisitaStatus } from "@/lib/types/visita";

type ListResponse = {
  items: VisitaListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const statusOptions: Array<{ value: ""; label: string } | { value: VisitaStatus; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "oportunidade", label: "Oportunidade" },
  { value: "em_analise", label: "Em análise" },
  { value: "negociacao", label: "Negociação" },
  { value: "contrato_gerado", label: "Contrato gerado" },
  { value: "perdida", label: "Perdida" },
  { value: "arquivada", label: "Arquivada" },
];

export default function VisitasListPage() {
  const [items, setItems] = useState<VisitaListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<VisitaStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCreatedId(params.get("created"));
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
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const response = await fetch(`/api/visitas?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao carregar visitas.");
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
  }, [page, pageSize, searchTerm, status]);

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
          title="Visitas"
          subtitle="Pré-contrato para registrar leads, oportunidades e gerar contrato."
          backHref="/"
          backLabel="Início"
        />
        <ModuleHeader />

        <section className="card p-3">
          <div className="legacy-toolbar compact-toolbar">
            <div className="legacy-toolbar-left">
              <h1 className="legacy-title">Visita</h1>
              <div className="legacy-actions">
                <Link href="/visitas/nova" className="legacy-btn primary">
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
                    setStatus(event.target.value as VisitaStatus | "");
                    setPage(1);
                  }}
                >
                  {statusOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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

          {createdId && <p className="legacy-message success">Visita #{createdId} criada com sucesso.</p>}
          {error && <p className="legacy-message error">{error}</p>}

          <div className="legacy-table-wrap">
            <table className="legacy-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>ID</th>
                  <th>Data Visita</th>
                  <th>Parceiro</th>
                  <th>Responsavel</th>
                  <th>Endereço</th>
                  <th>Rebanho Atual</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && <LegacyTableSkeleton columns={8} rows={8} />}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="legacy-empty">Nenhuma visita encontrada.</td>
                  </tr>
                )}
                {!loading &&
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className={`status-pill ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                      </td>
                      <td>{item.id}</td>
                      <td>{toDateLabel(item.dataVisita)}</td>
                      <td className="left">{item.parceiro ?? "-"}</td>
                      <td className="left">{item.responsavel ?? "-"}</td>
                      <td className="left">{item.endereco ?? "-"}</td>
                      <td>{toMoney(item.rebanhoAtual)}</td>
                      <td>
                        <Link href={`/visitas/${item.id}`} className="legacy-btn">
                          Abrir
                        </Link>
                      </td>
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

function statusLabel(status: VisitaStatus): string {
  switch (status) {
    case "oportunidade":
      return "Oportunidade";
    case "em_analise":
      return "Em análise";
    case "negociacao":
      return "Negociação";
    case "contrato_gerado":
      return "Contrato gerado";
    case "perdida":
      return "Perdida";
    case "arquivada":
      return "Arquivada";
    default:
      return status;
  }
}

function statusClass(status: VisitaStatus): "synced" | "pending" | "failed" {
  if (status === "contrato_gerado") return "synced";
  if (status === "perdida" || status === "arquivada") return "failed";
  return "pending";
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
