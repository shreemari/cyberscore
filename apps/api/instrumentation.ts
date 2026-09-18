// Next.js 15 calls this once per runtime (nodejs, edge) on boot.
// We only wire Sentry on the server — edge isn't in the deployment plan.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}
