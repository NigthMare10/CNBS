import { apiConfig } from "@cnbs/config";
import { buildApp } from "./app";

const app = buildApp();

app
  .listen({ port: apiConfig.port, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`CNBS API listening on ${apiConfig.port}`);
  })
  .catch((error) => {
    app.log.error(error, "CNBS API failed to start");
    process.exit(1);
  });
