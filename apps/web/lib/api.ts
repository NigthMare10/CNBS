import { apiConfig } from "@cnbs/config";

export class PublicApiError extends Error {
  constructor(readonly statusCode: number, path: string, readonly baseUrl: string, options?: ErrorOptions) {
    super(`Failed to fetch ${path} from ${baseUrl}`, options);
  }
}

async function readJson<T>(path: string): Promise<T>;
async function readJson<T>(path: string, options: { allow404: true }): Promise<T | null>;
async function readJson<T>(path: string, options?: { allow404?: boolean }): Promise<T | null> {
  let response: Response;

  try {
    response = await fetch(`${apiConfig.baseUrl}${path}`, {
      cache: "no-store"
    });
  } catch (error) {
    throw new PublicApiError(503, path, apiConfig.baseUrl, { cause: error });
  }

  if (!response.ok) {
    if (options?.allow404 && response.status === 404) {
      console.info(JSON.stringify({ event: "public_fetch_completed", path, baseUrl: apiConfig.baseUrl, status: response.status }));
      return null;
    }
    throw new PublicApiError(response.status, path, apiConfig.baseUrl);
  }

  console.info(JSON.stringify({ event: "public_fetch_completed", path, baseUrl: apiConfig.baseUrl, status: response.status }));

  return (await response.json()) as T;
}

export const publicApi = {
  overview: async () => await readJson<Record<string, unknown>>("/api/public/overview"),
  version: async () => await readJson<Record<string, unknown>>("/api/public/version"),
  rankings: async () => await readJson<Record<string, unknown>>("/api/public/rankings"),
  institution: async (institutionId: string) => await readJson<Record<string, unknown>>(`/api/public/institutions/${institutionId}`, { allow404: true })
};
