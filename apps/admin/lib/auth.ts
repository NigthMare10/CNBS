import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSignedToken, verifySignedToken } from "@cnbs/domain";
import { authConfig, env, isOidcConfigured } from "@cnbs/config";

const COOKIE_NAME = "cnbs-admin-session";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

const adminRoles = ["admin", "uploader", "validator", "publisher", "auditor"] as const;
type AdminRole = (typeof adminRoles)[number];

export interface AdminSession {
  user: string;
  role: AdminRole;
  provider: "local" | "oidc";
}

interface SessionTokenPayload {
  user: string;
  role: AdminRole;
  provider: AdminSession["provider"];
  iat: number;
  exp: number;
}

function sessionSecret(): string {
  return `${env.CNBS_ADMIN_API_SECRET}:session`;
}

function normalizeAdminRole(value: string): AdminRole | null {
  return adminRoles.includes(value as AdminRole) ? (value as AdminRole) : null;
}

function authMode(): "local" | "oidc" {
  return authConfig.mode === "oidc" && isOidcConfigured() ? "oidc" : "local";
}

function sessionCookieValue(session: AdminSession): string {
  const now = Math.floor(Date.now() / 1000);
  return createSignedToken(
    {
      user: session.user,
      role: session.role,
      provider: session.provider,
      iat: now,
      exp: now + SESSION_MAX_AGE_SECONDS
    } satisfies SessionTokenPayload,
    sessionSecret()
  );
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: sessionCookieValue(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;

  if (!value) {
    return null;
  }

  try {
    const parsed = verifySignedToken<SessionTokenPayload>(value, sessionSecret());
    const role = parsed ? normalizeAdminRole(parsed.role) : null;
    if (!parsed || !role || parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      user: parsed.user,
      role,
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

  const role = normalizeAdminRole(env.CNBS_ADMIN_ROLE);
  if (!role) {
    return false;
  }

  if (input.username !== env.CNBS_ADMIN_USER || input.password !== env.CNBS_ADMIN_PASSWORD) {
    return false;
  }

  await setAdminSession({ user: env.CNBS_ADMIN_USER, role, provider: "local" });
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
