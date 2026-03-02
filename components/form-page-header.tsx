import Link from "next/link";

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
        <Link href={backHref} className="form-back-btn">
          <span aria-hidden>{"<"}</span>
          {backLabel}
        </Link>
        <div className="form-header-tags">
          <span className="form-header-tag">Formulario</span>
          <span className="form-header-tag">Negociacoes e Contratos</span>
        </div>
      </div>
      <h1 className="form-header-title">{title}</h1>
      {subtitle && <p className="form-header-subtitle">{subtitle}</p>}
    </section>
  );
}
