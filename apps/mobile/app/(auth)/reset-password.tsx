import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '@cymetric/sdk';
import { ErrorCodes } from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { api } from '@/lib/api';
import { colors } from '@/theme/colors';

// Password reset — Step 2 of 2.
//
// Takes the 6-digit OTP from password-reset/request + a new password and
// finalises the reset via /password-reset/confirm. Mirrors verify-otp.tsx
// for the 6-digit input + dev-mode OTP autofill banner.
//
// On success: route to login. The API has already revoked every refresh
// token for the org so any other devices the user was signed in on get
// kicked out — they have to log in again with the new password.
export default function ResetPassword() {
  const params = useLocalSearchParams<{ email: string; devOtp?: string }>();
  const email = params.email ?? '';
  const devOtp = __DEV__ ? params.devOtp : undefined;

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.auth.passwordResetConfirm({ email, code, newPassword });
      Alert.alert(
        'Password updated',
        'Your password has been reset. Sign in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCodes.AUTH_INVALID_OTP) setError('That code is incorrect.');
        else if (err.code === ErrorCodes.AUTH_OTP_EXPIRED) {
          setError('Code expired — request a new one.');
        } else if (err.code === ErrorCodes.AUTH_OTP_MAX_ATTEMPTS) {
          setError('Too many attempts — request a new code.');
        } else if (err.code === ErrorCodes.AUTH_PASSWORD_PWNED) {
          setError('That password appears in known breaches. Pick a stronger one.');
        } else {
          setError(err.title || 'Could not reset password');
        }
      } else {
        setError('Could not reset password');
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
            <Text className="text-text-primary text-2xl font-bold">Reset password</Text>
            <Text className="text-text-secondary mt-1">
              Enter the 6-digit code we sent to {email} and pick a new password.
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
                <Text
                  style={{
                    color: colors.score.amber,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1,
                  }}
                >
                  DEV MODE
                </Text>
                <Text style={{ color: colors.text.primary, fontSize: 13, marginTop: 4 }}>
                  OTP:{' '}
                  <Text style={{ fontWeight: '800', letterSpacing: 4 }}>{devOtp}</Text>
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

            <Input
              label="New password"
              icon="key-outline"
              placeholder="Min 12 characters"
              secure
              value={newPassword}
              onChangeText={setNewPassword}
            />

            {error && (
              <Text className="text-score-red text-sm mt-3 mb-1">{error}</Text>
            )}

            <View className="h-4" />
            <Button label="Reset password" onPress={submit} loading={submitting} />

            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              className="mt-4 self-center"
              hitSlop={8}
            >
              <Text className="text-text-secondary">Back to login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
