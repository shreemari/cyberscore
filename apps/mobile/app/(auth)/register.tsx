import { useMemo, useState } from 'react';
import { View, Text, Pressable, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@cymetric/sdk';
import {
  ErrorCodes,
  RegisterMode,
  emailDomainOf,
  isFreeEmailDomain,
  type RegisterMode as RegisterModeType,
} from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { api } from '@/lib/api';
import { colors } from '@/theme/colors';

const INDUSTRIES = [
  'Banking',
  'Healthcare',
  'Technology',
  'Manufacturing',
  'Retail',
  'Education',
  'Government',
  'Other',
];

type ModeTabKey = 'SOLO' | 'CREATE_COMPANY' | 'JOIN_COMPANY';

const MODE_TABS: Array<{
  key: ModeTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  blurb: string;
  registerMode: RegisterModeType;
}> = [
  {
    key: 'SOLO',
    label: 'Solo',
    icon: 'person-outline',
    blurb: 'For individual users or small teams (4–5 people). One scorecard, one framework, full control.',
    registerMode: RegisterMode.SOLO,
  },
  {
    key: 'CREATE_COMPANY',
    label: 'Create Company',
    icon: 'business-outline',
    blurb: 'You\'re the admin. Invite employees, lock the framework, see the company-wide rollup.',
    registerMode: RegisterMode.ENTERPRISE_ADMIN,
  },
  {
    key: 'JOIN_COMPANY',
    label: 'Join Company',
    icon: 'people-outline',
    blurb: 'Your admin already set up the workspace. Sign up with your work email to join.',
    registerMode: RegisterMode.ENTERPRISE_EMPLOYEE,
  },
];

// Register — supports three flows on a single screen, switched via mode tabs.
// SOLO: existing single-user org (default).
// CREATE_COMPANY: ENTERPRISE_ADMIN — registers a multi-user org keyed by
//   the admin's email domain. Free providers (gmail etc.) are rejected.
// JOIN_COMPANY: ENTERPRISE_EMPLOYEE — auto-joins the org that owns the
//   email's domain. Skips OTP (admin already verified the domain).
export default function Register() {
  const [mode, setMode] = useState<ModeTabKey>('SOLO');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState(INDUSTRIES[0]!);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTab = MODE_TABS.find((t) => t.key === mode)!;
  const requiresOrgFields = mode !== 'JOIN_COMPANY';

  // Live domain validation for ENTERPRISE flows — surfaces the gmail.com
  // problem at the field level instead of after a roundtrip.
  const domainHint = useMemo(() => {
    if (!email.includes('@')) return null;
    const d = emailDomainOf(email.trim().toLowerCase());
    if (!d) return null;
    if (mode !== 'SOLO' && isFreeEmailDomain(d)) {
      return {
        kind: 'error' as const,
        message: `${d} is a personal-email provider. Use your company email or pick Solo mode.`,
      };
    }
    if (mode === 'CREATE_COMPANY') {
      return { kind: 'info' as const, message: `Your company will be reachable at ${d}.` };
    }
    if (mode === 'JOIN_COMPANY') {
      return { kind: 'info' as const, message: `We'll match you to the workspace registered for ${d}.` };
    }
    return null;
  }, [email, mode]);

  const submit = async () => {
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const name = [firstName, middleName, surname].filter(Boolean).join(' ').trim();

    if (!cleanEmail || !password || !name) {
      setError('Please fill all required fields');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }
    if (requiresOrgFields && !orgName) {
      setError('Organisation name is required');
      return;
    }
    if (mode !== 'SOLO' && isFreeEmailDomain(emailDomainOf(cleanEmail))) {
      setError('Enterprise mode requires a company email — pick Solo to use a personal account.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.auth.register({
        mode: activeTab.registerMode,
        email: cleanEmail,
        password,
        name,
        orgName: requiresOrgFields ? orgName : undefined,
        industry: requiresOrgFields ? industry : undefined,
      });

      if (res.otpSent) {
        // SOLO + ENTERPRISE_ADMIN both still go through OTP gate.
        // In dev, the API returns the OTP inline so we don't need SMTP wired up.
        router.replace({
          pathname: '/(auth)/verify-otp',
          params: { email: cleanEmail, ...(res.devOtp ? { devOtp: res.devOtp } : {}) },
        });
      } else {
        // ENTERPRISE_EMPLOYEE skipped OTP — go straight to login. Letting the
        // user type their password again here is friction, but keeping login
        // as the single point that issues tokens keeps the auth flow boring.
        router.replace('/(auth)/login');
      }
    } catch (err) {
      setError(messageFor(err));
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
          {/* Hero */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: `${colors.brand[500]}1a`,
                borderWidth: 1.5,
                borderColor: `${colors.brand[500]}40`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
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
              <Ionicons name="shield-checkmark" size={34} color={colors.brand[400]} />
            </View>

            <Text
              style={{
                color: colors.text.primary,
                fontSize: 36,
                fontWeight: '800',
                letterSpacing: 1,
              }}
            >
              CYMETRIC
            </Text>
            <Text style={{ color: colors.text.secondary, marginTop: 6, fontSize: 14 }}>
              Initialize your secure profile
            </Text>
          </View>

          {/* Mode tabs */}
          <ModeTabs value={mode} onChange={setMode} />

          {/* Mode blurb */}
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Ionicons name={activeTab.icon} size={16} color={colors.brand[400]} style={{ marginTop: 2 }} />
            <Text
              style={{
                flex: 1,
                color: colors.text.secondary,
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              {activeTab.blurb}
            </Text>
          </View>

          {/* Glass card form */}
          <View
            style={{
              marginTop: 20,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
              borderTopColor: 'rgba(255,255,255,0.13)',
              padding: 24,
            }}
          >
            <View style={{ gap: 14 }}>
              <Input
                label="Email Address"
                icon="mail-outline"
                placeholder={mode === 'SOLO' ? 'admin@acme.com' : 'you@yourcompany.com'}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              {domainHint && (
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 15,
                    marginTop: -8,
                    color: domainHint.kind === 'error' ? colors.score.red : colors.text.muted,
                  }}
                >
                  {domainHint.message}
                </Text>
              )}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="First Name"
                    icon="person-outline"
                    placeholder="Jane"
                    autoCapitalize="words"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Middle Name"
                    labelRight="opt"
                    placeholder="M."
                    autoCapitalize="words"
                    value={middleName}
                    onChangeText={setMiddleName}
                  />
                </View>
              </View>

              <Input
                label="Surname"
                placeholder="Doe"
                autoCapitalize="words"
                value={surname}
                onChangeText={setSurname}
              />

              <Input
                label="Mobile Number"
                labelRight="opt"
                icon="call-outline"
                placeholder="+1 555 000 0000"
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={setMobile}
              />

              <Input
                label="Password"
                icon="key-outline"
                placeholder="Min 12 characters"
                secure
                value={password}
                onChangeText={setPassword}
              />

              {requiresOrgFields && (
                <>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      marginVertical: 4,
                    }}
                  />

                  <Input
                    label={mode === 'CREATE_COMPANY' ? 'Company Name' : 'Organisation Name'}
                    icon="business-outline"
                    placeholder="Acme Corp"
                    autoCapitalize="words"
                    value={orgName}
                    onChangeText={setOrgName}
                  />

                  <View>
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontWeight: '600',
                        fontSize: 13,
                        marginBottom: 8,
                      }}
                    >
                      Industry
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {INDUSTRIES.map((ind) => {
                        const active = industry === ind;
                        return (
                          <Pressable
                            key={ind}
                            onPress={() => setIndustry(ind)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderRadius: 999,
                              backgroundColor: active
                                ? `${colors.brand[500]}22`
                                : 'rgba(255,255,255,0.04)',
                              borderWidth: 1,
                              borderColor: active
                                ? `${colors.brand[500]}66`
                                : 'rgba(255,255,255,0.08)',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color: active ? colors.brand[400] : colors.text.secondary,
                              }}
                            >
                              {ind}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {mode === 'JOIN_COMPANY' && (
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 16,
                    color: colors.text.muted,
                    marginTop: 4,
                  }}
                >
                  If you got an invite link by email, open it directly — no need to register here.
                </Text>
              )}

              {error && (
                <Text style={{ color: colors.score.red, fontSize: 13 }}>{error}</Text>
              )}

              <Button
                label={mode === 'CREATE_COMPANY' ? 'Create Company' : mode === 'JOIN_COMPANY' ? 'Join Workspace' : 'Create Account'}
                onPress={submit}
                loading={submitting}
                iconRight="arrow-forward"
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
            <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
              Already have an account?{' '}
            </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
              <Text style={{ color: colors.brand[400], fontWeight: '600', fontSize: 13 }}>
                Login
              </Text>
            </Pressable>
          </View>
        </ScrollView>
    </Screen>
  );
}

function ModeTabs({
  value,
  onChange,
}: {
  value: ModeTabKey;
  onChange: (key: ModeTabKey) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 4,
        gap: 4,
      }}
    >
      {MODE_TABS.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor: active ? colors.brand[500] : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={active ? '#fff' : colors.text.secondary}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.8,
                color: active ? '#fff' : colors.text.secondary,
              }}
              numberOfLines={1}
            >
              {tab.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === ErrorCodes.AUTH_EMAIL_TAKEN) return 'That email is already registered.';
    if (err.code === ErrorCodes.ENTERPRISE_DOMAIN_FREE)
      return 'Free email providers (Gmail, Yahoo…) can\'t register a company. Use Solo mode.';
    if (err.code === ErrorCodes.ENTERPRISE_DOMAIN_TAKEN)
      return 'A company is already registered under this email domain. Ask your admin for an invite, or pick "Join Company".';
    if (err.code === ErrorCodes.ENTERPRISE_DOMAIN_NOT_FOUND)
      return 'No company is registered for that email domain yet. Ask your admin to create the workspace, or pick Solo.';
    if (err.code === ErrorCodes.ENTERPRISE_JOIN_DISABLED)
      return 'Your company allows invites only — ask your admin to send you one.';
    if (err.code === ErrorCodes.AUTH_PASSWORD_PWNED)
      return 'That password appears in known breaches. Pick a stronger one.';
    return err.title;
  }
  return (err as { message?: string })?.message ?? 'Registration failed';
}
