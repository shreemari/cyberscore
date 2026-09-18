import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { LoginRequest } from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { BrandLogo } from '@/components/BrandLogo';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

// Login screen — "Secure Access Protocol". LOGIN/REGISTER tabs switch routes.
// Biometric + SSO were removed per product direction: password (+ optional
// TOTP) is the only auth path for now.
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const submit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setSubmitting(true);
    try {
      const body: LoginRequest = { email: email.trim().toLowerCase(), password };
      if (needsTotp && totpCode) body.totpCode = totpCode;
      await api.auth.login(body);
      const me = await api.auth.me();
      setAuthenticated(me);
      router.replace('/(app)/dashboard');
    } catch (err: any) {
      if (err?.code === 'AUTH_TOTP_REQUIRED') {
        setNeedsTotp(true);
        setError('Enter your 6-digit TOTP code');
      } else {
        setError(err?.message ?? 'Login failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen glow>
      <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 80,
            paddingBottom: 40,
          }}
        >
          <View className="items-center mb-8">
            <BrandLogo />
          </View>

          <View
            className="bg-bg-card rounded-3xl border border-border-subtle p-6"
            style={{
              shadowColor: '#22d3ee',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.15,
              shadowRadius: 30,
            }}
          >
            <View className="flex-row border-b border-border-subtle mb-6">
              <View className="flex-1 pb-3 items-center border-b-2 border-brand-500 -mb-[1px]">
                <Text className="text-brand-400 font-semibold tracking-widest text-xs">LOGIN</Text>
              </View>
              <Pressable
                onPress={() => router.replace('/(auth)/register')}
                className="flex-1 pb-3 items-center"
                hitSlop={6}
              >
                <Text className="text-text-secondary font-semibold tracking-widest text-xs">
                  REGISTER
                </Text>
              </Pressable>
            </View>

            <View className="gap-4">
              <Input
                label="Email Address"
                icon="mail-outline"
                placeholder="user@cymetric.net"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Input
                label="Password"
                icon="lock-closed-outline"
                placeholder="••••••••"
                secure
                value={password}
                onChangeText={setPassword}
                rightSlot={
                  <Pressable onPress={() => router.push('/(auth)/forgot')} hitSlop={6}>
                    <Text className="text-brand-400 text-xs">Forgot?</Text>
                  </Pressable>
                }
              />
              {needsTotp && (
                <Input
                  label="Authenticator Code"
                  icon="keypad-outline"
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={totpCode}
                  onChangeText={setTotpCode}
                />
              )}
              {error && <Text className="text-score-red text-sm">{error}</Text>}
              <Button
                label="Authenticate"
                onPress={submit}
                loading={submitting}
                iconRight="arrow-forward"
              />
            </View>
          </View>
        </View>
    </Screen>
  );
}