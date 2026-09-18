import { useCallback, useState } from 'react';
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
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { ScoreRing } from '@/components/ScoreRing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { colors, scoreColorForValue } from '@/theme/colors';

// Full scorecard detail — overall gauge, per-level breakdown, improvement
// suggestions, and a Share CTA that mints a /share link. Shared via the
// OS share sheet so the caller can paste it into Slack / email / whatever.
export default function Scorecard() {
  const qc = useQueryClient();
  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ['scorecard'],
    queryFn: () => api.scorecard.current(),
  });
  const [sharing, setSharing] = useState(false);

  const onRefresh = useCallback(
    () => qc.invalidateQueries({ queryKey: ['scorecard'] }),
    [qc],
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

  return (
    <Screen glow>
      <TopBar title="SCORECARD" showBack />
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
        <View className="items-center mt-2 mb-6">
          <ScoreRing score={overall} label="Overall · out of 100" />
          <Text className="text-text-secondary text-center mt-5 px-6 leading-5">
            {overall == null
              ? 'Answer KPIs to generate your first scorecard.'
              : `Completeness ${completeness}%. Latest snapshot ${data?.latestSnapshot ? formatDate(data.latestSnapshot.generatedAt) : 'pending'}.`}
          </Text>
        </View>

        <View className="flex-row gap-3 mb-3">
          <LevelSummary title="People" stats={data?.levelBreakdown.people} />
          <LevelSummary title="Process" stats={data?.levelBreakdown.process} />
        </View>
        <LevelSummary title="Company" stats={data?.levelBreakdown.company} full />

        <View className="mt-6">
          <Text className="text-text-primary font-bold text-lg mb-3">Recommended actions</Text>
          {(data?.improvementSuggestions ?? []).length === 0 ? (
            <Card>
              <Text className="text-text-secondary text-sm">
                No priority actions — keep up the momentum.
              </Text>
            </Card>
          ) : (
            <View className="gap-3">
              {(data?.improvementSuggestions ?? []).slice(0, 5).map((s) => {
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
                    {s.suggestions.map((suggestion, i) => (
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
}: {
  title: string;
  stats?: {
    score: number;
    answered: number;
    total: number;
    colorBand: 'GREEN' | 'AMBER' | 'RED';
  };
  full?: boolean;
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
          {stats ? `${stats.answered} of ${stats.total} answered` : 'No data'}
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
