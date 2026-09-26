import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { PressableGlow } from '@/components/PressableGlow';
import { api } from '@/lib/api';
import { frameworkLabel } from '@/lib/frameworks';
import { colors } from '@/theme/colors';
import type { Kpi, Level, TierCondition } from '@cymetric/types';

// Per-KPI question screen — matches mock screenshot 2.
// Routed as /(app)/kpi/[id]?level=PEOPLE&index=3
//
// Submit path: inputValue is derived from the selected tier's condition
// (see inputValueForTier) so we always match the backend scoring engine,
// which operates numerically for lte/lt/gte/gt/range and numeric eq.
//
// All tiers render with the same neutral styling — answering shouldn't feel
// like being graded. Selected state gets the green halo to confirm the pick.
const TIER_NEUTRAL = {
  color: colors.text.secondary,
  icon: 'radio-button-off' as const,
};

// Remove author hints like "Lower is better." / "Higher is better." that
// were embedded in the KPI infoText. Users found them confusing — they felt
// like the app was asking them to optimise numbers rather than describe reality.
function stripDirectionalHint(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\s*(Lower|Higher)\s+is\s+better\.?/gi, '')
    .replace(/\s*(The\s+)?lower\s+the\s+better\.?/gi, '')
    .replace(/\s*(The\s+)?higher\s+the\s+better\.?/gi, '')
    .trim();
}

