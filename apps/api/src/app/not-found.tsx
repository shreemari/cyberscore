// Minimal 404 handler. Required to opt out of Next.js's default Pages-router
// _error fallback, which crashes at build time on React 19 with a "Minified
// React error #31" during static prerendering. The API is JSON-only — nobody
// hits this page in normal use. layout.tsx already wraps html/body.
export default function NotFound() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>404</h1>
      <p>This is an API. See /api/v1/health.</p>
    </main>
  );
}
