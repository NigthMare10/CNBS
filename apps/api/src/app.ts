import type { IncomingMessage, ServerResponse } from "node:http";
import Fastify from "fastify";
import compress from "@fastify/compress";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { apiConfig, authConfig, bundledStorageRoot, env, publicProjectUrl, securityConfig, storagePaths } from "@cnbs/config";
import { adminRoutes } from "./routes/admin/index.js";
import { healthRoutes } from "./routes/health/index.js";
import { publicRoutes } from "./routes/public/index.js";
import { runtimeMetrics } from "./services/runtime-metrics.js";

declare module "fastify" {
  interface FastifyRequest {
    _startedAt?: number;
    _responseBytes?: number;
  }
}

export function buildApp() {
  const logger =
    process.env.NODE_ENV === "development"
      ? ({ level: "info", transport: { target: "pino-pretty" } } as const)
      : ({ level: "info" } as const);

  const app = Fastify({
    logger
  });

  app.addHook("onRequest", (request, _reply, done) => {
    request._startedAt = performance.now();
    done();
  });

  app.addHook("onSend", (request, _reply, payload, done) => {
    if (typeof payload === "string") {
      request._responseBytes = Buffer.byteLength(payload);
    } else if (Buffer.isBuffer(payload)) {
      request._responseBytes = payload.byteLength;
    } else {
      request._responseBytes = 0;
    }
    done(null, payload);
  });

  app.addHook("onResponse", (request, reply, done) => {
    const route = request.routeOptions.url;
    if (typeof route === "string" && (route.startsWith("/api/") || route.startsWith("/health/"))) {
      runtimeMetrics.record({
        route,
        statusCode: reply.statusCode,
        durationMs: performance.now() - (request._startedAt ?? performance.now()),
        payloadBytes: request._responseBytes ?? 0
      });
    }
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        err: error,
        method: request.method,
        url: request.url,
        route: request.routeOptions.url,
        requestId: request.id
      },
      "request_failed"
    );
    void reply.code(500).send({
      error: {
        message: "Internal server error.",
        requestId: request.id
      }
    });
  });

  void app.register(cors, { origin: true });
  void app.register(compress, { global: true, encodings: ["br", "gzip", "deflate"] });
  void app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", apiConfig.baseUrl],
        frameAncestors: ["'none'"]
      }
    }
  });
  void app.register(rateLimit, { max: securityConfig.publicRateLimitMax, timeWindow: "1 minute" });
  void app.register(multipart, {
    limits: {
      files: securityConfig.multipartFilesLimit,
      fileSize: securityConfig.uploadMaxBytes
    },
    attachFieldsToBody: false
  });

  void app.register(healthRoutes, { prefix: "/health" });
  void app.register(publicRoutes, { prefix: "/api/public" });
  void app.register(adminRoutes, { prefix: "/api/admin" });

  return app;
}

export const app = buildApp();
export const appReady = Promise.resolve(app.ready()).then(() => undefined);

let startupLogged = false;

export function logRuntimeStartup(): void {
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
  logRuntimeStartup();
  app.server.emit("request", request, response);
}
