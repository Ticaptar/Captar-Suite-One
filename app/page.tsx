import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ModuleHeader } from "@/components/module-header";
import { listContratosEntradaAnimais } from "@/lib/repositories/contratos-entrada-animais-repo";
import { listContratosSaidaAnimais } from "@/lib/repositories/contratos-saida-animais-repo";
import { listContratosSaidaInsumos } from "@/lib/repositories/contratos-saida-insumos-repo";
import { listVisitas } from "@/lib/repositories/visitas-repo";
import { moduleDefinitions } from "@/lib/modules";

type DashboardData = {
  isLive: boolean;
  generatedAt: string;
  visitasTotal: number;
  contratosTotal: number;
  contratosPendentes: number;
  contratosPorModulo: {
    saidaInsumos: { total: number; pendentes: number };
    entradaInsumos: { total: number; pendentes: number };
    entradaAnimais: { total: number; pendentes: number };
    saidaAnimais: { total: number; pendentes: number };
  };
};

const implementationStatus = [
  {
    title: "Contratos",
    status: "Operação central",
    detail: "Fluxos de entrada e saída com edição completa, filtros e emissão de PDF.",
  },
  {
    title: "Integrações",
    status: "SAP B1 conectado",
    detail: "Estrutura preparada para sincronização com cadastros e pedidos do Service Layer.",
  },
  {
    title: "Governança",
    status: "Visão executiva",
    detail: "A home agora consolida indicadores dos módulos e pendências operacionais.",
  },
];

const emptyDashboard: DashboardData = {
  isLive: false,
  generatedAt: new Date().toISOString(),
  visitasTotal: 0,
  contratosTotal: 0,
  contratosPendentes: 0,
  contratosPorModulo: {
    saidaInsumos: { total: 0, pendentes: 0 },
    entradaInsumos: { total: 0, pendentes: 0 },
    entradaAnimais: { total: 0, pendentes: 0 },
    saidaAnimais: { total: 0, pendentes: 0 },
  },
};

