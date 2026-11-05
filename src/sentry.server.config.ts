import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry. Automatically disabled when no DSN is configured, so the
 * app keeps running normally even before error monitoring is set up.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;
      delete event.request.query_string;
      if (event.request.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
    }
    delete event.user;
    delete event.extra;
    return event;
  },
});
