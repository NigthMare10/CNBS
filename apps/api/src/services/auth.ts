import type { FastifyReply, FastifyRequest } from "fastify";
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

declare module "fastify" {
  interface FastifyRequest {
    adminContext?: AuthenticatedAdminContext;
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: string = "view"
): Promise<void> {
  const secret = request.headers["x-cnbs-admin-secret"];
  const user = String(request.headers["x-cnbs-admin-user"] ?? env.CNBS_ADMIN_USER);
  const role = String(request.headers["x-cnbs-admin-role"] ?? env.CNBS_ADMIN_ROLE) as AdminRole;

  if (secret !== env.CNBS_ADMIN_API_SECRET) {
    await reply.code(401).send({
      error: {
        message: "Unauthorized admin access.",
        requestId: request.id
      }
    });
    return;
  }

  if (!(role in rolePermissions) || !rolePermissions[role].includes(permission)) {
    await reply.code(403).send({
      error: {
        message: "Forbidden for current role.",
        requestId: request.id
      }
    });
    return;
  }

  request.adminContext = { user, role };
}
