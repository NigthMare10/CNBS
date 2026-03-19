import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig, env, isOidcConfigured } from "@cnbs/config";
import { generators, Issuer } from "openid-client";
import { setAdminSession } from "./auth";

const STATE_COOKIE = "cnbs-admin-oidc-state";
const VERIFIER_COOKIE = "cnbs-admin-oidc-verifier";
const NONCE_COOKIE = "cnbs-admin-oidc-nonce";

async function getOidcClient() {
  if (!isOidcConfigured()) {
    throw new Error("OIDC is not configured.");
  }

  const issuerUrl = authConfig.oidc.issuerUrl;
  const clientId = authConfig.oidc.clientId;
  const clientSecret = authConfig.oidc.clientSecret;
  const redirectUri = authConfig.oidc.redirectUri;

  if (!issuerUrl || !clientId || !clientSecret || !redirectUri) {
    throw new Error("OIDC configuration is incomplete.");
  }

  const issuer = await Issuer.discover(issuerUrl);
  return new issuer.Client({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
    response_types: ["code"]
  });
}

export async function beginOidcLogin(): Promise<never> {
  const client = await getOidcClient();
  const cookieStore = await cookies();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state = generators.state();
  const nonce = generators.nonce();

  for (const [name, value] of [
    [STATE_COOKIE, state],
    [VERIFIER_COOKIE, codeVerifier],
    [NONCE_COOKIE, nonce]
  ] as const) {
    cookieStore.set({
      name,
      value,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
  }

  const authorizationUrl = client.authorizationUrl({
    scope: authConfig.oidc.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce
  });

  redirect(authorizationUrl as never);
}

export async function completeOidcLogin(currentUrl: string): Promise<void> {
  const client = await getOidcClient();
  const cookieStore = await cookies();
  const state = cookieStore.get(STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value;
  const nonce = cookieStore.get(NONCE_COOKIE)?.value;

  if (!state || !codeVerifier || !nonce) {
    throw new Error("OIDC login session is missing state or PKCE verifier.");
  }

  const callbackUrl = new URL(currentUrl);
  const params = client.callbackParams(callbackUrl.toString());
  const redirectUri = authConfig.oidc.redirectUri;
  if (!redirectUri) {
    throw new Error("OIDC redirect URI is missing.");
  }

  const tokenSet = await client.callback(redirectUri, params, {
    state,
    nonce,
    code_verifier: codeVerifier
  });
  const claims = tokenSet.claims();
  const user =
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    (typeof claims.email === "string" && claims.email) ||
    claims.sub;
  const role = env.CNBS_ADMIN_ROLE;
  if (role !== "admin" && role !== "uploader" && role !== "validator" && role !== "publisher" && role !== "auditor") {
    throw new Error("OIDC admin role is invalid.");
  }

  await setAdminSession({
    user,
    role,
    provider: "oidc"
  });

  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(VERIFIER_COOKIE);
  cookieStore.delete(NONCE_COOKIE);
}
