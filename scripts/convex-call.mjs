import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { readFileSync, existsSync } from "node:fs";

const projectDir = "C:\\Users\\HP\\Office Manager";
function loadEnv(file) {
  const p = `${projectDir}\\${file}`;
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const secret = process.env.CONVEX_SERVER_SECRET;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_SERVER_SECRET");
  process.exit(1);
}

const [,, fnPath, orgName = "Office"] = process.argv;
const [file, fn] = fnPath.split(":");
const client = new ConvexHttpClient(url);
const result = await client.mutation(anyApi[file][fn], { secret, orgName });
console.log(JSON.stringify(result, null, 2));
