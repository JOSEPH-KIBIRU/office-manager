import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { HttpError } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { deleteUploadThingFiles } from "@/lib/uploadthingServer";
import { scanStoredFile } from "@/lib/scanStoredFile";
import { ensureUploadFileRegistered } from "@/lib/ensureUploadFile";
export const maxDuration = 60;

/**
 * Organization branding.
 * GET  /api/organization - authenticated members can read branding
 * PATCH /api/organization - admin/secretary can update branding
 */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("organization", ["admin", "secretary", "manager", "employee"]);
    try {
      const org = await cx().query(api.organizations.getOrganization, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok(org);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("organization-settings", ["admin", "secretary"]);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const input: Record<string, unknown> = { secret: secret(), orgId: session.orgId as never };
    const allowed = [
      "name", "address", "city", "phone", "email", "taxNumber", "website",
      "paymentDetails", "invoiceNotes", "invoiceTerms",
      "workingDays", "workStartTime", "workEndTime", "graceMinutes",
      "etimsEnabled", "etimsEnv", "etimsBaseUrl", "etimsTin", "etimsBhfId",
      "etimsDeviceSerial", "etimsApiKey", "etimsApiSecret",
      "remindersEnabled", "reminderIntervalDays", "reminderMax",
      "leaveEntitlement", "leaveCarryOverMax", "leaveEncashment",
    ] as const;
    for (const k of allowed) {
      if (body[k] !== undefined) input[k] = body[k];
    }
    if (body.logoFileId !== undefined) input.logoFileId = body.logoFileId;
    if (body.logoUrl !== undefined) input.logoUrl = body.logoUrl === null ? null : String(body.logoUrl);
    if (body.logoKey !== undefined) input.logoKey = body.logoKey === null ? null : String(body.logoKey);
    if (typeof input.logoUrl === "string" && input.logoUrl && !input.logoKey) {
      throw new HttpError(400, "logoKey is required when setting a logo URL");
    }

    // Validate the eTIMS endpoint at save time too (the request-time guard also
    // blocks private/reserved addresses and redirects).
    if (typeof input.etimsBaseUrl === "string" && input.etimsBaseUrl.trim()) {
      let u: URL;
      try {
        u = new URL(String(input.etimsBaseUrl).trim());
      } catch {
        throw new HttpError(400, "eTIMS base URL is invalid");
      }
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        throw new HttpError(400, "eTIMS base URL must use http or https");
      }
      if (u.username || u.password) {
        throw new HttpError(400, "eTIMS base URL must not contain credentials");
      }
      input.etimsBaseUrl = u.toString().replace(/\/$/, "");
    }

    if (!("name" in input) && !("logoFileId" in input) && !("logoUrl" in input) && !("logoKey" in input) && !allowed.some((k) => input[k] !== undefined)) {
      return fail(400, "No fields to update");
    }

    if (typeof input.logoKey === "string" && input.logoKey) {
      const ensured = await ensureUploadFileRegistered({
        key: input.logoKey,
        orgId: session.orgId as string,
        kind: "logo",
        name: typeof body.logoName === "string" ? body.logoName : undefined,
      });
      if (!ensured) {
        throw new HttpError(404, "Uploaded logo was not found. Please try the upload again.");
      }
      const scan = await scanStoredFile(input.logoKey, session.orgId as string);
      if (!scan.clean) {
        throw new HttpError(scan.error ? 503 : 422, scan.reason || "Logo rejected by the scanner");
      }
    }

    try {
      const before = await cx().query(api.organizations.getOrganization, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      await cx().mutation(api.organizations.updateOrganization, input as never);
      // Replacing/removing a logo leaves the old UploadThing file orphaned.
      const clearsLogo = body.logoUrl !== undefined || body.logoFileId !== undefined;
      if (clearsLogo && before.logoKey && before.logoKey !== input.logoKey) {
        await deleteUploadThingFiles(before.logoKey);
      }
    } catch (e) {
      return mapConvexError(e);
    }
    const org = await cx().query(api.organizations.getOrganization, {
      secret: secret(),
      orgId: session.orgId as never,
    });
    return ok(org);
  });
}