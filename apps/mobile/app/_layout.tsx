import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import '../src/styles/global.css';

import { queryClient } from '@/lib/queryClient';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Root layout — hydrates the session from SecureStore once, then routes
// between (auth) and (app) groups based on store status. Splash reads tokens,
// calls /me; if that fails we drop to the login screen.
function AuthGate() {
  const status = useAuthStore((s) => s.status);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const segments = useSegments();
  const router = useRouter();

  // One-shot hydration: try /me with whatever we have in secure storage.
  // The SDK will transparently refresh the JWT if it's expired; if that
  // fails it calls onAuthFailure which flips the store to unauthenticated.
  useEffect(() => {
    (async () => {
      try {
        const me = await api.auth.me();
        setAuthenticated(me);
      } catch {
        setUnauthenticated();
      } finally {
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, [setAuthenticated, setUnauthenticated]);

  useEffect(() => {
    if (status === 'unknown') return;
    const group = segments[0];
    const route = segments[1];
    const inAuthGroup = group === '(auth)';
    const inAppGroup = group === '(app)';

    // Accept-invite is reachable both signed-out (deep link from email) and
    // — in the rare case of an already-signed-in user opening the link — by
    // re-using the existing session. Either way, never bounce them away.
    if (inAuthGroup && route === 'invite') return;

    if (status === 'authenticated' && !inAppGroup) {
      router.replace('/(app)/dashboard');
    } else if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/onboarding');
    }
  }, [status, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#05060d' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#05060d' }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AuthGate />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}