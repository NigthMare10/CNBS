import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";

function defaultStorageRoot(): string {
  return process.env.CNBS_STORAGE_ROOT ?? (process.env.VERCEL ? "/tmp/cnbs-storage" : "./storage");
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
  CNBS_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000"),
  CNBS_STORAGE_ROOT: z.string().default(defaultStorageRoot())
});

export const env = envSchema.parse(process.env);

const configDir = dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = resolve(configDir, "..", "..");
export const bundledStorageRoot = resolve(workspaceRoot, "storage");

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
