import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@cymetric/sdk';
import {
  ErrorCodes,
  Level,
  OrgMode,
  ProgressStatus,
  Role,
  type CreateInviteResponse,
  type TeamMember,
} from '@cymetric/types';

const LEVEL_META: Array<{ key: Level; short: string; label: string }> = [
  { key: Level.PEOPLE, short: 'P', label: 'People' },
  { key: Level.PROCESS, short: 'Pr', label: 'Process' },
  { key: Level.COMPANY, short: 'C', label: 'Company' },
];

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PressableGlow } from '@/components/PressableGlow';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { colors, scoreColorForValue } from '@/theme/colors';

// Admin-only team management. Lists members + pending invites, lets the
// admin invite + revoke. Hidden tab — entered from a "Manage Team" CTA on
// the dashboard. Non-admins or SOLO orgs are bounced back.
export default function Team() {
  const me = useAuthStore((s) => s.me);
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<CreateInviteResponse | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const allowed = me?.org.mode === OrgMode.ENTERPRISE && me.user.role === Role.ADMIN;

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.team.list(),
    enabled: !!allowed,
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => api.team.revokeInvite(inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const revokeMember = useMutation({
    mutationFn: (userId: string) => api.team.revokeMember(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const updateLevels = useMutation({
    mutationFn: ({ userId, allowedLevels }: { userId: string; allowedLevels: Level[] }) =>
      api.team.updateLevels(userId, { allowedLevels }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      setEditingMember(null);
    },
  });

  if (!allowed) {
    return (
      <Screen glow>
        <TopBar title="TEAM" showBack />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="lock-closed" size={28} color={colors.text.muted} />
          <Text
            style={{
              color: colors.text.secondary,
              marginTop: 12,
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            Team management is only available for Enterprise admins.
          </Text>
          <Pressable onPress={() => router.replace('/(app)/dashboard')} style={{ marginTop: 16 }} hitSlop={8}>
            <Text style={{ color: colors.brand[400], fontWeight: '600' }}>Back to dashboard</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen glow>
      <TopBar title="TEAM" showBack />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.brand[400]}
          />
        }
      >
        {/* Header / invite CTA */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text.primary, fontSize: 22, fontWeight: '800' }}>
              Your Team
            </Text>
            <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 4 }}>
              {data?.members.length ?? 0} member{(data?.members.length ?? 0) === 1 ? '' : 's'}
              {data?.pendingInvites.length ? ` · ${data.pendingInvites.length} pending invite${data.pendingInvites.length === 1 ? '' : 's'}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setCreatedInvite(null);
              setInviteOpen(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.brand[500],
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>
              INVITE
            </Text>
          </Pressable>
        </View>

        {isLoading && (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <ActivityIndicator color={colors.brand[400]} />
          </View>
        )}

        {/* Pending invites */}
        {(data?.pendingInvites.length ?? 0) > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text
              style={{
                color: colors.text.muted,
                fontSize: 10,
                letterSpacing: 2,
                fontWeight: '700',
                marginBottom: 8,
              }}
            >
              PENDING INVITES
            </Text>
            <View style={{ gap: 8 }}>
              {data!.pendingInvites.map((inv) => (
                <Card key={inv.id} blur intensity={18}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <Ionicons name="mail-unread-outline" size={16} color={colors.brand[400]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>
                        {inv.email}
                      </Text>
                      <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>
                        {inv.role} · expires {formatDate(inv.expiresAt)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Alert.alert('Revoke invite?', `Cancel the invite to ${inv.email}?`, [
                          { text: 'Keep', style: 'cancel' },
                          {
                            text: 'Revoke',
                            style: 'destructive',
                            onPress: () => revokeInvite.mutate(inv.id),
                          },
                        ]);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={colors.text.muted} />
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}

        {/* Members */}
        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              color: colors.text.muted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            MEMBERS
          </Text>
          {(data?.members.length ?? 0) === 0 ? (
            <Card>
              <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
                Just you so far. Invite teammates to start collecting data.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {data!.members.map((m) => (
                <MemberRow
                  key={m.userId}
                  member={m}
                  isSelf={m.userId === me!.user.id}
                  onRemove={() => {
                    Alert.alert('Remove from team?', `${m.name} will lose access.`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => revokeMember.mutate(m.userId),
                      },
                    ]);
                  }}
                  onEditLevels={
                    m.role === Role.ADMIN ? undefined : () => setEditingMember(m)
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit levels modal */}
      <Modal
        visible={editingMember != null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingMember(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
          onPress={() => setEditingMember(null)}
        >
          <Pressable onPress={() => {}}>
            <View
              style={{
                backgroundColor: colors.bg.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.1)',
                padding: 24,
                paddingBottom: 36,
              }}
            >
              {editingMember && (
                <EditLevelsForm
                  member={editingMember}
                  saving={updateLevels.isPending}
                  onCancel={() => setEditingMember(null)}
                  onSave={(allowedLevels) =>
                    updateLevels.mutate({ userId: editingMember.userId, allowedLevels })
                  }
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Invite modal */}
      <Modal
        visible={inviteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
          onPress={() => setInviteOpen(false)}
        >
          <Pressable onPress={() => {}}>
            <View
              style={{
                backgroundColor: colors.bg.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.1)',
                padding: 24,
                paddingBottom: 36,
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
              {createdInvite ? (
                <InviteCreatedView
                  invite={createdInvite}
                  onClose={() => {
                    setCreatedInvite(null);
                    setInviteOpen(false);
                  }}
                />
              ) : (
                <InviteForm
                  onCreated={(res) => {
                    setCreatedInvite(res);
                    qc.invalidateQueries({ queryKey: ['team'] });
                  }}
                  onCancel={() => setInviteOpen(false)}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function MemberRow({
  member,
  isSelf,
  onRemove,
  onEditLevels,
}: {
  member: TeamMember;
  isSelf: boolean;
  onRemove: () => void;
  onEditLevels?: () => void;
}) {
  const allowedSet = new Set(member.allowedLevels);
  const isAdmin = member.role === Role.ADMIN;
  const score = member.individualScore;
  const scoreColor = score == null ? colors.text.muted : scoreColorForValue(score);
  const status = member.progress.status;
  const statusLabel =
    status === ProgressStatus.COMPLETED
      ? 'COMPLETE'
      : status === ProgressStatus.IN_PROGRESS
        ? 'IN PROGRESS'
        : 'NOT STARTED';

  return (
    <Card blur intensity={18}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: `${colors.brand[500]}22`,
            borderWidth: 1,
            borderColor: `${colors.brand[500]}44`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ color: colors.brand[400], fontWeight: '700' }}>
            {initials(member.name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>
              {member.name}
              {isSelf && <Text style={{ color: colors.text.muted, fontWeight: '500' }}>{'  '}(you)</Text>}
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor:
                  member.role === Role.ADMIN
                    ? `${colors.brand[500]}22`
                    : 'rgba(255,255,255,0.05)',
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  letterSpacing: 1.5,
                  fontWeight: '700',
                  color:
                    member.role === Role.ADMIN ? colors.brand[400] : colors.text.muted,
                }}
              >
                {member.role}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>{member.email}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <Text style={{ color: scoreColor, fontWeight: '800', fontSize: 16 }}>
              {score == null ? '—' : `${Math.round(score)}%`}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: 11 }}>
              {member.progress.answered}/{member.progress.total} answered · {statusLabel}
            </Text>
          </View>

          {/* Allowed-level chips. Admins always have all three (immutable) so
              we render them flatly with no edit affordance. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {LEVEL_META.map((lvl) => {
              const on = isAdmin || allowedSet.has(lvl.key);
              return (
                <View
                  key={lvl.key}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: on ? `${colors.brand[500]}22` : 'rgba(255,255,255,0.04)',
                    borderWidth: 1,
                    borderColor: on ? `${colors.brand[500]}55` : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Text
                    style={{
                      color: on ? colors.brand[400] : colors.text.muted,
                      fontSize: 10,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                    }}
                  >
                    {lvl.short}
                  </Text>
                </View>
              );
            })}
            {onEditLevels && !isSelf && (
              <Pressable onPress={onEditLevels} hitSlop={8} style={{ marginLeft: 4 }}>
                <Text
                  style={{ color: colors.brand[400], fontSize: 11, fontWeight: '700' }}
                >
                  Edit
                </Text>
              </Pressable>
            )}
            {isAdmin && (
              <Text
                style={{ color: colors.text.muted, fontSize: 10, marginLeft: 4 }}
              >
                (admins have all)
              </Text>
            )}
          </View>
        </View>
        {!isSelf && (
          <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: 8 }}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.text.muted} />
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function EditLevelsForm({
  member,
  saving,
  onCancel,
  onSave,
}: {
  member: TeamMember;
  saving: boolean;
  onCancel: () => void;
  onSave: (levels: Level[]) => void;
}) {
  const [selected, setSelected] = useState<Set<Level>>(() => new Set(member.allowedLevels));

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignSelf: 'center',
          marginBottom: 6,
        }}
      />
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '800' }}>
        Levels for {member.name}
      </Text>
      <Text style={{ color: colors.text.secondary, fontSize: 12, lineHeight: 17 }}>
        Pick which assessments {member.name.split(' ')[0]} can answer. Their dashboard
        and assessment list update on next refresh.
      </Text>

      <View style={{ gap: 8 }}>
        {LEVEL_META.map((lvl) => {
          const on = selected.has(lvl.key);
          return (
            <Pressable
              key={lvl.key}
              onPress={() => setSelected((cur) => toggleSet(cur, lvl.key))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 12,
                borderRadius: 12,
                backgroundColor: on ? `${colors.brand[500]}1c` : 'rgba(255,255,255,0.03)',
                borderWidth: 1,
                borderColor: on ? `${colors.brand[500]}66` : 'rgba(255,255,255,0.08)',
              }}
            >
              <Ionicons
                name={on ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={on ? colors.brand[400] : colors.text.muted}
              />
              <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>
                {lvl.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected.size === 0 && (
        <Text style={{ color: colors.score.amber, fontSize: 11 }}>
          Saving zero levels locks them out entirely until you reassign.
        </Text>
      )}

      <Button
        label="Save"
        onPress={() => onSave(Array.from(selected))}
        loading={saving}
        icon="save-outline"
      />
      <Pressable onPress={onCancel} style={{ alignSelf: 'center', padding: 8 }} hitSlop={8}>
        <Text style={{ color: colors.text.secondary, fontSize: 13 }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function InviteForm({
  onCreated,
  onCancel,
}: {
  onCreated: (res: CreateInviteResponse) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState('');
  const [levels, setLevels] = useState<Set<Level>>(
    () => new Set([Level.PEOPLE, Level.PROCESS, Level.COMPANY]),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter an email');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.team.invite({
        email: email.trim().toLowerCase(),
        role: Role.EMPLOYEE,
        allowedLevels: Array.from(levels),
      });
      onCreated(res);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCodes.CONFLICT)
          setError('That email is already on your team.');
        else setError(err.title);
      } else setError('Could not send invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignSelf: 'center',
          marginBottom: 6,
        }}
      />
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '800' }}>
        Invite a teammate
      </Text>
      <Text style={{ color: colors.text.secondary, fontSize: 12, lineHeight: 17 }}>
        We'll email them a link to set up their password and join your CyMetric workspace.
      </Text>
      <Input
        label="Email"
        icon="mail-outline"
        placeholder="teammate@yourcompany.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <View style={{ marginTop: 4 }}>
        <Text
          style={{
            color: colors.text.primary,
            fontWeight: '600',
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          Assessments they'll have access to
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {LEVEL_META.map((lvl) => {
            const on = levels.has(lvl.key);
            return (
              <Pressable
                key={lvl.key}
                onPress={() => setLevels((cur) => toggleSet(cur, lvl.key))}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: on ? `${colors.brand[500]}1c` : 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: on ? `${colors.brand[500]}66` : 'rgba(255,255,255,0.08)',
                }}
              >
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={14}
                  color={on ? colors.brand[400] : colors.text.muted}
                />
                <Text
                  style={{
                    color: on ? colors.brand[400] : colors.text.muted,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1,
                  }}
                >
                  {lvl.label.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {levels.size === 0 && (
          <Text style={{ color: colors.score.amber, fontSize: 11, marginTop: 6 }}>
            Inviting with zero assessments — they won't be able to answer anything until you reassign.
          </Text>
        )}
      </View>

      {error && <Text style={{ color: colors.score.red, fontSize: 13 }}>{error}</Text>}
      <Button label="Send invite" onPress={submit} loading={submitting} icon="paper-plane" />
      <Pressable onPress={onCancel} style={{ alignSelf: 'center', padding: 8 }} hitSlop={8}>
        <Text style={{ color: colors.text.secondary, fontSize: 13 }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function InviteCreatedView({
  invite,
  onClose,
}: {
  invite: CreateInviteResponse;
  onClose: () => void;
}) {
  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignSelf: 'center',
          marginBottom: 6,
        }}
      />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: `${colors.score.green}22`,
            borderWidth: 1,
            borderColor: `${colors.score.green}55`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={28} color={colors.score.green} />
        </View>
        <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '800' }}>
          Invite sent
        </Text>
        <Text style={{ color: colors.text.secondary, fontSize: 12, textAlign: 'center' }}>
          {invite.email} will get an email with the link below. You can also send it directly.
        </Text>
      </View>

      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.07)',
        }}
      >
        <Text
          selectable
          style={{ color: colors.text.primary, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
        >
          {invite.inviteUrl}
        </Text>
      </View>

      <Button
        label="Share invite link"
        icon="share-outline"
        onPress={() =>
          Share.share({
            message: `Join our CyMetric workspace: ${invite.inviteUrl}`,
            url: invite.inviteUrl,
          }).catch(() => {})
        }
      />

      <Pressable onPress={onClose} style={{ alignSelf: 'center', padding: 8 }} hitSlop={8}>
        <Text style={{ color: colors.brand[400], fontSize: 13, fontWeight: '600' }}>Done</Text>
      </Pressable>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}
