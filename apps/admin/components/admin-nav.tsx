import Link from "next/link";
import type { Route } from "next";
import { signOutAction } from "../app/actions";

const navLinks: Array<{ href: Route; label: string }> = [
  { href: "/admin" as Route, label: "Inicio" },
  { href: "/ingestions" as Route, label: "Ingestas" },
  { href: "/upload" as Route, label: "Carga" },
  { href: "/reconciliation" as Route, label: "Reconciliación" },
  { href: "/publish" as Route, label: "Publicar" },
  { href: "/publications" as Route, label: "Publicaciones" },
  { href: "/history" as Route, label: "Historial" },
  { href: "/audit" as Route, label: "Auditoría" }
];

export function AdminNav() {
  return (
    <header className="admin-header">
      <div className="container admin-header__inner">
        <div className="admin-header__brand">
          <p className="admin-header__eyebrow">CNBS Admin</p>
          <h1 className="admin-header__title">Centro de Carga, Validación y Publicación</h1>
        </div>
        <nav className="admin-nav">
          {navLinks.map((link) => (
            <Link className="admin-nav__link" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button className="admin-nav__button" type="submit">
              Cerrar sesión
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
