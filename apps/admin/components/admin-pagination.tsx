import Link from "next/link";
import type { Route } from "next";

export function AdminPagination({
  basePath,
  page,
  totalPages
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previousHref = `${basePath}?page=${Math.max(1, page - 1)}` as Route;
  const nextHref = `${basePath}?page=${Math.min(totalPages, page + 1)}` as Route;

  return (
    <div className="admin-actions">
      <Link aria-disabled={page <= 1} className="admin-button-secondary" href={previousHref}>
        Anterior
      </Link>
      <span className="admin-help">
        Página {page} de {totalPages}
      </span>
      <Link aria-disabled={page >= totalPages} className="admin-button-secondary" href={nextHref}>
        Siguiente
      </Link>
    </div>
  );
}
