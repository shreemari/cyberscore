import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OrgMode, Role } from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { PressableGlow } from '@/components/PressableGlow';
import { api, API_BASE_URL } from '@/lib/api';
import { secureTokenStorage } from '@/lib/storage';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/stores/auth';
import { FRAMEWORKS, frameworkLabel, type FrameworkCode } from '@/lib/frameworks';

export default function Profile() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.me);
  const setMe = useAuthStore((s) => s.setMe);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const logout = async () => {
    Alert.alert('Sign out', 'You will need to log back in next time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await api.auth.logout();
          } catch {
            // best-effort — we still clear state locally
          }
          qc.clear();
          setUnauthenticated();
          router.replace('/(auth)/login');
          setLoggingOut(false);
        },
      },
    ]);
  };

  const updateFramework = async (code: FrameworkCode) => {
    if (!me || code === me.org.selectedFramework) {
      setPickerOpen(false);
      return;
    }
    setSaving(true);
    try {
      const tokens = await secureTokenStorage.getTokens();
      const res = await fetch(`${API_BASE_URL}/api/v1/me/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        },
        body: JSON.stringify({ selectedFramework: code }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { org: typeof me.org };
      setMe({ ...me, org: { ...me.org, ...data.org } });
      await qc.invalidateQueries({ queryKey: ['kpis'] });
      await qc.invalidateQueries({ queryKey: ['scorecard'] });
      setPickerOpen(false);
    } catch (err: any) {
      Alert.alert('Could not switch framework', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const user = me?.user;
  const org = me?.org;
  // Enterprise employees can't change the framework — admin owns that.
  const canChangeFramework =
    !org || org.mode === OrgMode.SOLO || user?.role === Role.ADMIN;

  return (
    <Screen glow>
      <TopBar title="PROFILE" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator
        alwaysBounceVertical
      >
        <View className="items-center mt-2 mb-6">
          <View className="w-20 h-20 rounded-full bg-brand-500/20 border-2 border-brand-500/40 items-center justify-center">
            <Text className="text-brand-400 font-bold text-2xl">
              {user ? initials(user.name) : '—'}
            </Text>
          </View>
          <Text className="text-text-primary text-xl font-bold mt-3">
            {user?.name ?? 'Guest'}
          </Text>
          <Text className="text-text-secondary text-sm mt-0.5">{user?.email ?? ''}</Text>
          <View className="flex-row items-center gap-2 mt-2">
            <View className="px-2.5 py-1 rounded-full bg-brand-500/20 border border-brand-500/40">
              <Text className="text-brand-400 text-[10px] font-bold tracking-widest">
                {user?.role ?? ''}
              </Text>
            </View>
            {org?.isVerified && (
              <View className="px-2.5 py-1 rounded-full bg-score-green/20 border border-score-green/40 flex-row items-center">
                <Ionicons name="shield-checkmark" size={10} color={colors.score.green} />
                <Text className="text-score-green text-[10px] font-bold tracking-widest ml-1">
                  VERIFIED
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text className="text-text-muted text-[11px] tracking-widest mb-2">ORGANISATION</Text>
        <Card>
          <DetailRow icon="business" label="Name" value={org?.orgName ?? '—'} />
          <DetailRow icon="briefcase" label="Industry" value={org?.industry ?? '—'} />
          <DetailRow icon="pricetag" label="Plan" value={org?.plan ?? '—'} />
          {canChangeFramework ? (
            <PressableGlow onPress={() => setPickerOpen(true)}>
              <View
                className="flex-row items-center py-3"
                style={{ paddingRight: 2 }}
              >
                <Ionicons name="shield-checkmark" size={16} color={colors.brand[400]} />
                <Text className="text-text-secondary ml-3 flex-1">Framework</Text>
                <Text className="text-text-primary font-semibold mr-1">
                  {frameworkLabel(org?.selectedFramework)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
              </View>
            </PressableGlow>
          ) : (
            <View className="flex-row items-center py-3">
              <Ionicons name="lock-closed" size={16} color={colors.brand[400]} />
              <Text className="text-text-secondary ml-3 flex-1">Framework</Text>
              <Text className="text-text-primary font-semibold mr-1">
                {frameworkLabel(org?.selectedFramework)}
              </Text>
            </View>
          )}
        </Card>

        <Text className="text-text-muted text-[11px] tracking-widest mt-6 mb-2">SECURITY</Text>
        <Card>
          <ToggleRow
            icon="key"
            label="Two-factor (TOTP)"
            description={user?.totpEnabled ? 'Enabled' : 'Not configured'}
            value={user?.totpEnabled ?? false}
            onChange={() => Alert.alert('Coming soon', 'TOTP setup is in the next build.')}
            last
          />
        </Card>

        <Text className="text-text-muted text-[11px] tracking-widest mt-6 mb-2">APP</Text>
        <Card>
          <LinkRow
            icon="document-text"
            label="Privacy policy"
            onPress={() => Alert.alert('Privacy', 'cymetric.app/privacy')}
          />
          <LinkRow
            icon="help-circle"
            label="Help & support"
            onPress={() => Alert.alert('Support', 'support@cymetric.app')}
          />
          <LinkRow
            icon="information-circle"
            label="About"
            onPress={() => Alert.alert('CyMetric', 'Version 1.0.0 · MVP')}
            last
          />
        </Card>

        <View className="mt-8">
          <Button
            label="Sign out"
            icon="log-out"
            variant="secondary"
            onPress={logout}
            loading={loggingOut}
          />
        </View>
      </ScrollView>

      {/* Framework picker — bottom sheet modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !saving && setPickerOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
          onPress={() => !saving && setPickerOpen(false)}
        >
          <Pressable onPress={() => {}}>
            <View
              style={{
                backgroundColor: colors.bg.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.1)',
                padding: 20,
                paddingBottom: 32,
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: colors.brand[400],
                      shadowOffset: { width: 0, height: -4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 24,
                    }
                  : {}),
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignSelf: 'center',
                  marginBottom: 18,
                }}
              />
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: 18,
                  fontWeight: '800',
                  marginBottom: 4,
                }}
              >
                Choose Framework
              </Text>
              <Text
                style={{
                  color: colors.text.secondary,
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                KPI questions and scoring will be filtered to match this framework.
              </Text>

              <View style={{ gap: 10 }}>
                {FRAMEWORKS.map((f) => {
                  const active = org?.selectedFramework === f.code;
                  return (
                    <PressableGlow
                      key={f.code}
                      onPress={() => updateFramework(f.code)}
                      disabled={saving}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 16,
                          borderRadius: 16,
                          backgroundColor: active
                            ? `${colors.brand[500]}22`
                            : 'rgba(255,255,255,0.03)',
                          borderWidth: 1,
                          borderColor: active
                            ? `${colors.brand[500]}66`
                            : 'rgba(255,255,255,0.07)',
                          borderTopColor: active
                            ? colors.brand[400]
                            : 'rgba(255,255,255,0.12)',
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: active
                              ? `${colors.brand[500]}33`
                              : 'rgba(255,255,255,0.05)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          <Ionicons
                            name="shield-checkmark"
                            size={18}
                            color={active ? colors.brand[400] : colors.text.secondary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: colors.text.primary,
                              fontWeight: '700',
                              fontSize: 15,
                            }}
                          >
                            {f.label}
                          </Text>
                          <Text
                            style={{
                              color: colors.text.muted,
                              fontSize: 12,
                              marginTop: 2,
                              lineHeight: 16,
                            }}
                          >
                            {f.description}
                          </Text>
                        </View>
                        {active ? (
                          saving ? (
                            <ActivityIndicator color={colors.brand[400]} />
                          ) : (
                            <Ionicons
                              name="checkmark-circle"
                              size={22}
                              color={colors.brand[400]}
                            />
                          )
                        ) : null}
                      </View>
                    </PressableGlow>
                  );
                })}
              </View>

              <Pressable
                onPress={() => !saving && setPickerOpen(false)}
                style={{ alignSelf: 'center', marginTop: 18, padding: 8 }}
                hitSlop={8}
              >
                <Text style={{ color: colors.text.secondary, fontSize: 13 }}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center py-3 ${last ? '' : 'border-b border-border-subtle'}`}
    >
      <Ionicons name={icon} size={16} color={colors.brand[400]} />
      <Text className="text-text-secondary ml-3 flex-1">{label}</Text>
      <Text className="text-text-primary font-semibold">{value}</Text>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center py-3 ${last ? '' : 'border-b border-border-subtle'}`}
    >
      <Ionicons name={icon} size={16} color={colors.brand[400]} />
      <View className="ml-3 flex-1">
        <Text className="text-text-primary font-semibold">{label}</Text>
        <Text className="text-text-muted text-xs mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.bg.elevated, true: colors.brand[500] }}
        thumbColor="#fff"
      />
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <PressableGlow onPress={onPress}>
      <View
        className={`flex-row items-center py-3 ${last ? '' : 'border-b border-border-subtle'}`}
      >
        <Ionicons name={icon} size={16} color={colors.brand[400]} />
        <Text className="text-text-primary ml-3 flex-1">{label}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
      </View>
    </PressableGlow>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase() || '—';
}
