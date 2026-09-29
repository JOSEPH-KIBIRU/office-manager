import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List documents. Employees see their own + company-wide; others see all. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("documents", ["admin", "secretary", "manager", "employee"]);
    try {
      const documents = await cx().query(api.documents.listDocuments, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
      });
      return ok({ documents });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Create a document record. Admin / secretary / manager. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("documents", ["admin", "secretary", "manager"]);
    const body = await readJson<{
      userId?: string;
      title: string;
      category: "contract" | "license" | "insurance" | "certificate" | "other";
      issuedDate?: string;
      expiryDate?: string;
      fileName?: string;
      fileId?: string;
      notes?: string;
    }>(req);
    requireFields(body, ["title", "category"]);

    try {
      const id = await cx().mutation(api.documents.createDocument, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: (body.userId || undefined) as never,
        title: String(body.title),
        category: body.category,
        issuedDate: body.issuedDate,
        expiryDate: body.expiryDate,
        fileName: body.fileName,
        fileId: (body.fileId || undefined) as never,
        notes: body.notes,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
