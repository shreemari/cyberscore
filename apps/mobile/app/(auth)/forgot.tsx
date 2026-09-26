import { useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { api } from '@/lib/api';

// Password reset — Step 1 of 2.
//
// Calls /password-reset/request which always returns 200 (account-enumeration
// guard). On success we route the user to the reset-password screen carrying
// their email — and in dev mode also the `devOtp` the server echoed back,
// since SMTP isn't wired up locally.
export default function Forgot() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setSubmitting(true);
    try {
      const res = await api.auth.passwordResetRequest({ email: cleanEmail });
      router.replace({
        pathname: '/(auth)/reset-password',
        params: {
          email: cleanEmail,
          ...(res.devOtp ? { devOtp: res.devOtp } : {}),
        },
      });
    } catch {
      Alert.alert('Request failed', 'Please try again in a moment.');
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
            <Text className="text-text-secondary mt-1 mb-6">
              Enter your email and we'll send a 6-digit code.
            </Text>
            <Input
              label="Email"
              icon="mail-outline"
              placeholder="you@company.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <View className="h-4" />
            <Button label="Send reset code" onPress={submit} loading={submitting} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
