import { Card } from "@cnbs/ui";
import { getAdminAuthMode } from "../lib/auth";
import { signInAction } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const authMode = getAdminAuthMode();

  return (
    <main className="admin-auth">
      <div className="container admin-auth__layout">
        <section className="admin-auth__panel">
          <p className="admin-auth__eyebrow">Acceso Institucional</p>
          <h1 className="admin-auth__title">Panel operativo para cargar, validar y publicar datasets CNBS.</h1>
          <p className="admin-auth__copy">
            Este entorno separa estrictamente la carga administrativa del consumo público. Desde aquí puedes ejecutar el flujo
            completo de carga manual, revisión, publicación y rollback de versiones.
          </p>

          <ul className="admin-auth__list">
            <li>Subida manual de los 3 workbooks esperados con validación estructural.</li>
            <li>Revisión de staging, reconciliación y publicación atómica de la versión activa.</li>
            <li>Trazabilidad operacional mediante historial y auditoría del ciclo de datos.</li>
          </ul>

          <div className="admin-auth__meta">
            <span>Ruta inicial recomendada: `http://localhost:3001/`</span>
            <span>Acceso local por defecto: usuario `admin`, contraseña `change-me`</span>
          </div>
        </section>

        <Card title="Acceso administrativo" subtitle="Carga manual, validación, publicación y rollback">
          <div className="admin-page">
            {params.error === "invalid_credentials" && (
              <div className="admin-alert--error">Las credenciales ingresadas no son válidas para el entorno local.</div>
            )}
            {authMode === "local" ? (
              <form action={signInAction} className="admin-form">
                <label className="admin-field">
                  <span className="admin-label">Usuario</span>
                  <input className="admin-input" name="username" type="text" placeholder="Ingresa tu usuario" />
                </label>
                <label className="admin-field">
                  <span className="admin-label">Contraseña</span>
                  <input className="admin-input" name="password" type="password" placeholder="Ingresa tu contraseña" />
                </label>
                <div className="admin-help">
                  La sesión se mantiene con una cookie local segura y habilita el acceso a las rutas protegidas del panel.
                </div>
                <button className="admin-button" type="submit">
                  Ingresar al panel
                </button>
              </form>
            ) : (
              <form action={signInAction} className="admin-form">
                <div className="admin-inline-note">
                  El entorno está configurado para autenticación corporativa vía OIDC/SSO.
                </div>
                <button className="admin-button" type="submit">
                  Ingresar con SSO
                </button>
              </form>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
