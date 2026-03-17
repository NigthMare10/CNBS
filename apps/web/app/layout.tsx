import type { ReactNode } from "react";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="public-body">
        <SiteHeader />
        <main className="public-main">
          <div className="container public-stack">{children}</div>
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
