import { Redirect } from 'expo-router';

// Cold-start landing for unauthenticated users — send them through the
// 3-slide onboarding carousel (Security Scans / Live Scorecard / AI
// Insights) which tail-calls into login. _layout's AuthGate intercepts
// before paint when there's a live session, so authenticated users skip
// this redirect entirely and land on the dashboard.
export default function Index() {
  return <Redirect href="/(auth)/onboarding" />;
}