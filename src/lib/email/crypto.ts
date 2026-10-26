import "server-only";

// Reuse the AES-256-GCM token crypto already used by calendar integrations.
export { encryptToken, decryptToken, encryptionConfigured } from "@/lib/calendar/crypto";
