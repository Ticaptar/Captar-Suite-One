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
  const normalizedBackLabel = String(backLabel ?? "").trim();
  const parentLabel = normalizedBackLabel.length > 0 ? normalizedBackLabel : "Voltar";
  const showParent = backHref !== "/";

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
        </div>
      </div>
      <nav className="form-erp-breadcrumb" aria-label="Breadcrumb">
        <span className="form-erp-breadcrumb-label">Navegação</span>
        <ol className="form-erp-crumb-list">
          <li>
            <Link href="/" className="form-erp-crumb-link">
              Início
            </Link>
          </li>
          {showParent && (
            <>
              <li className="form-erp-crumb-sep" aria-hidden>
                /
              </li>
              <li>
                <Link href={backHref} className="form-erp-crumb-link">
                  {parentLabel}
                </Link>
              </li>
            </>
          )}
          <li className="form-erp-crumb-sep" aria-hidden>
            /
          </li>
          <li>
            <span className="form-erp-crumb-current" aria-current="page">
              {title}
            </span>
          </li>
        </ol>
      </nav>
      <h1 className="form-header-title">{title}</h1>
      {subtitle && <p className="form-header-subtitle">{subtitle}</p>}
    </section>
  );
}
