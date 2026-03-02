import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ModuleHeader } from "@/components/module-header";
import { moduleDefinitions } from "@/lib/modules";

const implementationStatus = [
  {
    title: "Negociações e Contratos",
    status: "Em desenvolvimento",
    detail: "Primeiro módulo em construção com menu completo e base das telas.",
  },
  {
    title: "Integrações",
    status: "Planejamento técnico",
    detail: "Conectores para balança, financeiro e serviços externos.",
  },
  {
    title: "Emissão de GTA",
    status: "Escopo definido",
    detail: "Fluxo pronto para iniciar regras por origem e destino.",
  },
];

export default function HomePage() {
  const firstModule = moduleDefinitions.find((module) => module.id === "negociacoes");
  const quickLinks = firstModule?.links.slice(0, 8) ?? [];

  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <section className="card hero-card p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="space-y-3">
              <BrandLogo compact />
              <div className="space-y-1">
                <p className="hero-kicker">CAPTAR SUÍTE</p>
                <h1 className="hero-title">Gestão da Fazenda de Gado</h1>
                <p className="hero-subtitle">Layout inicial simplificado para evoluir por módulo sem excesso visual.</p>
              </div>
            </div>
            <div className="hero-meta">
              <p className="hero-meta-label">Projeto</p>
              <p className="hero-meta-value">Captar Suíte</p>
              <p className="hero-meta-label mt-2">Prazo</p>
              <p className="hero-meta-value">3 meses</p>
            </div>
          </div>
        </section>

        <ModuleHeader />

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
            <Link href="#" className="btn-secondary">
              Planejar GTA
            </Link>
          </div>
          <p className="mt-3 text-xs text-[var(--ink-soft)]">
            Indicadores reais entram conforme as integrações forem ativadas para evitar dados artificiais.
          </p>
        </section>
      </main>
    </div>
  );
}

