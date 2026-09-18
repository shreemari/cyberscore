import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { colors } from '@/theme/colors';

// 6-digit OTP entry with split inputs and a visible attempt counter.
// The backend returns `attemptsRemaining` on failure; we surface it verbatim
// so the user knows when they're about to be locked out for 10 min.
export default function VerifyOtp() {
  const params = useLocalSearchParams<{ email: string; devOtp?: string }>();
  const email = params.email ?? '';
  const devOtp = __DEV__ ? params.devOtp : undefined;
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const setDigit = (idx: number, val: string) => {
    const next = [...digits];
    next[idx] = val.slice(-1).replace(/\D/g, '');
    setDigits(next);
    if (next[idx] && idx < 5) inputs.current[idx + 1]?.focus();
    if (!next[idx] && idx > 0) inputs.current[idx - 1]?.focus();
  };

  const submit = async () => {
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter all 6 digits');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.auth.verifyOtp({ email, code });
      router.replace('/(auth)/login');
    } catch (err: any) {
      setError(err?.message ?? 'Invalid code');
      if (typeof err?.data?.attemptsRemaining === 'number') {
        setAttemptsLeft(err.data.attemptsRemaining);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen glow>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
        <View className="bg-bg-card rounded-3xl border border-border-subtle p-6">
          <Text className="text-text-primary text-2xl font-bold">Verify your email</Text>
          <Text className="text-text-secondary mt-1">
            We sent a 6-digit code to {email}. It expires in 10 minutes.
          </Text>

          {devOtp && (
            <Pressable
              onPress={() => setDigits(devOtp.split(''))}
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 12,
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(245, 158, 11, 0.3)',
              }}
            >
              <Text style={{ color: colors.score.amber, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                DEV MODE
              </Text>
              <Text style={{ color: colors.text.primary, fontSize: 13, marginTop: 4 }}>
                OTP: <Text style={{ fontWeight: '800', letterSpacing: 4 }}>{devOtp}</Text>
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>
                Tap to autofill
              </Text>
            </Pressable>
          )}

          <View className="flex-row justify-between mt-6 mb-4">
            {digits.map((d, idx) => (
              <TextInput
                key={idx}
                ref={(r) => {
                  inputs.current[idx] = r;
                }}
                value={d}
                onChangeText={(v) => setDigit(idx, v)}
                keyboardType="number-pad"
                maxLength={1}
                style={{
                  width: 44,
                  height: 56,
                  backgroundColor: colors.bg.elevated,
                  borderWidth: 1,
                  borderColor: d ? colors.brand[500] : colors.border.subtle,
                  borderRadius: 12,
                  textAlign: 'center',
                  fontSize: 22,
                  fontWeight: '700',
                  color: colors.text.primary,
                }}
              />
            ))}
          </View>

          {error && <Text className="text-score-red text-sm mb-2">{error}</Text>}
          {attemptsLeft != null && (
            <Text className="text-text-muted text-xs mb-2">
              Attempts remaining: {attemptsLeft}
            </Text>
          )}

          <Button label="Verify" onPress={submit} loading={submitting} />

          <Pressable onPress={() => router.back()} className="mt-4 self-center" hitSlop={8}>
            <Text className="text-text-secondary">Back</Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
