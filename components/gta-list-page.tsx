"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormPageHeader } from "@/components/form-page-header";
import { LegacyTableSkeleton } from "@/components/legacy-skeleton";
import { ModuleHeader } from "@/components/module-header";
import type { GtaListItem, GtaStatus, GtaTipo } from "@/lib/types/gta";

type GtaListPageProps = {
  routeTipo: GtaTipo;
  title: string;
  basePath: string;
};

type ListResponse = {
  items: GtaListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const statusOptions: Array<{ value: ""; label: string } | { value: GtaStatus; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "ativo", label: "Ativo" },
  { value: "desembarcado", label: "Desembarcado" },
  { value: "encerrado", label: "Encerrado" },
  { value: "cancelado", label: "Cancelado" },
];

export function GtaListPage({ routeTipo, title, basePath }: GtaListPageProps) {
  const router = useRouter();
  const [items, setItems] = useState<GtaListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState<GtaStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const created = params.get("created");
    if (created) setSuccess(`GTA #${created} criada com sucesso.`);
    const updated = params.get("updated");
    if (updated) setSuccess(`GTA #${updated} atualizada com sucesso.`);
  }, []);

  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("tipo", routeTipo);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (status) params.set("status", status);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const response = await fetch(`/api/gta?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao carregar GTA.");
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
  }, [page, pageSize, routeTipo, searchTerm, status]);

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
          title={title}
          subtitle="Cadastro e controle de GTA por tipo de movimentação."
          backHref="/"
          backLabel="Início"
        />
        <ModuleHeader />

        <section className="card p-3">
          <div className="legacy-toolbar compact-toolbar">
            <div className="legacy-toolbar-left">
              <div className="legacy-actions">
                <Link href={`${basePath}/novo`} className="legacy-btn primary">
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
                    setStatus(event.target.value as GtaStatus | "");
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

          {success && <p className="legacy-message success">{success}</p>}
          {error && <p className="legacy-message error">{error}</p>}

          <div className="legacy-table-wrap">
            <table className="legacy-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Data de Emissão</th>
                  <th>Contrato</th>
                  <th>Local</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Quantidade Machos</th>
                  <th>Quantidade Fêmeas</th>
                </tr>
              </thead>
              <tbody>
                {loading && <LegacyTableSkeleton columns={9} rows={8} />}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="legacy-empty">
                      Nenhuma GTA encontrada.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`${basePath}/novo?id=${item.id}`)}
                      className="cursor-pointer"
                      title={`Abrir GTA #${item.id}`}
                    >
                      <td>{item.numero ?? item.id}</td>
                      <td>{toDateLabel(item.dataEmissao)}</td>
                      <td className="left">{item.contrato ?? "-"}</td>
                      <td className="left">{item.local ?? "-"}</td>
                      <td>{tipoLabel(item.tipo)}</td>
                      <td>
                        <span className={`status-pill ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                      </td>
                      <td>{toNumberLabel(item.total)}</td>
                      <td>{toNumberLabel(item.quantidadeMachos)}</td>
                      <td>{toNumberLabel(item.quantidadeFemeas)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="legacy-pagination">
            <span>{paginationLabel}</span>
            <div className="legacy-actions">
              <button
                type="button"
                className="legacy-btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => prev - 1)}
              >
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

function statusLabel(status: GtaStatus): string {
  if (status === "ativo") return "Ativo";
  if (status === "desembarcado") return "Desembarcado";
  if (status === "encerrado") return "Encerrado";
  return "Cancelado";
}

function statusClass(status: GtaStatus): "synced" | "pending" | "failed" {
  if (status === "encerrado") return "synced";
  if (status === "cancelado") return "failed";
  return "pending";
}

function tipoLabel(tipo: GtaTipo): string {
  if (tipo === "entrada") return "Entrada";
  if (tipo === "saida") return "Saída";
  return "Temporária";
}

function toDateLabel(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function toNumberLabel(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value ?? 0);
}
