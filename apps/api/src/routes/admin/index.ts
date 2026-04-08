import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { securityConfig } from "@cnbs/config";
import { requireAdmin } from "../../services/auth.js";
import { getIngestionService } from "../../services/container.js";
import { runtimeMetrics } from "../../services/runtime-metrics.js";
import { mapMultipartUploadsToInputs } from "../../services/upload-filter.js";

function paginationParams(query: { page?: string; pageSize?: string }) {
  const requestedPage = Number(query.page ?? 1);
  const requestedPageSize = Number(query.pageSize ?? 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = Number.isFinite(requestedPageSize) ? Math.max(1, Math.min(100, requestedPageSize)) : 10;
  return { page, pageSize };
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages
  };
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

async function respondOperationalError(reply: FastifyReply, requestId: string, error: unknown) {
  if (isFileNotFound(error)) {
    return await reply.code(404).send({
      error: {
        message: "Requested admin resource was not found.",
        requestId
      }
    });
  }

  if (error instanceof Error && /blocked from publication/i.test(error.message)) {
    return await reply.code(409).send({
      error: {
        message: error.message,
        requestId
      }
    });
  }

  throw error;
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  await Promise.resolve();

  fastify.get("/system/status", async (request, reply) => {
    await requireAdmin(request, reply, "view");
    if (reply.sent) return;

    const service = await getIngestionService();
    const status = await service.getOperationalStatus();

    return {
      ...status,
      routeMetrics: runtimeMetrics.snapshot(),
      time: new Date().toISOString()
    };
  });

  fastify.get("/ingestions", async (request, reply) => {
    await requireAdmin(request, reply, "view");
    if (reply.sent) return;

    const service = await getIngestionService();
    const query = request.query as { page?: string; pageSize?: string; detail?: string };
    const runs = (query.detail === "full" ? await service.listStagedRuns() : await service.listStagedRunSummaries())
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const { page, pageSize } = paginationParams(query);
    return paginate(runs, page, pageSize);
  });

  fastify.get("/ingestions/:ingestionRunId", async (request, reply) => {
    await requireAdmin(request, reply, "view");
    if (reply.sent) return;

    const service = await getIngestionService();
    const params = request.params as { ingestionRunId: string };

    try {
      return await service.getStagedRun(params.ingestionRunId);
    } catch (error) {
      return await respondOperationalError(reply, request.id, error);
    }
  });

  fastify.post("/ingestions", {
    config: {
      rateLimit: {
        max: securityConfig.adminRateLimitMax,
        timeWindow: "1 minute"
      }
    }
  }, async (request, reply) => {
    await requireAdmin(request, reply, "upload");
    if (reply.sent) return;

    const service = await getIngestionService();
    request.log.info(
      {
        requestId: request.id,
        actor: request.adminContext?.user ?? "unknown"
      },
      "upload_started"
    );

    try {
      const files = await request.saveRequestFiles();
      request.log.info(
        {
          requestId: request.id,
          fileCount: files.length,
          filenames: files.map((file) => file.filename)
        },
        "upload_received"
      );

      const uploadedFiles = await mapMultipartUploadsToInputs(files);
      request.log.info(
        {
          requestId: request.id,
          acceptedFileCount: uploadedFiles.length,
          filenames: uploadedFiles.map((file) => file.originalFilename)
        },
        "upload_validated"
      );

      if (uploadedFiles.length === 0) {
        return reply.code(400).send({
          error: {
            message: "No valid workbook files were provided.",
            requestId: request.id
          }
        });
      }

      const run = await service.ingestWorkbookSet({
        uploadedBy: request.adminContext?.user ?? "unknown",
        files: uploadedFiles
      });

      request.log.info(
        {
          requestId: request.id,
          ingestionRunId: run.ingestionRunId,
          publicationState: run.publicationState,
          publishability: run.validationSummary.publishability
        },
        "upload_stored"
      );

      return reply.code(201).send(run);
    } catch (error) {
      request.log.error(
        {
          err: error,
          requestId: request.id,
          actor: request.adminContext?.user ?? "unknown"
        },
        "upload_failed"
      );
      throw error;
    }
  });

  fastify.post("/publications/:ingestionRunId/publish", {
    config: {
      rateLimit: {
        max: securityConfig.adminRateLimitMax,
        timeWindow: "1 minute"
      }
    }
  }, async (request, reply) => {
    await requireAdmin(request, reply, "publish");
    if (reply.sent) return;

    const params = request.params as { ingestionRunId: string };
    const service = await getIngestionService();
    try {
      const version = await service.publishStagedRun(params.ingestionRunId, request.adminContext?.user ?? "unknown");
      return { published: version };
    } catch (error) {
      return await respondOperationalError(reply, request.id, error);
    }
  });

  fastify.post("/publications/:datasetVersionId/rollback", {
    config: {
      rateLimit: {
        max: securityConfig.adminRateLimitMax,
        timeWindow: "1 minute"
      }
    }
  }, async (request, reply) => {
    await requireAdmin(request, reply, "rollback");
    if (reply.sent) return;

    const params = request.params as { datasetVersionId: string };
    const service = await getIngestionService();
    try {
      const version = await service.rollbackToVersion(params.datasetVersionId, request.adminContext?.user ?? "unknown");
      return { rolledBackTo: version };
    } catch (error) {
      return await respondOperationalError(reply, request.id, error);
    }
  });

  fastify.get("/publications", async (request, reply) => {
    await requireAdmin(request, reply, "view");
    if (reply.sent) return;

    const service = await getIngestionService();
    const query = request.query as { page?: string; pageSize?: string };
    const versions = (await service.listPublishedDatasetSummaries())
      .slice()
      .sort((left, right) => String(right.publishedAt ?? right.createdAt).localeCompare(String(left.publishedAt ?? left.createdAt)));
    const { page, pageSize } = paginationParams(query);
    return paginate(versions, page, pageSize);
  });

  fastify.get("/audit", async (request, reply) => {
    await requireAdmin(request, reply, "audit");
    if (reply.sent) return;

    const service = await getIngestionService();
    const query = request.query as { page?: string; pageSize?: string };
    const events = (await service.listAuditEventSummaries()).slice().sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const { page, pageSize } = paginationParams(query);
    return paginate(events, page, pageSize);
  });
};
