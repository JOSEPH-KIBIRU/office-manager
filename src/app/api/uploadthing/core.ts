import { createUploadthing, type FileRouter } from "uploadthing/next";
import { requirePermission } from "@/lib/permissionGuard";
import { cx, secret, api } from "@/lib/convex";

const f = createUploadthing();

const DOC_EXTS = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"];
const MINUTE_EXTS = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg"];
const LOGO_EXTS = [".png", ".jpg", ".jpeg", ".svg", ".webp"];

function assertExtension(files: readonly { name: string }[], allowed: string[], label: string) {
  for (const file of files) {
    const dot = file.name.lastIndexOf(".");
    const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
    if (!allowed.includes(ext)) {
      throw new Error(`${label} type not allowed. Allowed: ${allowed.join(", ")}`);
    }
  }
}

/**
 * UploadThing file router. Files are uploaded directly from the browser to
 * UploadThing storage; only the resulting URL/key is saved in Convex. Sessions
 * are validated in each middleware so only authorised staff can upload.
 */
export const ourFileRouter = {
  taskImage: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } })
    .middleware(async () => {
      const session = await requirePermission("tasks", ["admin", "secretary", "manager", "employee"]);
      return { orgId: session.orgId as string, userId: session.id as string };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        await cx().mutation(api.storage.registerFile, {
          secret: secret(),
          orgId: metadata.orgId as never,
          url: file.ufsUrl,
          key: file.key,
          name: file.name,
          size: file.size,
          type: file.type,
          kind: "task",
        });
      } catch {
        /* metadata registry is best-effort */
      }
      return { url: file.ufsUrl, key: file.key, name: file.name, size: file.size, type: file.type };
    }),

  document: f({ blob: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async ({ files }) => {
      assertExtension(files, DOC_EXTS, "Document");
      const session = await requirePermission("documents", ["admin", "secretary", "manager"]);
      return { orgId: session.orgId as string, userId: session.id as string };
    })
    .onUploadComplete(async ({ file }) => ({
      url: file.ufsUrl,
      key: file.key,
      name: file.name,
      size: file.size,
      type: file.type,
    })),

  minutesFile: f({ blob: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async ({ files }) => {
      assertExtension(files, MINUTE_EXTS, "Attachment");
      const session = await requirePermission("minutes", ["admin", "secretary"]);
      return { orgId: session.orgId as string, userId: session.id as string };
    })
    .onUploadComplete(async ({ file }) => ({
      url: file.ufsUrl,
      key: file.key,
      name: file.name,
      size: file.size,
      type: file.type,
    })),

  logo: f({ blob: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ files }) => {
      assertExtension(files, LOGO_EXTS, "Logo");
      if (files.some((file) => file.size > 5 * 1024 * 1024)) {
        throw new Error("Logo exceeds the 5MB limit");
      }
      const session = await requirePermission("organization", ["admin", "secretary"]);
      return { orgId: session.orgId as string, userId: session.id as string };
    })
    .onUploadComplete(async ({ file }) => ({
      url: file.ufsUrl,
      key: file.key,
      name: file.name,
      size: file.size,
      type: file.type,
    })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