async function loadDashboardData(): Promise<DashboardData> {
  try {
    const [
      visitas,
      saidaInsumos,
      saidaInsumosPend,
      entradaInsumos,
      entradaInsumosPend,
      entradaAnimais,
      entradaAnimaisPend,
      saidaAnimais,
      saidaAnimaisPend,
    ] = await Promise.all([
      listVisitas({ page: 1, pageSize: 1 }),
      listContratosSaidaInsumos({ page: 1, pageSize: 1, tipo: "saida_insumos" }),
      listContratosSaidaInsumos({
        page: 1,
        pageSize: 1,
        tipo: "saida_insumos",
        status: "aguardando_aprovacao",
      }),
      listContratosSaidaInsumos({ page: 1, pageSize: 1, tipo: "entrada_insumos" }),
      listContratosSaidaInsumos({
        page: 1,
        pageSize: 1,
        tipo: "entrada_insumos",
        status: "aguardando_aprovacao",
      }),
      listContratosEntradaAnimais({ page: 1, pageSize: 1 }),
      listContratosEntradaAnimais({ page: 1, pageSize: 1, status: "aguardando_aprovacao" }),
      listContratosSaidaAnimais({ page: 1, pageSize: 1 }),
      listContratosSaidaAnimais({ page: 1, pageSize: 1, status: "aguardando_aprovacao" }),
    ]);

    const contratosPorModulo = {
      saidaInsumos: { total: saidaInsumos.total, pendentes: saidaInsumosPend.total },
      entradaInsumos: { total: entradaInsumos.total, pendentes: entradaInsumosPend.total },
      entradaAnimais: { total: entradaAnimais.total, pendentes: entradaAnimaisPend.total },
      saidaAnimais: { total: saidaAnimais.total, pendentes: saidaAnimaisPend.total },
    };

    const contratosTotal =
      contratosPorModulo.saidaInsumos.total +
      contratosPorModulo.entradaInsumos.total +
      contratosPorModulo.entradaAnimais.total +
      contratosPorModulo.saidaAnimais.total;

    const contratosPendentes =
      contratosPorModulo.saidaInsumos.pendentes +
      contratosPorModulo.entradaInsumos.pendentes +
      contratosPorModulo.entradaAnimais.pendentes +
      contratosPorModulo.saidaAnimais.pendentes;

    return {
      isLive: true,
      generatedAt: new Date().toISOString(),
      visitasTotal: visitas.total,
      contratosTotal,
      contratosPendentes,
      contratosPorModulo,
    };
  } catch (error) {
    console.error("Falha ao carregar dashboard da home:", error);
    return {
      ...emptyDashboard,
      generatedAt: new Date().toISOString(),
    };
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default async function HomePage() {
  const firstModule = moduleDefinitions.find((module) => module.id === "negociacoes");
  const quickLinks = firstModule?.links.slice(0, 8) ?? [];
  const dashboard = await loadDashboardData();

  const totalLinks = moduleDefinitions.reduce((sum, module) => sum + module.links.length, 0);
  const activeLinks = moduleDefinitions.reduce(
    (sum, module) => sum + module.links.filter((link) => link.href !== "#").length,
    0,
  );
  const pendingLinks = totalLinks - activeLinks;
  const coverage = totalLinks > 0 ? Math.round((activeLinks / totalLinks) * 100) : 0;

  const moduleCards = moduleDefinitions.map((module) => {
    const activeModuleLinks = module.links.filter((link) => link.href !== "#");
    const activeCount = activeModuleLinks.length;
    const pendingCount = module.links.length - activeCount;
    const progress = module.links.length > 0 ? Math.round((activeCount / module.links.length) * 100) : 0;

    return {
      ...module,
      activeCount,
      pendingCount,
      progress,
      primaryLink: activeModuleLinks[0]?.href ?? null,
      quickLinks: activeModuleLinks.slice(0, 3),
    };
  });

  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <section className="card hero-card p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="space-y-3">
              <BrandLogo compact />
              <div className="space-y-1">
                <p className="hero-kicker">CAPTAR SUÍTE</p>
                <h1 className="hero-title">Painel Executivo Inicial</h1>
                <p className="hero-subtitle">
                  Visão consolidada de módulos, contratos e operações ativas para acelerar as decisões do dia.
                </p>
              </div>
            </div>
            <div className="hero-meta">
              <p className="hero-meta-label">Ambiente</p>
              <p className="hero-meta-value">Captar Suíte</p>
              <p className="hero-meta-label mt-2">Última leitura</p>
              <p className="hero-meta-value">{formatDateTime(dashboard.generatedAt)}</p>
            </div>
          </div>
        </section>

        <ModuleHeader />

        <section className="dashboard-kpi-grid">
          <article className="card kpi-card p-3">
            <p className="kpi-label">Módulos configurados</p>
            <p className="kpi-value">{formatNumber(moduleDefinitions.length)}</p>
            <p className="kpi-detail">Estrutura principal ativa</p>
          </article>
          <article className="card kpi-card p-3">
            <p className="kpi-label">Rotas operacionais</p>
            <p className="kpi-value">{formatNumber(activeLinks)}</p>
            <p className="kpi-detail">Atalhos já publicados</p>
          </article>
          <article className="card kpi-card p-3">
            <p className="kpi-label">Pendências de rota</p>
            <p className="kpi-value">{formatNumber(pendingLinks)}</p>
            <p className="kpi-detail">Links marcados para evolução</p>
          </article>
          <article className="card kpi-card p-3">
            <p className="kpi-label">Cobertura dos módulos</p>
            <p className="kpi-value">{coverage}%</p>
            <p className="kpi-detail">Relação entre links ativos e total</p>
          </article>
        </section>

        <section className="card dashboard-panel p-4 md:p-5">
          <div className="dashboard-head">
            <div>
              <h2 className="section-title">Dashboard Operacional</h2>
              <p className="dashboard-subtitle">Resumo de visitas e contratos por frente de trabalho.</p>
            </div>
            <span className={`dashboard-live ${dashboard.isLive ? "ok" : "warn"}`}>
              {dashboard.isLive ? "Dados reais" : "Modo fallback"}
            </span>
          </div>

          <div className="ops-summary-grid">
            <article className="ops-summary-card">
              <p className="ops-summary-label">Visitas cadastradas</p>
              <p className="ops-summary-value">{formatNumber(dashboard.visitasTotal)}</p>
              <Link href="/visitas" className="ops-summary-link">
                Abrir visitas
              </Link>
            </article>
            <article className="ops-summary-card">
              <p className="ops-summary-label">Contratos totais</p>
              <p className="ops-summary-value">{formatNumber(dashboard.contratosTotal)}</p>
              <p className="ops-summary-detail">Somando todos os tipos de contrato</p>
            </article>
            <article className="ops-summary-card">
              <p className="ops-summary-label">Aguardando aprovação</p>
              <p className="ops-summary-value">{formatNumber(dashboard.contratosPendentes)}</p>
              <p className="ops-summary-detail">Pendências críticas para follow-up</p>
            </article>
          </div>

          <div className="ops-grid mt-3">
            <article className="ops-card">
              <p className="ops-title">Saída de Insumos</p>
              <p className="ops-total">{formatNumber(dashboard.contratosPorModulo.saidaInsumos.total)}</p>
              <p className="ops-meta">Pendentes: {formatNumber(dashboard.contratosPorModulo.saidaInsumos.pendentes)}</p>
              <Link href="/contratos/saida-insumos" className="ops-link">
                Abrir módulo
              </Link>
            </article>
            <article className="ops-card">
              <p className="ops-title">Entrada de Insumos</p>
              <p className="ops-total">{formatNumber(dashboard.contratosPorModulo.entradaInsumos.total)}</p>
              <p className="ops-meta">Pendentes: {formatNumber(dashboard.contratosPorModulo.entradaInsumos.pendentes)}</p>
              <Link href="/contratos/entrada-insumos" className="ops-link">
                Abrir módulo
              </Link>
            </article>
            <article className="ops-card">
              <p className="ops-title">Entrada de Animais</p>
              <p className="ops-total">{formatNumber(dashboard.contratosPorModulo.entradaAnimais.total)}</p>
              <p className="ops-meta">Pendentes: {formatNumber(dashboard.contratosPorModulo.entradaAnimais.pendentes)}</p>
              <Link href="/contratos/entrada-animais" className="ops-link">
                Abrir módulo
              </Link>
            </article>
            <article className="ops-card">
              <p className="ops-title">Saída de Animais</p>
              <p className="ops-total">{formatNumber(dashboard.contratosPorModulo.saidaAnimais.total)}</p>
              <p className="ops-meta">Pendentes: {formatNumber(dashboard.contratosPorModulo.saidaAnimais.pendentes)}</p>
              <Link href="/contratos/saida-animais" className="ops-link">
                Abrir módulo
              </Link>
            </article>
          </div>

          {!dashboard.isLive && (
            <p className="dashboard-warning mt-3">
              Não foi possível carregar os números em tempo real. Verifique `DATABASE_URL` e as tabelas do schema `contrato`.
            </p>
          )}
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {implementationStatus.map((item) => (
            <article key={item.title} className="card compact-card p-4">
              <p className="status-label">{item.title}</p>
              <p className="status-title">{item.status}</p>
              <p className="status-detail">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Resumão dos Módulos</h2>
            <span className="module-summary-note">Progresso visual por quantidade de links ativos</span>
          </div>

          <div className="module-summary-grid mt-3">
            {moduleCards.map((module) => (
              <article key={module.id} className="module-summary-card">
                <div className="module-summary-top">
                  <p className="module-summary-title">{module.label}</p>
                  <span className="module-summary-badge">{module.progress}%</span>
                </div>
                <div className="module-summary-progress" aria-hidden>
                  <span style={{ width: `${module.progress}%` }} />
                </div>
                <p className="module-summary-meta">
                  {module.activeCount} ativos • {module.pendingCount} pendentes
                </p>
                <div className="module-summary-links">
                  {module.quickLinks.length === 0 && <span className="module-empty-link">Sem rotas publicadas</span>}
                  {module.quickLinks.map((link) => (
                    <Link key={link.label} href={link.href} className="module-chip-link">
                      {link.label}
                    </Link>
                  ))}
                </div>
                {module.primaryLink ? (
                  <Link href={module.primaryLink} className="btn-secondary text-sm">
                    Ir para módulo
                  </Link>
                ) : (
                  <span className="btn-secondary text-sm module-disabled-btn">Em planejamento</span>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Acesso Rápido: Negociações e Contratos</h2>
            <Link href="/contratos/saida-insumos" className="btn-secondary text-sm">
              Abrir módulo
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((item) => (
              <Link key={item.label} href={item.href} className="quick-link">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/contratos/saida-insumos/novo" className="btn-primary">
              Novo Contrato
            </Link>
            <Link href="/visitas/nova" className="btn-secondary">
              Nova Visita
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
