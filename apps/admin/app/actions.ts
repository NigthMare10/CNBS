"use server";

import { redirect } from "next/navigation";
import { apiConfig, env } from "@cnbs/config";
import { clearAdminSession, createAdminSession, getAdminAuthMode, getAdminSession } from "../lib/auth";
import { buildUploadFormData } from "../lib/upload";

function formDataString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function signInAction(formData: FormData) {
  if (getAdminAuthMode() === "oidc") {
    redirect("/auth/oidc/login");
  }

  const username = formDataString(formData.get("username"));
  const password = formDataString(formData.get("password"));
  const success = await createAdminSession({ username, password });

  if (!success) {
    redirect("/?error=invalid_credentials");
  }

  redirect("/upload");
}

export async function signOutAction() {
  await clearAdminSession();
  redirect("/");
}

export async function uploadWorkbookSetAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/");
  }

  const forward = buildUploadFormData(formData);

  if (Array.from(forward.keys()).length === 0) {
    redirect("/upload?error=no_valid_file_selected");
  }

  const response = await fetch(`${apiConfig.baseUrl}/api/admin/ingestions`, {
    method: "POST",
    headers: {
      "x-cnbs-admin-secret": env.CNBS_ADMIN_API_SECRET,
      "x-cnbs-admin-user": session.user,
      "x-cnbs-admin-role": session.role
    },
    body: forward,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    redirect(`/upload?error=${encodeURIComponent(payload.error?.message ?? "upload_failed")}`);
  }

  const run = (await response.json()) as { ingestionRunId: string };
  redirect(`/reconciliation?runId=${run.ingestionRunId}`);
}

export async function publishRunAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/");
  }

  const runId = formDataString(formData.get("runId"));
  const response = await fetch(`${apiConfig.baseUrl}/api/admin/publications/${runId}/publish`, {
    method: "POST",
    headers: {
      "x-cnbs-admin-secret": env.CNBS_ADMIN_API_SECRET,
      "x-cnbs-admin-user": session.user,
      "x-cnbs-admin-role": session.role
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    redirect(`/publish?error=${encodeURIComponent(payload.error?.message ?? "publish_failed")}`);
  }

  redirect("/history");
}

export async function rollbackVersionAction(formData: FormData) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/");
  }

  const datasetVersionId = formDataString(formData.get("datasetVersionId"));
  const response = await fetch(`${apiConfig.baseUrl}/api/admin/publications/${datasetVersionId}/rollback`, {
    method: "POST",
    headers: {
      "x-cnbs-admin-secret": env.CNBS_ADMIN_API_SECRET,
      "x-cnbs-admin-user": session.user,
      "x-cnbs-admin-role": session.role
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    redirect(`/publications?error=${encodeURIComponent(payload.error?.message ?? "rollback_failed")}`);
  }

  redirect("/history");
}
