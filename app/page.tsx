import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ModuleHeader } from "@/components/module-header";
import { moduleDefinitions } from "@/lib/modules";
import { listContratosEntradaAnimais } from "@/lib/repositories/contratos-entrada-animais-repo";
import { listContratosSaidaAnimais } from "@/lib/repositories/contratos-saida-animais-repo";
import { listContratosSaidaInsumos } from "@/lib/repositories/contratos-saida-insumos-repo";
import { listVisitas } from "@/lib/repositories/visitas-repo";

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
    status: "Core em operacao",
    detail: "Fluxos de entrada e saida com filtros, edicao e emissao de PDF.",
    tone: "status-ocean",
  },
  {
    title: "Integracoes",
    status: "Conexao SAP pronta",
    detail: "Estrutura pronta para sincronizar cadastros e pedidos do Service Layer.",
    tone: "status-sunset",
  },
  {
    title: "Governanca",
    status: "Visao executiva",
    detail: "Home com leitura instantanea de volume e pendencias por frente.",
    tone: "status-emerald",
  },
] as const;

const moduleTones = ["tone-cyan", "tone-orange", "tone-green"] as const;

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

  const moduleCards = moduleDefinitions.map((module, index) => {
    const activeModuleLinks = module.links.filter((link) => link.href !== "#");
    const activeCount = activeModuleLinks.length;
    const pendingCount = module.links.length - activeCount;
    const progress = module.links.length > 0 ? Math.round((activeCount / module.links.length) * 100) : 0;

    return {
      ...module,
      activeCount,
      pendingCount,
      progress,
      tone: moduleTones[index % moduleTones.length],
      primaryLink: activeModuleLinks[0]?.href ?? null,
      quickLinks: activeModuleLinks.slice(0, 3),
    };
  });

  const kpiCards = [
    {
      label: "Modulos configurados",
      value: formatNumber(moduleDefinitions.length),
      detail: "Base estrutural ativa",
      chip: `${coverage}% cobertura`,
      tone: "tone-cyan",
    },
    {
      label: "Rotas operacionais",
      value: formatNumber(activeLinks),
      detail: "Atalhos publicados",
      chip: `${formatNumber(totalLinks)} mapeadas`,
      tone: "tone-orange",
    },
    {
      label: "Pendencias de rota",
      value: formatNumber(pendingLinks),
      detail: "Itens em roadmap",
      chip: "Backlog tecnico",
      tone: "tone-pink",
    },
    {
      label: "Contratos pendentes",
      value: formatNumber(dashboard.contratosPendentes),
      detail: "Aguardando aprovacao",
      chip: `${formatNumber(dashboard.contratosTotal)} no total`,
      tone: "tone-green",
    },
  ] as const;

  const operationCards = [
    {
      title: "Saida de Insumos",
      total: dashboard.contratosPorModulo.saidaInsumos.total,
      pending: dashboard.contratosPorModulo.saidaInsumos.pendentes,
      href: "/contratos/saida-insumos",
      tone: "tone-cyan",
    },
    {
      title: "Entrada de Insumos",
      total: dashboard.contratosPorModulo.entradaInsumos.total,
      pending: dashboard.contratosPorModulo.entradaInsumos.pendentes,
      href: "/contratos/entrada-insumos",
      tone: "tone-orange",
    },
    {
      title: "Entrada de Animais",
      total: dashboard.contratosPorModulo.entradaAnimais.total,
      pending: dashboard.contratosPorModulo.entradaAnimais.pendentes,
      href: "/contratos/entrada-animais",
      tone: "tone-green",
    },
    {
      title: "Saida de Animais",
      total: dashboard.contratosPorModulo.saidaAnimais.total,
      pending: dashboard.contratosPorModulo.saidaAnimais.pendentes,
      href: "/contratos/saida-animais",
      tone: "tone-pink",
    },
  ] as const;

  return (
    <div className="page-shell home-dashboard min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <section className="card hero-card p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="space-y-3">
              <BrandLogo compact />
              <div className="space-y-1">
                <p className="hero-kicker">CAPTAR SUITE</p>
                <h1 className="hero-title">Dashboard de Controle Executivo</h1>
                <p className="hero-subtitle">
                  Panorama moderno da operacao com foco em contratos, modulos e prioridades do dia.
                </p>
              </div>
              <div className="hero-chip-row">
                <span className="hero-chip">Atualizado: {formatDateTime(dashboard.generatedAt)}</span>
                <span className={`hero-chip ${dashboard.isLive ? "ok" : "warn"}`}>
                  {dashboard.isLive ? "Dados em tempo real" : "Modo fallback"}
                </span>
              </div>
            </div>

            <div className="hero-meta hero-meta-strong">
              <p className="hero-meta-label">Volume total</p>
              <p className="hero-meta-value">{formatNumber(dashboard.contratosTotal)} contratos</p>
              <p className="hero-meta-label mt-2">Visitas no funil</p>
              <p className="hero-meta-value">{formatNumber(dashboard.visitasTotal)}</p>
            </div>
          </div>
        </section>

        <ModuleHeader />

        <section className="dashboard-kpi-grid">
          {kpiCards.map((item) => (
            <article key={item.label} className={`card kpi-card ${item.tone} p-4`}>
              <p className="kpi-label">{item.label}</p>
              <p className="kpi-value">{item.value}</p>
              <div className="kpi-footer">
                <p className="kpi-detail">{item.detail}</p>
                <span className="kpi-chip">{item.chip}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="card dashboard-panel p-4 md:p-5">
          <div className="dashboard-head">
            <div>
              <h2 className="section-title">Painel Operacional</h2>
              <p className="dashboard-subtitle">Leitura rapida dos contratos por frente e gargalos de aprovacao.</p>
            </div>
            <Link href="/visitas" className="btn-primary text-sm">
              Abrir pipeline de visitas
            </Link>
          </div>

          <div className="ops-summary-grid">
            <article className="ops-summary-card tone-cyan">
              <p className="ops-summary-label">Visitas cadastradas</p>
              <p className="ops-summary-value">{formatNumber(dashboard.visitasTotal)}</p>
              <p className="ops-summary-detail">Leads e oportunidades no funil comercial</p>
            </article>
            <article className="ops-summary-card tone-orange">
              <p className="ops-summary-label">Contratos ativos no radar</p>
              <p className="ops-summary-value">{formatNumber(dashboard.contratosTotal)}</p>
              <p className="ops-summary-detail">Somatorio de todos os tipos de contrato</p>
            </article>
            <article className="ops-summary-card tone-pink">
              <p className="ops-summary-label">Aguardando aprovacao</p>
              <p className="ops-summary-value">{formatNumber(dashboard.contratosPendentes)}</p>
              <p className="ops-summary-detail">Prioridade para follow-up com equipe</p>
            </article>
          </div>

          <div className="ops-grid mt-3">
            {operationCards.map((item) => (
              <article key={item.title} className={`ops-card ${item.tone}`}>
                <div className="ops-card-head">
                  <p className="ops-title">{item.title}</p>
                  <span className="ops-pill">{formatNumber(item.pending)} pendentes</span>
                </div>
                <p className="ops-total">{formatNumber(item.total)}</p>
                <p className="ops-meta">Total de contratos monitorados nessa frente</p>
                <Link href={item.href} className="ops-link">
                  Abrir modulo
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {implementationStatus.map((item) => (
            <article key={item.title} className={`card compact-card modern-status-card ${item.tone} p-4`}>
              <p className="status-label">{item.title}</p>
              <p className="status-title">{item.status}</p>
              <p className="status-detail">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Resumo dos Modulos</h2>
            <span className="module-summary-note">Progresso visual baseado em links ativos por modulo</span>
          </div>

          <div className="module-summary-grid mt-3">
            {moduleCards.map((module) => (
              <article key={module.id} className={`module-summary-card ${module.tone}`}>
                <div className="module-summary-top">
                  <p className="module-summary-title">{module.label}</p>
                  <span className="module-summary-badge">{module.progress}%</span>
                </div>
                <div className="module-summary-progress" aria-hidden>
                  <span style={{ width: `${module.progress}%` }} />
                </div>
                <p className="module-summary-meta">
                  {module.activeCount} ativos - {module.pendingCount} pendentes
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
                    Ir para modulo
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
            <h2 className="section-title">Acesso Rapido: Negociacoes e Contratos</h2>
            <Link href="/contratos/saida-insumos" className="btn-secondary text-sm">
              Abrir modulo
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
              Novo contrato
            </Link>
            <Link href="/visitas/nova" className="btn-secondary">
              Nova visita
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
