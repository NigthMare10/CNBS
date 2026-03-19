import { apiConfig, env } from "@cnbs/config";
import { createSignedToken } from "@cnbs/domain";
import type { AdminSession } from "./auth";

export function buildAdminApiHeaders(session: AdminSession) {
  return {
    "x-cnbs-admin-secret": env.CNBS_ADMIN_API_SECRET,
    "x-cnbs-admin-auth": createSignedToken(
      {
        user: session.user,
        role: session.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 5 * 60
      },
      `${env.CNBS_ADMIN_API_SECRET}:service`
    )
  };
}

export async function getAdminJson<T>(path: string, session: AdminSession): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    headers: buildAdminApiHeaders(session),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Admin request failed: ${path}`);
  }

  return (await response.json()) as T;
}

export async function postAdminJson<T>(path: string, session: AdminSession): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    method: "POST",
    headers: buildAdminApiHeaders(session),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Admin POST failed: ${path}`);
  }

  return (await response.json()) as T;
}
