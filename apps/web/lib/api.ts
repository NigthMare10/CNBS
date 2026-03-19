import { apiConfig } from "@cnbs/config";

export class PublicApiError extends Error {
  constructor(readonly statusCode: number, path: string) {
    super(`Failed to fetch ${path}`);
  }
}

async function readJson<T>(path: string): Promise<T>;
async function readJson<T>(path: string, options: { allow404: true }): Promise<T | null>;
async function readJson<T>(path: string, options?: { allow404?: boolean }): Promise<T | null> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    next: { revalidate: 15 }
  });

  if (!response.ok) {
    if (options?.allow404 && response.status === 404) {
      return null;
    }
    throw new PublicApiError(response.status, path);
  }

  return (await response.json()) as T;
}

export const publicApi = {
  overview: async () => await readJson<Record<string, unknown>>("/api/public/overview"),
  version: async () => await readJson<Record<string, unknown>>("/api/public/version"),
  rankings: async () => await readJson<Record<string, unknown>>("/api/public/rankings"),
  institution: async (institutionId: string) => await readJson<Record<string, unknown>>(`/api/public/institutions/${institutionId}`, { allow404: true })
};
