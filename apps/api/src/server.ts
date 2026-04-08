import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { apiConfig } from "@cnbs/config";
import { authConfig, bundledStorageRoot, env, publicProjectUrl, storagePaths } from "@cnbs/config";
import { buildApp } from "./app.js";

const app = buildApp();
const appReady = Promise.resolve(app.ready()).then(() => undefined);
let startupLogged = false;

function logStartup(): void {
  if (startupLogged) {
    return;
  }

  startupLogged = true;
  app.log.info(
    {
      vercel: Boolean(process.env.VERCEL),
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      publicProjectUrl,
      apiBaseUrl: apiConfig.baseUrl,
      authMode: authConfig.mode,
      storageRoot: storagePaths.root,
      bundledStorageRoot,
      hasExplicitStorageRoot: Boolean(process.env.CNBS_STORAGE_ROOT),
      hasExplicitApiBaseUrl: Boolean(process.env.CNBS_PUBLIC_API_BASE_URL),
      adminUserConfigured: env.CNBS_ADMIN_USER,
      port: apiConfig.port
    },
    "cnbs_api_runtime_ready"
  );
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  await appReady;
  logStartup();
  app.server.emit("request", request, response);
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint && import.meta.url === pathToFileURL(entryPoint).href);
}

if (isDirectExecution() && !process.env.VERCEL) {
  appReady
    .then(async () => await app.listen({ port: apiConfig.port, host: "0.0.0.0" }))
    .then(() => {
      logStartup();
      app.log.info(`CNBS API listening on ${apiConfig.port}`);
    })
    .catch((error: unknown) => {
      app.log.error(error, "CNBS API failed to start");
      process.exit(1);
    });
}
