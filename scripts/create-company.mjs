#!/usr/bin/env node
// Platform owner tool: registers a new tenant organization with its first
// admin account.
//
// Usage:
//   node scripts/create-company.mjs <company name> <admin email> [admin name] [password] [slug]
//
// Example:
//   node scripts/create-company.mjs "Acme Ltd" boss@acme.co.ke "Jane Doe"
import bcrypt from "bcryptjs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv(file) {
  const p = path.join(projectDir, file);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(".env.local");
loadEnv(".env");

const [,, name, adminEmail, adminName, password, slugArg] = process.argv;
if (!name || !adminEmail) {
  console.error('Usage: node scripts/create-company.mjs <company name> <admin email> [admin name] [password] [slug]');
  process.exit(1);
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "org";
}

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const secret = process.env.CONVEX_SERVER_SECRET;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_SERVER_SECRET in .env/.env.local");
  process.exit(1);
}

const tempPassword = password || `Om${Math.random().toString(36).slice(2, 10)}!1`;

const client = new ConvexHttpClient(url);
try {
  const result = await client.mutation(anyApi.orgs.createOrganization, {
    secret,
    name,
    slug: slugArg || slugify(name),
    adminName: adminName || "Admin",
    adminEmail: adminEmail.toLowerCase().trim(),
    adminPasswordHash: bcrypt.hashSync(tempPassword, 10),
  });
  console.log("Company created.");
  console.log(`  Organization ID : ${result.orgId}`);
  console.log(`  Admin account   : ${adminEmail.toLowerCase().trim()}`);
  console.log(`  Temporary passwd: ${tempPassword}`);
  console.log("The admin must change this password at first login.");
} catch (e) {
  console.error(`Failed: ${e.message}`);
  process.exit(1);
}
