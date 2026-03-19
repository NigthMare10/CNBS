import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../../services/auth";
import { getIngestionService } from "../../services/container";
import { runtimeMetrics } from "../../services/runtime-metrics";
import { mapMultipartUploadsToInputs } from "../../services/upload-filter";

function paginationParams(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize ?? 10)));
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

  fastify.post("/ingestions", async (request, reply) => {
    await requireAdmin(request, reply, "upload");
    if (reply.sent) return;

    const service = await getIngestionService();
    const files = await request.saveRequestFiles();
    const uploadedFiles = await mapMultipartUploadsToInputs(files);

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

    return reply.code(201).send(run);
  });

  fastify.post("/publications/:ingestionRunId/publish", async (request, reply) => {
    await requireAdmin(request, reply, "publish");
    if (reply.sent) return;

    const params = request.params as { ingestionRunId: string };
    const service = await getIngestionService();
    const version = await service.publishStagedRun(params.ingestionRunId, request.adminContext?.user ?? "unknown");
    return { published: version };
  });

  fastify.post("/publications/:datasetVersionId/rollback", async (request, reply) => {
    await requireAdmin(request, reply, "rollback");
    if (reply.sent) return;

    const params = request.params as { datasetVersionId: string };
    const service = await getIngestionService();
    const version = await service.rollbackToVersion(params.datasetVersionId, request.adminContext?.user ?? "unknown");
    return { rolledBackTo: version };
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
