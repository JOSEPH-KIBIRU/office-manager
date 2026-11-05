import { createUploadthing, type FileRouter } from "uploadthing/next";
import { requirePermission } from "@/lib/permissionGuard";
import { cx, secret, api } from "@/lib/convex";

const f = createUploadthing();

const DOC_EXTS = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"];
const MINUTE_EXTS = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg"];
const LOGO_EXTS = [".png", ".jpg", ".jpeg", ".svg", ".webp"];

const privateAcl = process.env.UPLOADTHING_PRIVATE === "true";
const acl = privateAcl ? ({ acl: "private" } as const) : {};

type UploadKind = "logo" | "minutes" | "task" | "other";
interface UploadMeta {
  orgId: string;
  userId: string;
  kind: UploadKind;
}
interface UploadedFile {
  key: string;
  ufsUrl: string;
  name: string;
  size: number;
  type: string;
}

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
 * Register every uploaded key so the authenticated file proxy can prove
 * org ownership. The public CDN URL is stored server-side only and is never
 * returned to the browser.
 */
async function register(metadata: UploadMeta, file: UploadedFile) {
  try {
    await cx().mutation(api.storage.registerFile, {
      secret: secret(),
      orgId: metadata.orgId as never,
      url: file.ufsUrl,
      key: file.key,
      name: file.name,
      size: file.size,
      type: file.type,
      kind: metadata.kind,
    });
  } catch {
    /* registry is best-effort; the record itself still stores the key */
  }
}

async function done(metadata: UploadMeta, file: UploadedFile) {
  await register(metadata, file);
  return { key: file.key, name: file.name, size: file.size, type: file.type };
}

/**
 * UploadThing file router. Files are uploaded directly from the browser to
 * UploadThing storage. Convex only receives the file key/name/size, and every
 * read goes through the authenticated /api/files/u/<key> proxy.
 *
 * Set UPLOADTHING_PRIVATE=true after upgrading to a paid UploadThing app to
 * switch uploads to private ACL + short-lived signed URLs.
 */
export const ourFileRouter = {
  taskImage: f({ image: { maxFileSize: "8MB", maxFileCount: 10, ...acl } })
    .middleware(async () => {
      const session = await requirePermission("tasks", ["admin", "secretary", "manager", "employee"]);
      return { orgId: session.orgId as string, userId: session.id as string, kind: "task" } satisfies UploadMeta;
    })
    .onUploadComplete(async ({ metadata, file }) => done(metadata, file)),

  document: f({ blob: { maxFileSize: "16MB", maxFileCount: 1, ...acl } })
    .middleware(async ({ files }) => {
      assertExtension(files, DOC_EXTS, "Document");
      const session = await requirePermission("documents", ["admin", "secretary", "manager"]);
      return { orgId: session.orgId as string, userId: session.id as string, kind: "other" } satisfies UploadMeta;
    })
    .onUploadComplete(async ({ metadata, file }) => done(metadata, file)),

  minutesFile: f({ blob: { maxFileSize: "16MB", maxFileCount: 1, ...acl } })
    .middleware(async ({ files }) => {
      assertExtension(files, MINUTE_EXTS, "Attachment");
      const session = await requirePermission("minutes", ["admin", "secretary"]);
      return { orgId: session.orgId as string, userId: session.id as string, kind: "minutes" } satisfies UploadMeta;
    })
    .onUploadComplete(async ({ metadata, file }) => done(metadata, file)),

  logo: f({ blob: { maxFileSize: "8MB", maxFileCount: 1, ...acl } })
    .middleware(async ({ files }) => {
      assertExtension(files, LOGO_EXTS, "Logo");
      if (files.some((file) => file.size > 5 * 1024 * 1024)) {
        throw new Error("Logo exceeds the 5MB limit");
      }
      const session = await requirePermission("organization", ["admin", "secretary"]);
      return { orgId: session.orgId as string, userId: session.id as string, kind: "logo" } satisfies UploadMeta;
    })
    .onUploadComplete(async ({ metadata, file }) => done(metadata, file)),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
