// Required by Next.js 15 App Router even for API-only apps.
// No UI is served from this app — all routes live under /api/v1/*.
export const metadata = {
  title: 'CyMetric API',
  description: 'API-only. Use the mobile app.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
