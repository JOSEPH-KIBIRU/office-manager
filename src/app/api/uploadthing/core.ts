import { createUploadthing, type FileRouter } from "uploadthing/next";
import { requirePermission } from "@/lib/permissionGuard";

const f = createUploadthing();

/**
 * UploadThing file router. Uploads are authenticated with the app session so
 * only signed-in staff can upload. The resulting file URL is stored on the task
 * report (no Convex storage involved).
 */
export const ourFileRouter = {
  taskImage: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } })
    .middleware(async () => {
      // Only staff with the tasks module may upload task images.
      const session = await requirePermission("tasks", ["admin", "secretary", "manager", "employee"]);
      return { orgId: session.orgId as string, userId: session.id as string };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl, name: file.name };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
