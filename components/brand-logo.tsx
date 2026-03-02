interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={`brand-wrap ${compact ? "compact" : ""}`}>
      <div className="brand-mark" aria-hidden>
        <span className="petal p1" />
        <span className="petal p2" />
        <span className="petal p3" />
        <span className="petal p4" />
        <span className="petal p5" />
      </div>
      <div>
        <p className="brand-title">CAPTAR</p>
        <p className="brand-subtitle">SUÍTE</p>
      </div>
    </div>
  );
}

