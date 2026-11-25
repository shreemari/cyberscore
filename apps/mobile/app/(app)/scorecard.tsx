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
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { ScorecardResponse } from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { ScoreRing } from '@/components/ScoreRing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
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
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        <View className="mt-8">
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
