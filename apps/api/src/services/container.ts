import { IngestionService } from "@cnbs/etl";
import { storagePaths } from "@cnbs/config";

let ingestionService: IngestionService | null = null;
let ingestionServicePromise: Promise<IngestionService> | null = null;

export async function getIngestionService(): Promise<IngestionService> {
  if (!ingestionService) {
    ingestionServicePromise ??= (async () => {
      console.info(
        JSON.stringify({
          event: "ingestion_service_initializing",
          vercel: Boolean(process.env.VERCEL),
          storageRoot: storagePaths.root
        })
      );

      const service = new IngestionService();
      await service.initialize();
      ingestionService = service;

      console.info(
        JSON.stringify({
          event: "ingestion_service_ready",
          vercel: Boolean(process.env.VERCEL),
          storageRoot: storagePaths.root
        })
      );

      return service;
    })().catch((error: unknown) => {
      ingestionServicePromise = null;
      console.error(
        JSON.stringify({
          event: "ingestion_service_failed",
          vercel: Boolean(process.env.VERCEL),
          storageRoot: storagePaths.root,
          error: error instanceof Error ? error.message : String(error)
        })
      );
      throw error;
    });

    await ingestionServicePromise;
  }

  if (!ingestionService) {
    throw new Error("Ingestion service failed to initialize.");
  }

  return ingestionService;
}
