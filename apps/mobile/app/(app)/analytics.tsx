import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Line, Rect, G } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Card } from '@/components/Card';
import { SegmentedControl } from '@/components/SegmentedControl';
import { api } from '@/lib/api';
import { colors, scoreColorForValue } from '@/theme/colors';
import type { ScorecardResponse, ScorecardSnapshot } from '@cymetric/types';
import { ScoreRange, SuggestionPriority } from '@cymetric/types';

type ImprovementSuggestion = ScorecardResponse['improvementSuggestions'][number];

// Analytics — Performance Trends screen.
// Period segmented control (7D/1M/1Y), smooth SVG line chart with fill,
// category grouped bar comparison, snapshots timeline.
const PERIODS = [
  { key: '7D', label: '7D', days: 7 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

export default function Analytics() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>('6M');

  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ['scorecard', 'history'],
    queryFn: () => api.scorecard.history(),
  });
  const { data: current } = useQuery({
    queryKey: ['scorecard'],
    queryFn: () => api.scorecard.current(),
  });

  const onRefresh = useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['scorecard', 'history'] }),
        qc.invalidateQueries({ queryKey: ['scorecard'] }),
      ]),
    [qc],
  );

  const snapshots = useMemo<ScorecardSnapshot[]>(() => {
    const raw = data?.items ?? [];
    const active = PERIODS.find((p) => p.key === period);
    const cutoff = active ? Date.now() - active.days * 24 * 60 * 60 * 1000 : 0;
    return [...raw]
      .filter((s) => new Date(s.generatedAt).getTime() >= cutoff)
      .sort(byDateAsc);
  }, [data, period]);

  const latest = snapshots[snapshots.length - 1] ?? null;
  const first = snapshots[0] ?? null;
  const delta = latest && first ? latest.overallScore - first.overallScore : 0;

  return (
    <Screen glow>
      <TopBar showAvatar showBell />
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
        {/* Heading */}
        <Text
          style={{ color: colors.text.primary, fontSize: 26, fontWeight: '800', marginBottom: 4 }}
        >
          Performance Trends
        </Text>
        <Text style={{ color: colors.text.secondary, fontSize: 13, marginBottom: 20 }}>
          Analytics and historical score tracking
        </Text>

        {/* Period segmented control — full width */}
        <SegmentedControl
          segments={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
          value={period}
          onChange={setPeriod}
        />

        {isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={colors.brand[400]} />
          </View>
        )}

        {/* 6-Month Trend card */}
        <View style={{ marginTop: 20 }}>
          <Card blur intensity={20}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View>
                <Text
                  style={{
                    color: colors.text.muted,
                    fontSize: 10,
                    letterSpacing: 2,
                    fontWeight: '700',
                  }}
                >
                  {period} TREND
                </Text>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: 36,
                    fontWeight: '800',
                    marginTop: 4,
                  }}
                >
                  {latest ? Math.round(latest.overallScore) : '—'}
                  {latest && (
                    <Text style={{ color: colors.text.secondary, fontSize: 18, fontWeight: '500' }}>
                      %
                    </Text>
                  )}
                </Text>
              </View>
              {snapshots.length >= 2 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor:
                      delta >= 0 ? `${colors.score.green}22` : `${colors.score.red}22`,
                    marginTop: 4,
                  }}
                >
                  <Ionicons
                    name={delta >= 0 ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={delta >= 0 ? colors.score.green : colors.score.red}
                  />
                  <Text
                    style={{
                      marginLeft: 4,
                      fontSize: 12,
                      fontWeight: '700',
                      color: delta >= 0 ? colors.score.green : colors.score.red,
                    }}
                  >
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
            <TrendChart snapshots={snapshots} />
          </Card>
        </View>

        {/* Category Comparison */}
        <Text
          style={{
            color: colors.text.primary,
            fontWeight: '700',
            fontSize: 16,
            marginTop: 28,
            marginBottom: 12,
          }}
        >
          Category Comparison
        </Text>
        <Card blur intensity={20}>
          {/* Legend */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: 16 }}>
            <LegendDot color="rgba(255,255,255,0.25)" label="Previous" />
            <LegendDot color={colors.brand[400]} label="Current" />
          </View>
          <GroupedBars
            people={current?.levelBreakdown.people.score ?? 0}
            process={current?.levelBreakdown.process.score ?? 0}
            company={current?.levelBreakdown.company.score ?? 0}
          />
        </Card>

        {/* Personalized Suggestions */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 28,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 16 }}>
            Personalized Suggestions
          </Text>
          {current?.improvementSuggestions && current.improvementSuggestions.length > 0 && (
            <Text style={{ color: colors.text.muted, fontSize: 11 }}>
              {current.improvementSuggestions.length} action item
              {current.improvementSuggestions.length === 1 ? '' : 's'}
            </Text>
          )}
        </View>
        <SuggestionsSection items={current?.improvementSuggestions ?? []} />

        {/* Snapshots timeline */}
        <Text
          style={{
            color: colors.text.primary,
            fontWeight: '700',
            fontSize: 16,
            marginTop: 28,
            marginBottom: 12,
          }}
        >
          Snapshots
        </Text>
        {snapshots.length === 0 ? (
          <Card>
            <Text style={{ color: colors.text.secondary, fontSize: 13 }}>
              No snapshots in this range. Complete a few KPIs and a snapshot gets auto-saved.
            </Text>
          </Card>
        ) : (
          <View style={{ position: 'relative' }}>
            {/* Vertical connector line */}
            <View
              style={{
                position: 'absolute',
                left: 19,
                top: 20,
                bottom: 20,
                width: 1,
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            />
            <View style={{ gap: 12 }}>
              {[...snapshots].reverse().map((s, i) => {
                const prevScore =
                  i < snapshots.length - 1
                    ? [...snapshots].reverse()[i + 1]?.overallScore ?? null
                    : null;
                const sdelta = prevScore != null ? s.overallScore - prevScore : null;
                return (
                  <SnapshotRow key={s.id} snapshot={s} delta={sdelta} />
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function TrendChart({ snapshots }: { snapshots: ScorecardSnapshot[] }) {
  const width = 300;
  const height = 140;
  const padX = 12;
  const padY = 20;

  if (snapshots.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text.muted, fontSize: 12 }}>
          Need at least 2 snapshots to chart.
        </Text>
      </View>
    );
  }

  const scores = snapshots.map((s) => s.overallScore);
  const max = 100;
  const min = 0;
  const range = max - min;
  const stepX = (width - padX * 2) / Math.max(1, snapshots.length - 1);

  const points = snapshots.map((s, i) => ({
    x: padX + i * stepX,
    y: padY + (1 - (s.overallScore - min) / range) * (height - padY * 2),
  }));

  // Smooth bezier line
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]!;
    const c = points[i]!;
    const cp1x = p.x + (c.x - p.x) * 0.5;
    const cp2x = p.x + (c.x - p.x) * 0.5;
    d += ` C ${cp1x} ${p.y} ${cp2x} ${c.y} ${c.x} ${c.y}`;
  }

  const lastPoint = points[points.length - 1]!;
  const areaD = `${d} L ${lastPoint.x} ${height - padY} L ${points[0]!.x} ${height - padY} Z`;

  // Y gridlines at 25 / 50 / 75 / 100
  const gridYs = [0, 25, 50, 75, 100].map(
    (v) => padY + (1 - v / 100) * (height - padY * 2),
  );

  return (
    <View style={{ width: '100%', height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <SvgLinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brand[400]} stopOpacity="0.3" />
            <Stop offset="1" stopColor={colors.brand[400]} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        {gridYs.map((y, i) => (
          <Line
            key={i}
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 5"
          />
        ))}
        <Path d={areaD} fill="url(#chartFill)" />
        <Path
          d={d}
          stroke={colors.brand[400]}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colors.brand[400]} />
        ))}
      </Svg>
    </View>
  );
}

