import { beginOidcLogin } from "../../../../lib/oidc";

export async function GET() {
  await beginOidcLogin();
}
