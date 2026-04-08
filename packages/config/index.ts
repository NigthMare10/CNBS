import { fileURLToPath } from "node:url";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";

function isVercelEnvironment(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function defaultStorageRoot(): string {
  return process.env.CNBS_STORAGE_ROOT ?? (process.env.VERCEL ? "/tmp/cnbs-storage" : "./.cnbs-storage");
}

function normalizeUrl(input: string): string {
  return new URL(z.string().url().parse(input.trim())).toString().replace(/\/$/u, "");
}

function normalizeVercelUrl(input: string | undefined): string | null {
  if (!input || input.trim().length === 0) {
    return null;
  }

  const trimmed = input.trim();
  return normalizeUrl(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
}

function resolveVercelProjectUrl(): string | null {
  return (
    normalizeVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeVercelUrl(process.env.VERCEL_BRANCH_URL) ??
    normalizeVercelUrl(process.env.VERCEL_URL)
  );
}

function inferPublicApiBaseUrlFromVercel(): string | null {
  const projectUrl = resolveVercelProjectUrl();
  if (!projectUrl) {
    return null;
  }

  const hostname = new URL(projectUrl).hostname.toLowerCase();
  if (hostname.includes("cnbs-api-rvid")) {
    return projectUrl;
  }
  if (hostname.includes("cnbs-api")) {
    return projectUrl;
  }
  if (hostname.includes("cnbs-web") || hostname.includes("cnbs-admin")) {
    return "https://cnbs-api.vercel.app";
  }

  return null;
}

function rejectLocalhostInVercel(url: string): string {
  const parsed = new URL(url);

  if (isVercelEnvironment() && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1")) {
    throw new Error("CNBS_PUBLIC_API_BASE_URL must be a public API URL in Vercel, never localhost or 127.0.0.1.");
  }

  return url;
}

function resolvePublicApiBaseUrl(input: string | undefined): string {
  if (input) {
    return rejectLocalhostInVercel(normalizeUrl(input));
  }

  const inferredApiBaseUrl = inferPublicApiBaseUrlFromVercel();
  if (inferredApiBaseUrl) {
    return inferredApiBaseUrl;
  }

  if (isVercelEnvironment()) {
    throw new Error(
      "CNBS_PUBLIC_API_BASE_URL is required in Vercel when the API URL cannot be inferred automatically for this project."
    );
  }

  return "http://localhost:4000";
}

function resolveOidcRedirectUri(input: string | undefined): string | undefined {
  if (input) {
    return normalizeUrl(input);
  }

  const projectUrl = resolveVercelProjectUrl();
  if (!projectUrl) {
    return undefined;
  }

  const hostname = new URL(projectUrl).hostname.toLowerCase();
  return hostname.includes("cnbs-admin") ? `${projectUrl}/auth/oidc/callback` : undefined;
}

function resolveOidcPostLogoutRedirectUri(input: string | undefined): string | undefined {
  if (input) {
    return normalizeUrl(input);
  }

  const projectUrl = resolveVercelProjectUrl();
  if (!projectUrl) {
    return undefined;
  }

  const hostname = new URL(projectUrl).hostname.toLowerCase();
  return hostname.includes("cnbs-admin") ? projectUrl : undefined;
}

const envSchema = z.object({
  CNBS_ADMIN_USER: z.string().default("admin"),
  CNBS_ADMIN_PASSWORD: z.string().default("change-me"),
  CNBS_ADMIN_ROLE: z.string().default("admin"),
  CNBS_ADMIN_API_SECRET: z.string().default("local-dev-secret"),
  CNBS_AUTH_MODE: z.enum(["local", "oidc"]).default("local"),
  CNBS_OIDC_ISSUER_URL: z.string().optional(),
  CNBS_OIDC_CLIENT_ID: z.string().optional(),
  CNBS_OIDC_CLIENT_SECRET: z.string().optional(),
  CNBS_OIDC_REDIRECT_URI: z.string().optional(),
  CNBS_OIDC_SCOPES: z.string().default("openid profile email"),
  CNBS_OIDC_POST_LOGOUT_REDIRECT_URI: z.string().optional(),
  CNBS_DISPLAY_TIME_ZONE: z.string().default("America/Tegucigalpa"),
  CNBS_DISPLAY_LOCALE: z.string().default("es-HN"),
  CNBS_API_PORT: z.coerce.number().int().positive().default(4000),
  CNBS_PUBLIC_API_BASE_URL: z.string().optional(),
  CNBS_STORAGE_ROOT: z.string().default(defaultStorageRoot())
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  CNBS_PUBLIC_API_BASE_URL: resolvePublicApiBaseUrl(parsedEnv.CNBS_PUBLIC_API_BASE_URL),
  CNBS_OIDC_REDIRECT_URI: resolveOidcRedirectUri(parsedEnv.CNBS_OIDC_REDIRECT_URI),
  CNBS_OIDC_POST_LOGOUT_REDIRECT_URI: resolveOidcPostLogoutRedirectUri(parsedEnv.CNBS_OIDC_POST_LOGOUT_REDIRECT_URI)
} as const;

const configDir = dirname(fileURLToPath(import.meta.url));
const configPackageRoot = basename(configDir) === "dist" ? resolve(configDir, "..") : configDir;
export const workspaceRoot = resolve(configPackageRoot, "..", "..");
export const bundledStorageRoot = resolve(workspaceRoot, "storage");
export const publicProjectUrl = resolveVercelProjectUrl();

function resolveStorageRoot(): string {
  return isAbsolute(env.CNBS_STORAGE_ROOT)
    ? env.CNBS_STORAGE_ROOT
    : resolve(workspaceRoot, env.CNBS_STORAGE_ROOT);
}

const storageRoot = resolveStorageRoot();

export const storagePaths = {
  root: storageRoot,
  quarantine: resolve(storageRoot, "quarantine"),
  staging: resolve(storageRoot, "staging"),
  published: resolve(storageRoot, "published"),
  active: resolve(storageRoot, "active"),
  audit: resolve(storageRoot, "audit")
} as const;

export const apiConfig = {
  baseUrl: env.CNBS_PUBLIC_API_BASE_URL,
  port: env.CNBS_API_PORT
} as const;

export const securityConfig = {
  uploadMaxBytes: 15 * 1024 * 1024,
  maxZipEntries: 2500,
  maxInflationRatio: 120,
  multipartFilesLimit: 5,
  publicRateLimitMax: 120,
  adminRateLimitMax: 30
} as const;

export const authConfig = {
  mode: env.CNBS_AUTH_MODE,
  oidc: {
    issuerUrl: env.CNBS_OIDC_ISSUER_URL,
    clientId: env.CNBS_OIDC_CLIENT_ID,
    clientSecret: env.CNBS_OIDC_CLIENT_SECRET,
    redirectUri: env.CNBS_OIDC_REDIRECT_URI,
    scopes: env.CNBS_OIDC_SCOPES,
    postLogoutRedirectUri: env.CNBS_OIDC_POST_LOGOUT_REDIRECT_URI
  }
} as const;

export const displayConfig = {
  timeZone: env.CNBS_DISPLAY_TIME_ZONE,
  locale: env.CNBS_DISPLAY_LOCALE
} as const;

export function isOidcConfigured(): boolean {
  return Boolean(
    authConfig.mode === "oidc" &&
      authConfig.oidc.issuerUrl &&
      authConfig.oidc.clientId &&
      authConfig.oidc.clientSecret &&
      authConfig.oidc.redirectUri
  );
}