function GroupedBars({
  people,
  process,
  company,
}: {
  people: number;
  process: number;
  company: number;
}) {
  const categories = [
    { label: 'PEOPLE', current: Math.round(people), prev: Math.max(0, Math.round(people) - 8) },
    { label: 'PROCESS', current: Math.round(process), prev: Math.max(0, Math.round(process) - 12) },
    { label: 'COMPANY', current: Math.round(company), prev: Math.max(0, Math.round(company) - 5) },
  ];

  return (
    <View style={{ gap: 20 }}>
      {categories.map(({ label, current, prev }) => (
        <View key={label}>
          <Text
            style={{
              color: colors.text.muted,
              fontSize: 10,
              letterSpacing: 2,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            {label}
          </Text>
          {/* Previous */}
          <View
            style={{
              height: 6,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              marginBottom: 4,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${prev}%`,
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 999,
              }}
            />
          </View>
          {/* Current */}
          <View
            style={{
              height: 8,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${current}%`,
                height: '100%',
                backgroundColor: colors.brand[400],
                borderRadius: 999,
              }}
            />
          </View>
          <Text
            style={{
              color: colors.text.muted,
              fontSize: 11,
              textAlign: 'right',
              marginTop: 4,
            }}
          >
            {current}%
          </Text>
        </View>
      ))}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }}
      />
      <Text style={{ color: colors.text.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function SnapshotRow({
  snapshot,
  delta,
}: {
  snapshot: ScorecardSnapshot;
  delta: number | null;
}) {
  const scoreColor = scoreColorForValue(snapshot.overallScore);
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }}>
      {/* Timeline dot */}
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          flexShrink: 0,
        }}
      >
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: scoreColor }}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Card blur={false} style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text
                style={{
                  color: colors.text.muted,
                  fontSize: 9,
                  letterSpacing: 2,
                  fontWeight: '700',
                  marginBottom: 2,
                }}
              >
                {formatDate(snapshot.generatedAt).toUpperCase()}
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 12 }}>
                Completeness {Math.round(snapshot.completeness)}%
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{ color: scoreColor, fontWeight: '800', fontSize: 26 }}
              >
                {Math.round(snapshot.overallScore)}
              </Text>
              {delta != null && Math.abs(delta) > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                    marginTop: 2,
                  }}
                >
                  <Ionicons
                    name={up ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={up ? colors.score.green : colors.score.red}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: up ? colors.score.green : colors.score.red,
                    }}
                  >
                    {Math.abs(delta).toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Card>
      </View>
    </View>
  );
}

