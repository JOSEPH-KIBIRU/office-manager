import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

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
    const session = await requirePermission("organization", ["admin", "secretary"]);
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
    if (!("name" in input) && !("logoFileId" in input) && !allowed.some((k) => input[k] !== undefined)) {
      return fail(400, "No fields to update");
    }

    try {
      await cx().mutation(api.organizations.updateOrganization, input as never);
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