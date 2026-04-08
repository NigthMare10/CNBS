import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { apiConfig } from "@cnbs/config";
import handler, { app, appReady, logRuntimeStartup } from "./app.js";

export default async function vercelHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  await handler(request, response);
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint && import.meta.url === pathToFileURL(entryPoint).href);
}

if (isDirectExecution() && !process.env.VERCEL) {
  appReady
    .then(async () => await app.listen({ port: apiConfig.port, host: "0.0.0.0" }))
    .then(() => {
      logRuntimeStartup();
      app.log.info(`CNBS API listening on ${apiConfig.port}`);
    })
    .catch((error: unknown) => {
      app.log.error(error, "CNBS API failed to start");
      process.exit(1);
    });
}
