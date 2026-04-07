import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { apiConfig } from "@cnbs/config";
import { buildApp } from "./app";

const app = buildApp();
const appReady = Promise.resolve(app.ready()).then(() => undefined);

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  await appReady;
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
      app.log.info(`CNBS API listening on ${apiConfig.port}`);
    })
    .catch((error: unknown) => {
      app.log.error(error, "CNBS API failed to start");
      process.exit(1);
    });
}
