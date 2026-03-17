import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { completeOidcLogin } from "../../../../lib/oidc";

export async function GET(request: NextRequest) {
  try {
    await completeOidcLogin(request.url);
    return NextResponse.redirect(new URL("/upload", request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "oidc_login_failed";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, request.url));
  }
}
