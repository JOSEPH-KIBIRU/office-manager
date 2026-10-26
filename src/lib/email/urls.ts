import "server-only";

export { requestOrigin } from "@/lib/calendar/urls";

export function emailRedirectUri(origin: string, provider: string): string {
  return `${origin}/api/crm/integrations/${provider}/callback`;
}
