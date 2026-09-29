import bcrypt from "bcryptjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { HttpError } from "./auth";

let client: ConvexHttpClient | null = null;

export function cx(): ConvexHttpClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    client = new ConvexHttpClient(url);
  }
  return client;
}

export function secret(): string {
  const s = process.env.CONVEX_SERVER_SECRET;
  if (!s) throw new Error("CONVEX_SERVER_SECRET is not configured");
  return s;
}

export { api };

export function mapConvexError(e: unknown): never {
  let msg = "";
  if (e && typeof e === "object" && "data" in (e as Record<string, unknown>)) {
    msg = String((e as Record<string, unknown>).data);
  } else if (e instanceof Error) {
    msg = e.message;
  } else {
    msg = String(e);
  }
  msg = msg.replace(/^Uncaught Error: /, "").replace(/^Error: /, "");
  let status = 400;
  if (/not found/i.test(msg)) status = 404;
  else if (/already exists|in use by another account|already have a pending/i.test(msg)) status = 409;
  throw new HttpError(status, msg);
}

export async function ensureAppInit(): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  const adminPassword = process.env.ADMIN_PASSWORD || (isProd ? "" : "ChangeMe123!");
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD environment variable is required in production");
  }
  await cx().mutation(api.seed.ensureAppInit, {
    secret: secret(),
    orgName: process.env.ORG_NAME || "Office",
    adminName: process.env.ADMIN_NAME || "Director",
    adminEmail: process.env.ADMIN_EMAIL || "director@office.local",
    adminPasswordHash: bcrypt.hashSync(adminPassword, 10),
    adminPhone: process.env.ADMIN_PHONE || undefined,
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
    superAdminName: process.env.SUPER_ADMIN_NAME,
    superAdminPasswordHash: superAdminPassword
      ? bcrypt.hashSync(superAdminPassword, 10)
      : undefined,
  });
}
