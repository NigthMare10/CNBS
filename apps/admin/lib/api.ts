import { apiConfig, env } from "@cnbs/config";
import type { AdminSession } from "./auth";

function adminHeaders(session: AdminSession) {
  return {
    "x-cnbs-admin-secret": env.CNBS_ADMIN_API_SECRET,
    "x-cnbs-admin-user": session.user,
    "x-cnbs-admin-role": session.role
  };
}

export async function getAdminJson<T>(path: string, session: AdminSession): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    headers: adminHeaders(session),
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
    headers: adminHeaders(session),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Admin POST failed: ${path}`);
  }

  return (await response.json()) as T;
}
