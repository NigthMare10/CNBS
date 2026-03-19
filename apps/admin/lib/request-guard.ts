import { headers } from "next/headers";

export async function isTrustedAdminActionRequest(): Promise<boolean> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? requestHeaders.get("referer");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");

  if (!origin || !host) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host && originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
