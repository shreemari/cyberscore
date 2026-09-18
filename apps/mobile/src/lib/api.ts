import Constants from 'expo-constants';
import { createCyMetricClient } from '@cymetric/sdk';
import { secureTokenStorage } from './storage';
import { useAuthStore } from '@/stores/auth';

// Resolve the backend base URL:
//   - production: EXPO_PUBLIC_API_URL (EAS secret)
//   - dev on simulator: apiBaseUrl from app.json extra (defaults to localhost:3000)
//   - dev on physical device: user sets EXPO_PUBLIC_API_URL to their LAN IP
//     (e.g. http://192.168.1.20:3000) — localhost won't resolve on-device.
const baseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  'http://localhost:3000';

export const api = createCyMetricClient({
  baseUrl,
  storage: secureTokenStorage,
  userAgent: `CyMetric-Mobile/${Constants.expoConfig?.version ?? '0.0.0'}`,
  onAuthFailure: () => {
    // SDK clears tokens; we just flip the store so the router redirects.
    useAuthStore.getState().setUnauthenticated();
  },
});

export const API_BASE_URL = baseUrl;
