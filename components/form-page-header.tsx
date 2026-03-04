import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

type FormPageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
};

export function FormPageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Voltar",
}: FormPageHeaderProps) {
  return (
    <section className="card form-header-shell p-3">
      <div className="form-header-top">
        <div className="form-header-brand">
          <BrandLogo compact />
        </div>
        <div className="form-header-actions">
          <div className="form-header-tags">
            <span className="form-header-tag">Formulário</span>
            <span className="form-header-tag">Negociações e Contratos</span>
          </div>
          <Link href={backHref} className="form-back-btn" aria-label={backLabel}>
            <span aria-hidden>{"<"}</span> {backLabel}
          </Link>
        </div>
      </div>
      <h1 className="form-header-title">{title}</h1>
      {subtitle && <p className="form-header-subtitle">{subtitle}</p>}
    </section>
  );
}
