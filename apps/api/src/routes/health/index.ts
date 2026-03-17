import type { FastifyPluginAsync } from "fastify";
import { getIngestionService } from "../../services/container";
import { runtimeMetrics } from "../../services/runtime-metrics";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  await Promise.resolve();

  fastify.get("/live", async () => {
    const service = await getIngestionService();
    const status = await service.getOperationalStatus();

    return {
      status: "ok",
      time: new Date().toISOString(),
      activeDatasetVersion: status.activeDataset?.datasetVersionId ?? null,
      activeDatasetPublishedAt: status.activeDataset?.publishedAt ?? null,
      cache: status.storageMetrics.cache,
      publicRouteMetrics: runtimeMetrics.snapshot().filter((metric) => metric.route.startsWith("/api/public/"))
    };
  });

  fastify.get("/ready", async () => {
    const service = await getIngestionService();
    const status = await service.getOperationalStatus();

    return {
      status: "ready",
      time: new Date().toISOString(),
      activeDatasetVersion: status.activeDataset?.datasetVersionId ?? null,
      activeDatasetPublishedAt: status.activeDataset?.publishedAt ?? null,
      counts: status.counts,
      cache: status.storageMetrics.cache,
      storage: status.storageMetrics.storage,
      routeMetrics: runtimeMetrics.snapshot()
    };
  });
};
