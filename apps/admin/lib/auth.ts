import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig, env, isOidcConfigured } from "@cnbs/config";

const COOKIE_NAME = "cnbs-admin-session";

export interface AdminSession {
  user: string;
  role: string;
  provider: "local" | "oidc";
}

function authMode(): "local" | "oidc" {
  return authConfig.mode === "oidc" && isOidcConfigured() ? "oidc" : "local";
}

function sessionCookieValue(session: AdminSession): string {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: sessionCookieValue(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AdminSession>;
    return {
      user: typeof parsed.user === "string" ? parsed.user : env.CNBS_ADMIN_USER,
      role: typeof parsed.role === "string" ? parsed.role : env.CNBS_ADMIN_ROLE,
      provider: parsed.provider === "oidc" ? "oidc" : "local"
    };
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect((authMode() === "oidc" ? "/auth/oidc/login" : "/") as never);
  }

  return session;
}

export async function createAdminSession(input: { username: string; password: string }): Promise<boolean> {
  if (authMode() !== "local") {
    return false;
  }

  if (input.username !== env.CNBS_ADMIN_USER || input.password !== env.CNBS_ADMIN_PASSWORD) {
    return false;
  }

  await setAdminSession({ user: env.CNBS_ADMIN_USER, role: env.CNBS_ADMIN_ROLE, provider: "local" });
  return true;
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function getAdminAuthMode() {
  return authMode();
}

export function isOidcModeEnabled(): boolean {
  return authMode() === "oidc";
}
