import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <div className="site-header__brand">
          <p className="site-header__eyebrow">CNBS</p>
          <h1 className="site-header__title">Dashboard Institucional del Sector Asegurador</h1>
        </div>
        <nav aria-label="Navegación principal" className="site-nav">
          <Link className="site-nav__link" href="/">
            Inicio
          </Link>
          <Link className="site-nav__link" href="/rankings">
            Rankings
          </Link>
          <Link className="site-nav__link" href="/version">
            Versión
          </Link>
        </nav>
      </div>
    </header>
  );
}