export default function KpiQuestion() {
  const params = useLocalSearchParams<{ id: string; level?: Level; index?: string }>();
  const kpiId = params.id;
  const level = (params.level as Level | undefined) ?? 'PEOPLE';
  const index = Number(params.index ?? '0');
  const qc = useQueryClient();

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis', 'all'],
    queryFn: () => api.kpis.list(),
  });

  const byLevel = useMemo(() => {
    const out: Kpi[] = [];
    for (const k of kpis?.items ?? []) if (k.level === level) out.push(k);
    return out;
  }, [kpis, level]);

  const kpi = useMemo(() => kpis?.items.find((k) => k.id === kpiId) ?? null, [kpis, kpiId]);
  const tiersSorted = useMemo(
    () => (kpi ? [...kpi.tiers].sort((a, b) => a.tierOrder - b.tierOrder) : []),
    [kpi],
  );

  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [percentValue, setPercentValue] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);

  // Reset when navigating to a different KPI.
  useEffect(() => {
    setSelectedTierId(null);
    setPercentValue('');
    setInfoOpen(false);
  }, [kpiId]);

  const submit = useMutation({
    mutationFn: async (opts: { advance: boolean }) => {
      if (!kpi) throw new Error('KPI not loaded');
      let inputValue: string;
      if (kpi.inputType === 'PERCENTAGE') {
        const n = Number(percentValue);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          throw new Error('Enter a percentage between 0 and 100');
        }
        inputValue = String(Math.round(n));
      } else {
        const tier = tiersSorted.find((t) => t.id === selectedTierId);
        if (!tier) throw new Error('Pick an option first');
        inputValue = inputValueForTier(tier.condition, tier.tierLabel);
      }
      const nextIndex = index + 1;
      const status = nextIndex >= byLevel.length ? 'COMPLETED' : 'IN_PROGRESS';

      // Fire both writes in parallel — `progress.save` doesn't depend on
      // the response of `kpis.submit` (nextIndex is computed client-side),
      // so we don't need to wait for the first before starting the second.
      // Cuts the click-to-next latency roughly in half on warm Vercel and
      // makes a much bigger difference under cold-start.
      await Promise.all([
        api.kpis.submit({ kpiId: kpi.id, inputValue }),
        api.progress.save({ level, lastQuestionIndex: nextIndex, status }),
      ]);
      return { nextIndex, status };
    },
    onSuccess: ({ nextIndex, status }, vars) => {
      // Fire-and-forget the cache invalidations — the next screen pulls
      // fresh data via its own queries when it mounts; we don't need to
      // block this navigation on the invalidation round-trip.
      void qc.invalidateQueries({ queryKey: ['scorecard'] });
      void qc.invalidateQueries({ queryKey: ['progress'] });

      if (!vars.advance) {
        router.replace('/(app)/assessment');
        return;
      }
      if (status === 'COMPLETED' || nextIndex >= byLevel.length) {
        router.replace('/(app)/results');
        return;
      }
      const nextKpi = byLevel[nextIndex];
      if (nextKpi) {
        router.replace(`/(app)/kpi/${nextKpi.id}?level=${level}&index=${nextIndex}`);
      }
    },
    onError: (err: any) => {
      Alert.alert('Could not save', err?.message ?? 'Please try again.');
    },
  });

  const canSubmit =
    !!kpi &&
    !submit.isPending &&
    (kpi.inputType === 'PERCENTAGE' ? percentValue.length > 0 : selectedTierId !== null);

  if (isLoading || !kpi) {
    return (
      <Screen glow>
        <TopBar title="QUESTION" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand[400]} />
        </View>
      </Screen>
    );
  }

  const total = byLevel.length;
  const humanIndex = Math.min(index + 1, Math.max(total, 1));
  const categoryLabel = frameworkLabel(kpi.frameworkCode);
  const progressPct = total > 0 ? (humanIndex / total) * 100 : 0;

  return (
    <Screen>
      {/* Custom header: back + title + progress underline */}
      <View
        style={{
          paddingTop: 56,
          paddingHorizontal: 20,
          paddingBottom: 0,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              color: colors.brand[400],
              fontStyle: 'italic',
              fontWeight: '700',
              fontSize: 16,
              letterSpacing: 1,
            }}
          >
            CyMetric
          </Text>
          <Pressable onPress={() => setInfoOpen(true)} hitSlop={10}>
            <Ionicons name="information-circle-outline" size={22} color={colors.brand[400]} />
          </Pressable>
        </View>
        {/* Progress underline */}
        <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
          <View
            style={{
              width: `${progressPct}%`,
              height: '100%',
              backgroundColor: colors.brand[400],
              borderRadius: 999,
            }}
          />
        </View>
        <Text
          style={{
            color: colors.text.muted,
            fontSize: 10,
            letterSpacing: 2,
            marginTop: 6,
            marginBottom: 2,
          }}
        >
          Q {humanIndex} / {total || 1}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
      >
        {/* Framework category pill */}
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: `${colors.brand[500]}18`,
              borderWidth: 1,
              borderColor: `${colors.brand[500]}44`,
              gap: 6,
            }}
          >
            <Ionicons name="shield-outline" size={12} color={colors.brand[400]} />
            <Text
              style={{
                color: colors.brand[400],
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.5,
              }}
            >
              {categoryLabel}
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: 22,
            fontWeight: '800',
            lineHeight: 30,
            marginBottom: 6,
          }}
        >
          {kpi.kpiName}
        </Text>
        {stripDirectionalHint(kpi.infoText) ? (
          <Text
            style={{ color: colors.text.muted, fontSize: 13, lineHeight: 19, marginBottom: 20 }}
            numberOfLines={2}
          >
            {stripDirectionalHint(kpi.infoText)}
          </Text>
        ) : (
          <View style={{ marginBottom: 20 }} />
        )}

        {kpi.inputType === 'PERCENTAGE' ? (
          <Card>
            <Text className="text-text-muted text-xs tracking-widest mb-3">ENTER A PERCENTAGE</Text>
            <View className="flex-row items-center">
              <TextInput
                value={percentValue}
                onChangeText={(v) => setPercentValue(v.replace(/[^0-9]/g, '').slice(0, 3))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                style={{
                  flex: 1,
                  color: colors.text.primary,
                  fontSize: 48,
                  fontWeight: '800',
                }}
              />
              <Text className="text-text-secondary text-3xl font-bold ml-2">%</Text>
            </View>
            <View className="h-2 bg-bg-elevated rounded-full mt-4 overflow-hidden">
              <View
                style={{
                  width: `${Math.min(Number(percentValue) || 0, 100)}%`,
                  height: '100%',
                  backgroundColor:
                    (Number(percentValue) || 0) >= 75
                      ? colors.score.green
                      : (Number(percentValue) || 0) >= 50
                        ? colors.score.amber
                        : colors.score.red,
                  borderRadius: 999,
                }}
              />
            </View>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {tiersSorted.map((tier) => {
              const isSelected = selectedTierId === tier.id;
              return (
                <PressableGlow
                  key={tier.id}
                  onPress={() => setSelectedTierId(tier.id)}
                >
                  <Card selected={isSelected}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: isSelected
                            ? `${colors.score.green}22`
                            : 'rgba(255,255,255,0.05)',
                          borderWidth: 1,
                          borderColor: isSelected
                            ? `${colors.score.green}55`
                            : 'rgba(255,255,255,0.08)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Ionicons
                          name={isSelected ? 'checkmark' : TIER_NEUTRAL.icon}
                          size={20}
                          color={isSelected ? colors.score.green : TIER_NEUTRAL.color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontWeight: '700',
                            letterSpacing: 1.5,
                            fontSize: 11,
                            color: isSelected ? colors.score.green : colors.text.secondary,
                          }}
                        >
                          {tier.tierLabel}
                        </Text>
                        <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
                          {describeCondition(tier.condition)}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          borderColor: isSelected ? colors.score.green : 'rgba(255,255,255,0.2)',
                          backgroundColor: isSelected ? colors.score.green : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                      </View>
                    </View>
                  </Card>
                </PressableGlow>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Sticky footer — always visible above safe area */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 28,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(5,6,13,0.85)',
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            label="PAUSE & SAVE"
            icon="pause-circle-outline"
            onPress={() => submit.mutate({ advance: false })}
            disabled={!canSubmit}
            loading={submit.isPending}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="NEXT QUESTION"
            iconRight="arrow-forward"
            onPress={() => submit.mutate({ advance: true })}
            disabled={!canSubmit}
            loading={submit.isPending}
          />
        </View>
      </View>

      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-end"
          onPress={() => setInfoOpen(false)}
        >
          <Pressable onPress={() => {}}>
            <View className="bg-bg-card border-t border-border-subtle rounded-t-3xl p-6">
              <View className="flex-row items-center mb-3">
                <Ionicons
                  name="information-circle"
                  size={22}
                  color={colors.brand[400]}
                />
                <Text className="text-text-primary font-bold ml-2 text-lg">About this KPI</Text>
              </View>
              <Text className="text-text-secondary leading-5 mb-4">{kpi.infoText}</Text>
              {(kpi.nistControlIds.length > 0 || kpi.isoControlIds.length > 0) && (
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {kpi.nistControlIds.map((c) => (
                    <View
                      key={`nist-${c}`}
                      className="px-2 py-1 rounded-full bg-brand-500/15 border border-brand-500/30"
                    >
                      <Text className="text-brand-400 text-[10px] font-bold">NIST · {c}</Text>
                    </View>
                  ))}
                  {kpi.isoControlIds.map((c) => (
                    <View
                      key={`iso-${c}`}
                      className="px-2 py-1 rounded-full bg-bg-elevated border border-border-subtle"
                    >
                      <Text className="text-text-secondary text-[10px] font-bold">ISO · {c}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Button
                variant="secondary"
                label="Close"
                onPress={() => setInfoOpen(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// Produce a value that is guaranteed to satisfy `cond` when fed through the
// backend scoring engine (apps/api/src/lib/scoring.ts). DROPDOWN/RADIO tiers
// often carry numeric conditions, so the human-readable tierLabel can't be
// submitted directly — NaN coercion would blow past every numeric comparator.
function inputValueForTier(cond: TierCondition, fallbackLabel: string): string {
  switch (cond.op) {
    case 'eq':
      return String(cond.value);
    case 'lte':
      return String(cond.value);
    case 'lt':
      return String(cond.value - 1);
    case 'gte':
      return String(cond.value);
    case 'gt':
      return String(cond.value + 1);
    case 'range':
      return String(Math.floor((cond.min + cond.max) / 2));
    case 'in': {
      const first = cond.values[0];
      return first === undefined ? fallbackLabel : String(first);
    }
  }
}

function describeCondition(cond: Kpi['tiers'][number]['condition']): string {
  switch (cond.op) {
    case 'lte':
      return `≤ ${cond.value}`;
    case 'lt':
      return `< ${cond.value}`;
    case 'gte':
      return `≥ ${cond.value}`;
    case 'gt':
      return `> ${cond.value}`;
    case 'range':
      return `${cond.min} – ${cond.max}`;
    case 'eq':
      return String(cond.value);
    case 'in':
      return cond.values.join(' · ');
  }
}
