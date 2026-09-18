import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';

// Server-side Sentry. Guarded by SENTRY_DSN so local dev and self-hosted
// deployments don't fail on missing creds; if it's unset we skip init and
// the SDK's scope calls become no-ops.
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Scrub auth headers and any obviously secret bodies before the event
    // leaves the process. The logger already redacts at the pino layer, but
    // errors thrown from the router don't necessarily go through pino.
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}
