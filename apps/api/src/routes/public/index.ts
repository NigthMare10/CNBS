import type { FastifyPluginAsync } from "fastify";
import { getIngestionService } from "../../services/container.js";

function pagination<T>(items: T[], page = 1, pageSize = 25) {
  const safePage = Number.isFinite(page) ? Math.max(page, 1) : 1;
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.min(pageSize, 200)) : 25;
  const start = (safePage - 1) * safePageSize;
  const data = items.slice(start, start + safePageSize);

  return {
    page: safePage,
    pageSize: safePageSize,
    total: items.length,
    data
  };
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export const publicRoutes: FastifyPluginAsync = async (fastify) => {
  await Promise.resolve();

  fastify.addHook("onSend", (_request, reply, payload, done) => {
    reply.header("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    done(null, payload);
  });

  fastify.get("/version", async () => {
    const service = await getIngestionService();
    return await service.getPublicVersionPayload();
  });

  fastify.get("/overview", async () => {
    const service = await getIngestionService();
    return await service.getPublicOverview();
  });

  fastify.get("/premiums/institutions", async (request) => {
    const service = await getIngestionService();
    const premiumsByInstitution = await service.getPublicPremiumsByInstitution();
    if (premiumsByInstitution.length === 0) {
      return pagination([], 1, 25);
    }

    const query = request.query as { page?: string; pageSize?: string; search?: string };
    const search = query.search?.trim().toLowerCase();
    const filtered = premiumsByInstitution.filter((item: Record<string, unknown>) => {
      if (!search) {
        return true;
      }

      return stringValue(item.institutionName)
        .toLowerCase()
        .includes(search);
    });

    return pagination(filtered, Number(query.page ?? 1), Number(query.pageSize ?? 25));
  });

  fastify.get("/premiums/lines", async (request) => {
    const service = await getIngestionService();
    const premiumsByLine = await service.getPublicPremiumsByLine();
    if (premiumsByLine.length === 0) {
      return pagination([], 1, 25);
    }

    const query = request.query as { page?: string; pageSize?: string };
    return pagination(premiumsByLine, Number(query.page ?? 1), Number(query.pageSize ?? 25));
  });

  fastify.get("/financial/institutions", async (request) => {
    const service = await getIngestionService();
    const financialHighlights = await service.getPublicFinancialHighlights();
    if (financialHighlights.length === 0) {
      return pagination([], 1, 25);
    }

    const query = request.query as { page?: string; pageSize?: string };
    return pagination(financialHighlights, Number(query.page ?? 1), Number(query.pageSize ?? 25));
  });

  fastify.get("/rankings", async () => {
    const service = await getIngestionService();
    return await service.getPublicRankings();
  });

  fastify.get("/institutions/:institutionId", async (request, reply) => {
    const service = await getIngestionService();
    const params = request.params as { institutionId: string };
    const detail = await service.getPublicInstitutionDetail(params.institutionId);
    if (!detail) {
      return reply.code(404).send({ error: { message: "Institution not found or no active dataset.", requestId: request.id } });
    }

    return detail;
  });
};
