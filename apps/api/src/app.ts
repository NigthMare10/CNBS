import Fastify from "fastify";
import compress from "@fastify/compress";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { apiConfig, securityConfig } from "@cnbs/config";
import { adminRoutes } from "./routes/admin";
import { healthRoutes } from "./routes/health";
import { publicRoutes } from "./routes/public";
import { runtimeMetrics } from "./services/runtime-metrics";

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
    request.log.error({ err: error }, "request_failed");
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
