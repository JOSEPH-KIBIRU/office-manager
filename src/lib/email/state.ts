import "server-only";

// Signed OAuth state is provider-agnostic; reuse the calendar implementation.
export { signOAuthState, verifyOAuthState, type OAuthState } from "@/lib/calendar/state";
