// Minimal placeholder — mobile clients never see this.
// Real traffic hits /api/v1/*.
export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>CyMetric API</h1>
      <p>This is an API-only service. See <code>/api/v1/health</code>.</p>
    </main>
  );
}
