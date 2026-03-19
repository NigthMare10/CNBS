import type { FastifyReply, FastifyRequest } from "fastify";
import { verifySignedToken } from "@cnbs/domain";
import { env } from "@cnbs/config";

export type AdminRole = "admin" | "uploader" | "validator" | "publisher" | "auditor";

const rolePermissions: Record<AdminRole, string[]> = {
  admin: ["upload", "publish", "rollback", "audit", "view"],
  uploader: ["upload", "view"],
  validator: ["view"],
  publisher: ["publish", "rollback", "view"],
  auditor: ["audit", "view"]
};

export interface AuthenticatedAdminContext {
  user: string;
  role: AdminRole;
}

interface AdminRequestTokenPayload {
  user: string;
  role: AdminRole;
  iat: number;
  exp: number;
}

declare module "fastify" {
  interface FastifyRequest {
    adminContext?: AuthenticatedAdminContext;
  }
}

function normalizeRole(value: unknown): AdminRole | null {
  return typeof value === "string" && value in rolePermissions ? (value as AdminRole) : null;
}

function tokenSecret(): string {
  return `${env.CNBS_ADMIN_API_SECRET}:service`;
}

function tokenFromRequest(request: FastifyRequest): AuthenticatedAdminContext | null {
  const token = request.headers["x-cnbs-admin-auth"];
  if (typeof token === "string") {
    const parsed = verifySignedToken<AdminRequestTokenPayload>(token, tokenSecret());
    const role = parsed ? normalizeRole(parsed.role) : null;
    const now = Math.floor(Date.now() / 1000);
    if (parsed && role && typeof parsed.user === "string" && parsed.user && parsed.exp > now) {
      return { user: parsed.user, role };
    }
  }

  if (process.env.NODE_ENV === "test") {
    const user = request.headers["x-cnbs-admin-user"];
    const role = normalizeRole(request.headers["x-cnbs-admin-role"]);
    if (typeof user === "string" && role) {
      return { user, role };
    }
  }

  return null;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: string = "view"
): Promise<void> {
  const secret = request.headers["x-cnbs-admin-secret"];
  const adminContext = tokenFromRequest(request);

  if (secret !== env.CNBS_ADMIN_API_SECRET) {
    await reply.code(401).send({
      error: {
        message: "Unauthorized admin access.",
        requestId: request.id
      }
    });
    return;
  }

  if (!adminContext) {
    await reply.code(401).send({
      error: {
        message: "Admin identity token is missing or invalid.",
        requestId: request.id
      }
    });
    return;
  }

  const role = adminContext.role;
  if (!(role in rolePermissions) || !rolePermissions[role].includes(permission)) {
    await reply.code(403).send({
      error: {
        message: "Forbidden for current role.",
        requestId: request.id
      }
    });
    return;
  }

  request.adminContext = adminContext;
}
