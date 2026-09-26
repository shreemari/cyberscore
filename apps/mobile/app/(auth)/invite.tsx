import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@cymetric/sdk';
import { ErrorCodes, type InvitePreview } from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { colors } from '@/theme/colors';

// Accept-invite screen — opened by tapping the link in the invite email,
// which routes to `cymetric://invite?t=<token>` via expo-linking. Falls
// back to a manual paste UI if the token query param is missing.
//
// Flow: preview the invite → user fills name + password → call accept-invite
// → SDK persists tokens → fetch /me → push to dashboard. The whole thing
// lands the employee straight inside the app — no separate login step.
export default function AcceptInvite() {
  const params = useLocalSearchParams<{ t?: string; token?: string }>();
  const initialToken = (params.t ?? params.token ?? '').trim();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const [token, setToken] = useState(initialToken);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialToken.length > 0);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialToken) return;
    let alive = true;
    (async () => {
      try {
        const res = await api.auth.invitePreview(initialToken);
        if (!alive) return;
        setPreview(res);
      } catch (err) {
        if (!alive) return;
        setPreviewError(messageFor(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialToken]);

  const submit = async () => {
    if (!preview) return;
    setSubmitError(null);
    if (name.trim().length < 2) {
      setSubmitError('Enter your name');
      return;
    }
    if (password.length < 12) {
      setSubmitError('Password must be at least 12 characters');
      return;
    }

    setSubmitting(true);
    try {
      await api.auth.acceptInvite({ token, name: name.trim(), password });
      // Tokens already persisted by the SDK. Fetching /me lights up routing.
      const me = await api.auth.me();
      setAuthenticated(me);
      // AuthGate will move us to the right group; replace anyway for safety.
      router.replace('/(app)/dashboard');
    } catch (err) {
      setSubmitError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen glow>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 60,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="always"
      >
        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          hitSlop={10}
          style={{ alignSelf: 'flex-start', marginBottom: 16 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chevron-back" size={18} color={colors.text.secondary} />
            <Text style={{ color: colors.text.secondary, fontSize: 13 }}>Back to login</Text>
          </View>
        </Pressable>

        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              backgroundColor: `${colors.brand[500]}1a`,
              borderWidth: 1.5,
              borderColor: `${colors.brand[500]}40`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: colors.brand[500],
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 24,
                  }
                : { elevation: 6 }),
            }}
          >
            <Ionicons name="mail-open-outline" size={36} color={colors.brand[400]} />
          </View>

          <Text
            style={{
              color: colors.text.primary,
              fontSize: 24,
              fontWeight: '800',
              textAlign: 'center',
            }}
          >
            Accept your invite
          </Text>
          <Text
            style={{
              color: colors.text.secondary,
              marginTop: 6,
              fontSize: 13,
              textAlign: 'center',
              paddingHorizontal: 8,
              lineHeight: 18,
            }}
          >
            Set a password to join your team's CyMetric workspace.
          </Text>
        </View>

        {/* No token at all — manual paste */}
        {!initialToken && !preview ? (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
              padding: 24,
              gap: 14,
            }}
          >
            <Input
              label="Invite token"
              placeholder="Paste the token from your email"
              value={token}
              onChangeText={setToken}
            />
            <Button
              label="Continue"
              onPress={async () => {
                if (!token.trim()) return;
                setLoading(true);
                setPreviewError(null);
                try {
                  const res = await api.auth.invitePreview(token.trim());
                  setPreview(res);
                } catch (err) {
                  setPreviewError(messageFor(err));
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
              iconRight="arrow-forward"
            />
          </View>
        ) : null}

        {/* Loading the preview */}
        {loading && initialToken ? (
          <View style={{ alignItems: 'center', padding: 32 }}>
            <ActivityIndicator color={colors.brand[400]} />
            <Text style={{ color: colors.text.muted, marginTop: 12, fontSize: 13 }}>
              Verifying invite…
            </Text>
          </View>
        ) : null}

        {/* Preview error (token bad/expired/revoked) */}
        {previewError ? (
          <View
            style={{
              backgroundColor: `${colors.score.red}11`,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: `${colors.score.red}55`,
              padding: 18,
              gap: 8,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="warning-outline" size={18} color={colors.score.red} />
              <Text
                style={{ color: colors.score.red, fontWeight: '700', fontSize: 14 }}
              >
                Invite unavailable
              </Text>
            </View>
            <Text style={{ color: colors.text.secondary, fontSize: 13, lineHeight: 18 }}>
              {previewError}
            </Text>
            <Pressable
              onPress={() => router.replace('/(auth)/login')}
              hitSlop={6}
              style={{ marginTop: 6 }}
            >
              <Text style={{ color: colors.brand[400], fontSize: 13, fontWeight: '600' }}>
                Back to login
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Preview good — show join form */}
        {preview ? (
          <>
            <View
              style={{
                backgroundColor: `${colors.brand[500]}14`,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: `${colors.brand[500]}44`,
                padding: 18,
                gap: 6,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: colors.text.muted,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 2,
                }}
              >
                JOINING
              </Text>
              <Text
                style={{ color: colors.text.primary, fontSize: 18, fontWeight: '800' }}
              >
                {preview.org.orgName}
              </Text>
              <Text
                style={{ color: colors.text.secondary, fontSize: 12 }}
              >
                {preview.org.industry} · As {preview.role.toLowerCase()}
              </Text>
              {preview.invitedByName && (
                <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 4 }}>
                  Invited by {preview.invitedByName}
                </Text>
              )}
              <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 4 }}>
                Email: {preview.email}
              </Text>

              {preview.allowedLevels && preview.allowedLevels.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text
                    style={{
                      color: colors.text.muted,
                      fontSize: 10,
                      fontWeight: '700',
                      letterSpacing: 2,
                      marginBottom: 8,
                    }}
                  >
                    YOUR ASSESSMENTS
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {preview.allowedLevels.map((lvl) => (
                      <View
                        key={lvl}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                          backgroundColor: `${colors.brand[500]}22`,
                          borderWidth: 1,
                          borderColor: `${colors.brand[500]}55`,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.brand[400],
                            fontSize: 11,
                            fontWeight: '700',
                            letterSpacing: 0.8,
                          }}
                        >
                          {lvl}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
                padding: 24,
                gap: 14,
              }}
            >
              <Input
                label="Your name"
                icon="person-outline"
                placeholder="Jane Doe"
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
              <Input
                label="Set Password"
                icon="key-outline"
                placeholder="Min 12 characters"
                secure
                value={password}
                onChangeText={setPassword}
              />

              {submitError && (
                <Text style={{ color: colors.score.red, fontSize: 13 }}>{submitError}</Text>
              )}

              <Button
                label="Accept & Sign In"
                onPress={submit}
                loading={submitting}
                iconRight="arrow-forward"
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === ErrorCodes.INVITE_NOT_FOUND) return 'This invite link is invalid.';
    if (err.code === ErrorCodes.INVITE_EXPIRED) return 'This invite has expired. Ask your admin for a new one.';
    if (err.code === ErrorCodes.INVITE_REVOKED) return 'This invite has been revoked.';
    if (err.code === ErrorCodes.INVITE_ALREADY_ACCEPTED)
      return 'This invite has already been used. Try signing in instead.';
    if (err.code === ErrorCodes.AUTH_EMAIL_TAKEN)
      return 'An account already exists for this email. Sign in instead.';
    if (err.code === ErrorCodes.AUTH_PASSWORD_PWNED)
      return 'That password appears in known breaches. Pick a stronger one.';
    return err.title;
  }
  return (err as { message?: string })?.message ?? 'Something went wrong';
}
