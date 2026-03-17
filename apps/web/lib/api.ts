import { apiConfig } from "@cnbs/config";

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    next: { revalidate: 60 }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return (await response.json()) as T;
}

export const publicApi = {
  overview: async () => await readJson<Record<string, unknown>>("/api/public/overview"),
  version: async () => await readJson<Record<string, unknown>>("/api/public/version"),
  rankings: async () => await readJson<Record<string, unknown>>("/api/public/rankings"),
  institution: async (institutionId: string) => await readJson<Record<string, unknown>>(`/api/public/institutions/${institutionId}`)
};
