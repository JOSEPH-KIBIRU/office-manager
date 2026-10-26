/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

// Vite transforms import.meta.glob; convex-test loads Convex functions lazily.
const modules = import.meta.glob("../../convex/**/*.*s");

/** Fresh in-memory Convex backend for a test, wired to the real schema. */
export function makeTestBackend() {
  return convexTest(schema, modules);
}