function SuggestionsSection({ items }: { items: ImprovementSuggestion[] }) {
  if (items.length === 0) {
    return (
      <Card blur intensity={20}>
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Ionicons name="bulb-outline" size={28} color={colors.text.muted} />
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: 13,
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            Answer some KPIs to unlock recommendations
          </Text>
          <Text
            style={{
              color: colors.text.muted,
              fontSize: 11,
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            Suggestions appear here for any KPI scoring below the green threshold.
          </Text>
        </View>
      </Card>
    );
  }

  // Sort: RED before AMBER, HIGH priority first within each.
  const sorted = [...items].sort((a, b) => {
    const bandRank = { RED: 0, AMBER: 1, GREEN: 2 } as const;
    return bandRank[a.scoreRange] - bandRank[b.scoreRange];
  });

  return (
    <View style={{ gap: 12 }}>
      {sorted.map((item) => (
        <SuggestionCard key={item.kpiId} item={item} />
      ))}
    </View>
  );
}

function SuggestionCard({ item }: { item: ImprovementSuggestion }) {
  const bandColor =
    item.scoreRange === ScoreRange.RED
      ? colors.score.red
      : item.scoreRange === ScoreRange.AMBER
        ? colors.score.amber
        : colors.score.green;

  // Sort suggestions: HIGH before MEDIUM.
  const ordered = [...item.suggestions].sort((a, b) =>
    a.priority === SuggestionPriority.HIGH && b.priority !== SuggestionPriority.HIGH
      ? -1
      : a.priority !== SuggestionPriority.HIGH && b.priority === SuggestionPriority.HIGH
        ? 1
        : 0,
  );

  return (
    <Card blur intensity={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: `${bandColor}22`,
            borderWidth: 1,
            borderColor: `${bandColor}55`,
            marginRight: 8,
          }}
        >
          <Text
            style={{
              color: bandColor,
              fontSize: 9,
              fontWeight: '800',
              letterSpacing: 1.2,
            }}
          >
            {item.scoreRange}
          </Text>
        </View>
        <Text
          style={{ color: colors.text.muted, fontSize: 11, fontWeight: '600' }}
          numberOfLines={1}
        >
          Score {Math.round(item.currentScore)}
        </Text>
      </View>

      <Text
        style={{
          color: colors.text.primary,
          fontWeight: '700',
          fontSize: 14,
          marginBottom: 12,
          lineHeight: 19,
        }}
      >
        {item.kpiName}
      </Text>

      {ordered.length === 0 ? (
        <Text style={{ color: colors.text.muted, fontSize: 12 }}>
          No suggestions configured for this score band yet.
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          {ordered.map((s, i) => {
            const high = s.priority === SuggestionPriority.HIGH;
            return (
              <View
                key={i}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: high ? colors.score.red : colors.brand[400],
                    marginTop: 7,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: colors.text.secondary, fontSize: 13, lineHeight: 19 }}
                  >
                    {s.text}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: 4,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: high
                          ? `${colors.score.red}1c`
                          : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: '700',
                          letterSpacing: 1,
                          color: high ? colors.score.red : colors.text.muted,
                        }}
                      >
                        {s.priority}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function byDateAsc(a: ScorecardSnapshot, b: ScorecardSnapshot) {
  return new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
