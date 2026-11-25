import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Share,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Role, type ScorecardResponse } from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { ScoreRing } from '@/components/ScoreRing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { FRAMEWORKS, type FrameworkCode } from '@/lib/frameworks';
import { colors, scoreColorForValue } from '@/theme/colors';

// Full scorecard detail — overall gauge, per-level breakdown, improvement
// suggestions, and a Share CTA that mints a /share link. Shared via the
// OS share sheet so the caller can paste it into Slack / email / whatever.
export default function Scorecard() {
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ framework?: string }>();
  const me = useAuthStore((s) => s.me);

  // Resolve the requested framework, falling back to the organisation setting.
  const requestedFramework = params.framework;
  const selectedFramework: FrameworkCode = FRAMEWORKS.some(
    (item) => item.code === requestedFramework,
  )
    ? (requestedFramework as FrameworkCode)
    : ((me?.org.selectedFramework ?? 'EXCEL') as FrameworkCode);
  const selectedFrameworkLabel =
    FRAMEWORKS.find((item) => item.code === selectedFramework)?.label ?? 'KPI Scorecard';

  const { data, isLoading, isRefetching, isError, error } = useQuery<ScorecardResponse>({
    queryKey: ['scorecard', selectedFramework],
    // SDK automatically refreshes expired tokens, including this screen.
    queryFn: () => api.scorecard.current(selectedFramework),
  });
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const canManageActions = me?.user.role === Role.ADMIN; 
  const { data: auditData } = useQuery({
    queryKey: ['assessment-audit'],
    queryFn: () => api.audit.assessments(),
    enabled: canManageActions,
  });
  const { data: actionData } = useQuery({
    queryKey: ['corrective-actions'],
    queryFn: () => api.actions.list(),
  });

  const onRefresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ['scorecard', selectedFramework] }),
    [qc, selectedFramework],
  );

  const onShare = async () => {
    setSharing(true);
    try {
      const res = await api.scorecard.createShare({ expiresInDays: 30 });
      await Share.share({
        message: `Our CyMetric — ${res.shareUrl}`,
        url: res.shareUrl,
        title: 'CyMetric',
      });
    } catch (err: any) {
      Alert.alert('Share failed', err?.message ?? 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const onExport = async (format: 'pdf' | 'xlsx') => {
    setExporting(format);
    try {
      // Use a 1-day expiring share token so Android's external browser can
      // download the summary report without exposing the user's login token.
      const res = await api.scorecard.createShare({ expiresInDays: 1 });
      await Linking.openURL(`${API_BASE_URL}/api/v1/share/public/${encodeURIComponent(res.token)}/export?format=${format}`);
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Please try again.');
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return (
      <Screen glow>
        <TopBar title="SCORECARD" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand[400]} />
          <Text className="text-text-muted mt-3">Computing scorecard…</Text>
        </View>
      </Screen>
    );
  }

  const overall = data?.overallScore ?? null;
  const completeness = Math.round(data?.completeness ?? 0);
  const levelStats = data?.levelBreakdown;
  const totalKpis = (levelStats?.people.total ?? 0) + (levelStats?.process.total ?? 0) + (levelStats?.company.total ?? 0);
  const answeredKpis = (levelStats?.people.answered ?? 0) + (levelStats?.process.answered ?? 0) + (levelStats?.company.answered ?? 0);
  const pendingKpis = Math.max(0, totalKpis - answeredKpis);
  const totalWeight = (levelStats?.people.maxPossible ?? 0) + (levelStats?.process.maxPossible ?? 0) + (levelStats?.company.maxPossible ?? 0);
  const actions = [...(data?.improvementSuggestions ?? [])].sort((a, b) => {
    if (a.scoreRange === b.scoreRange) return a.currentScore - b.currentScore;
    return a.scoreRange === 'RED' ? -1 : 1;
  });

  return (
    <Screen glow>
      <TopBar title={`${selectedFrameworkLabel.toUpperCase()} SCORECARD`} showBack />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.brand[400]}
          />
        }
      >
        {isError && (
          <Card>
            <Text className="text-text-primary font-bold mb-2">Could not load scorecard</Text>
            <Text className="text-text-secondary text-sm mb-3">
              {error instanceof Error ? error.message : 'Please refresh to try again.'}
            </Text>
            <Button label="Try again" onPress={onRefresh} />
          </Card>
        )}

        <View className="items-center mt-2 mb-6">
          <Text className="text-text-secondary text-xs font-bold tracking-widest mb-3">{selectedFrameworkLabel}</Text>
          <ScoreRing score={overall} label="KPI performance · out of 100" />
          <Text className="text-text-secondary text-center mt-5 px-6 leading-5">
            {overall == null
              ? 'Answer KPIs to generate your first scorecard.'
              : `Completeness ${completeness}%. Latest snapshot ${data?.latestSnapshot ? formatDate(data.latestSnapshot.generatedAt) : 'pending'}.`}
          </Text>
        </View>

        <Card>
          <Text className="text-text-primary font-bold mb-3">Assessment completeness</Text>
          <Text className="text-text-primary text-xl font-bold">{completeness}% completed</Text>
          <View className="flex-row justify-between mt-2">
            <Text className="text-text-secondary text-sm">{answeredKpis} answered</Text>
            <Text className="text-text-secondary text-sm">{pendingKpis} pending</Text>
          </View>
          <Text className="text-text-muted text-xs mt-2">
            Completeness measures questions answered, not security performance. N/A counts as answered but does not contribute to score.
          </Text>
        </Card>

        <View className="mt-5 mb-3">
          <Text className="text-text-primary font-bold text-lg">Category performance and weights</Text>
          <Text className="text-text-muted text-xs mt-1">Weights show each category's share of applicable maximum weighted points.</Text>
        </View>
        <View className="flex-row gap-3 mb-3">
          <LevelSummary title="People" stats={data?.levelBreakdown.people} totalWeight={totalWeight} />
          <LevelSummary title="Process" stats={data?.levelBreakdown.process} totalWeight={totalWeight} />
        </View>
        <LevelSummary title="Company" stats={data?.levelBreakdown.company} totalWeight={totalWeight} full />

        <View className="mt-6">
          <Text className="text-text-primary font-bold text-lg mb-3">Recommended actions ({actions.length})</Text>
          {actions.length === 0 ? (
            <Card>
              <Text className="text-text-secondary text-sm">
                {isError
                  ? 'Recommendations are unavailable while the scorecard is offline.'
                  : completeness === 0
                    ? 'Complete an assessment to receive recommendations.'
                    : 'No priority actions for your answered KPIs.'}
              </Text>
            </Card>
          ) : (
            <View className="gap-3">
              {actions.map((s: ScorecardResponse['improvementSuggestions'][number]) => {
                const colour = bandColor(s.scoreRange);
                return (
                  <Card key={s.kpiId}>
                    <View className="flex-row items-start justify-between mb-2">
                      <Text
                        className="text-text-primary font-semibold flex-1 pr-2"
                        numberOfLines={2}
                      >
                        {s.kpiName}
                      </Text>
                      <View
                        className="px-2 py-1 rounded-full"
                        style={{ backgroundColor: `${colour}22` }}
                      >
                        <Text
                          className="text-[10px] font-bold tracking-widest"
                          style={{ color: colour }}
                        >
                          {s.scoreRange}
                        </Text>
                      </View>
                    </View>
                    {s.suggestions.map((suggestion: ScorecardResponse['improvementSuggestions'][number]['suggestions'][number], i: number) => (
                      <View key={i} className="flex-row mt-1">
                        <Ionicons
                          name={suggestion.priority === 'HIGH' ? 'flash' : 'arrow-forward'}
                          size={14}
                          color={suggestion.priority === 'HIGH' ? colors.score.red : colors.brand[400]}
                          style={{ marginTop: 3, marginRight: 6 }}
                        />
                        <Text className="text-text-secondary text-sm flex-1 leading-5">
                          {suggestion.text}
                        </Text>
                      </View>
                    ))}
                    <ActionTracker
                      kpiId={s.kpiId}
                      canEdit={canManageActions}
                      action={actionData?.items.find((a) => a.kpiId === s.kpiId)}
                    />
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {canManageActions && (
          <View className="mt-7">
            <Text className="text-text-primary font-bold text-lg mb-3">Assessment change history</Text>
            <Card>
              {(auditData?.items ?? []).length === 0 ? (
                <Text className="text-text-secondary text-sm">No recorded changes yet.</Text>
              ) : (
                (auditData?.items ?? []).slice(0, 10).map((event) => (
                  <Text key={event.id} className="text-text-secondary text-xs mb-2">
                    {new Date(event.createdAt).toLocaleDateString()} · {event.action.replace(/_/g, ' ')} · {event.resource}
                  </Text>
                ))
              )}
            </Card>
          </View>
        )}
        <View className="mt-8" style={{ gap: 10 }}>
          <Text className="text-text-secondary text-xs">PDF and Excel downloads use a 24-hour summary-only sharing link. Detailed KPI exports require authenticated API access.</Text>
          <Button label="Download PDF" icon="document-text-outline" onPress={() => onExport('pdf')} loading={exporting === 'pdf'} disabled={exporting !== null} />
          <Button label="Download Excel" icon="grid-outline" onPress={() => onExport('xlsx')} loading={exporting === 'xlsx'} disabled={exporting !== null} />
          <Button
            label="Share Scorecard"
            icon="share-outline"
            onPress={onShare}
            loading={sharing}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function LevelSummary({
  title,
  stats,
  full,
  totalWeight,
}: {
  title: string;
  stats?: {
    score: number;
    maxPossible: number;
    answered: number;
    total: number;
    colorBand: 'GREEN' | 'AMBER' | 'RED';
  };
  full?: boolean;
  totalWeight: number;
}) {
  const score = stats?.score ?? null;
  const colour = score == null ? colors.brand[400] : scoreColorForValue(score);
  return (
    <Pressable className={full ? 'w-full mb-0' : 'flex-1'}>
      <Card>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-text-primary font-bold">{title}</Text>
          <Text
            className="text-[10px] font-bold tracking-widest"
            style={{ color: stats ? bandColor(stats.colorBand) : colors.text.muted }}
          >
            {stats?.colorBand ?? '—'}
          </Text>
        </View>
        <Text className="text-text-primary" style={{ fontSize: 26, fontWeight: '800' }}>
          {score == null ? '—' : Math.round(score)}
          <Text className="text-text-secondary text-base">%</Text>
        </Text>
        <Text className="text-text-muted text-xs mt-1">
          {stats ? `${stats.answered} answered · ${Math.max(0, stats.total - stats.answered)} pending` : 'No data'}
        </Text>
        <Text className="text-text-muted text-xs mt-1">
          {stats && totalWeight > 0 ? `Scoring weight: ${Math.round((stats.maxPossible / totalWeight) * 100)}% · ${stats.maxPossible.toFixed(1)} weighted points` : 'Weight unavailable'}
        </Text>
        <View className="h-1.5 bg-bg-elevated rounded-full mt-3 overflow-hidden">
          <View
            style={{
              width: `${score ?? 0}%`,
              height: '100%',
              backgroundColor: colour,
              borderRadius: 999,
            }}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function bandColor(band: 'GREEN' | 'AMBER' | 'RED'): string {
  if (band === 'GREEN') return colors.score.green;
  if (band === 'AMBER') return colors.score.amber;
  return colors.score.red;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

type TrackedAction = Awaited<ReturnType<typeof api.actions.list>>['items'][number];

function ActionTracker({
  kpiId, canEdit, action,
}: {
  kpiId: string;
  canEdit: boolean;
  action?: TrackedAction;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState(action?.ownerEmail ?? '');
  const [dueDate, setDueDate] = useState(action?.dueDate ?? '');
  const [status, setStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'COMPLETED'>(action?.status ?? 'OPEN');
  const [notes, setNotes] = useState(action?.notes ?? '');
  const saving = useMutation({
    mutationFn: () => api.actions.update({
      kpiId, ownerEmail: ownerEmail.trim() || null,
      dueDate: dueDate.trim() || null, status, notes: notes.trim() || null,
    }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ['corrective-actions'] });
    },
    onError: (err: any) => Alert.alert('Action not saved', err?.message ?? 'Try again.'),
  });

  return (
    <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: 12 }}>
      <Text style={{ color: colors.text.primary, fontWeight: '700', marginBottom: 6 }}>Action tracking</Text>
      <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
        Owner: {action?.ownerName ?? action?.ownerEmail ?? 'Unassigned'} ·
        Due: {action?.dueDate ?? 'Not set'} ·
        Status: {action?.status?.replace('_', ' ') ?? 'OPEN'}
      </Text>
      {canEdit && !editing && (
        <Pressable onPress={() => {
          setOwnerEmail(action?.ownerEmail ?? '');
          setDueDate(action?.dueDate ?? '');
          setStatus(action?.status ?? 'OPEN');
          setNotes(action?.notes ?? '');
          setEditing(true);
        }} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.brand[400], fontWeight: '700' }}>Assign or update action</Text>
        </Pressable>
      )}
      {canEdit && editing && (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={{ color: colors.text.secondary, fontSize: 12 }}>Owner email (existing team member)</Text>
          <TextInput
            value={ownerEmail} onChangeText={setOwnerEmail} autoCapitalize="none"
            keyboardType="email-address" placeholder="owner@example.com"
            placeholderTextColor={colors.text.muted}
            style={{ backgroundColor: colors.bg.elevated, color: colors.text.primary, padding: 12, borderRadius: 10 }}
          />
          <Text style={{ color: colors.text.secondary, fontSize: 12 }}>Target date (YYYY-MM-DD)</Text>
          <TextInput
            value={dueDate} onChangeText={setDueDate} placeholder="2026-12-31"
            placeholderTextColor={colors.text.muted}
            style={{ backgroundColor: colors.bg.elevated, color: colors.text.primary, padding: 12, borderRadius: 10 }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['OPEN', 'IN_PROGRESS', 'COMPLETED'] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setStatus(value)}
                style={{ borderWidth: 1, borderColor: status === value ? colors.brand[400] : colors.border.muted, borderRadius: 10, padding: 10 }}
              >
                <Text style={{ color: status === value ? colors.brand[400] : colors.text.secondary }}>
                  {value.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={notes} onChangeText={setNotes} multiline maxLength={2000}
            placeholder="Progress notes" placeholderTextColor={colors.text.muted}
            style={{ backgroundColor: colors.bg.elevated, color: colors.text.primary, padding: 12, borderRadius: 10, minHeight: 64 }}
          />
          <Button label="Save action" onPress={() => saving.mutate()} loading={saving.isPending} disabled={saving.isPending} />
          <Button label="Cancel" variant="outline" onPress={() => setEditing(false)} />
        </View>
      )}
    </View>
  );
}
