import { IngestionService } from "@cnbs/etl";

let ingestionService: IngestionService | null = null;

export async function getIngestionService(): Promise<IngestionService> {
  if (!ingestionService) {
    ingestionService = new IngestionService();
    await ingestionService.initialize();
  }

  return ingestionService;
}
