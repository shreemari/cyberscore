import { useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { Card } from '@/components/Card';
import { PressableGlow } from '@/components/PressableGlow';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { frameworkLabel } from '@/lib/frameworks';
import { colors, scoreColorForValue } from '@/theme/colors';
import { OrgMode, Role, type Level } from '@cymetric/types';

// Level picker — three tiles that fan into the per-KPI question screen.
// We need two queries:
//   • /progress — percent complete + resume index per level
//   • /kpis      — total KPI list, so we can pick the next unanswered id
// The "Continue" button on each card deep-links to /kpi/[id] at the right index.
const LEVELS: Array<{
  key: Level;
  title: string;
  subtitle: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
}> = [
  {
    key: 'PEOPLE',
    title: 'People',
    subtitle: 'Awareness, training, insider risk',
    icon: 'people',
  },
  {
    key: 'PROCESS',
    title: 'Process',
    subtitle: 'Policies, incident response, governance',
    icon: 'git-network-outline',
  },
  {
    key: 'COMPANY',
    title: 'Company',
    subtitle: 'Technical controls, network, endpoints',
    icon: 'business',
  },
];

export default function Assessment() {
  const me = useAuthStore((s) => s.me);
  const isEnterpriseEmployee =
    me?.org.mode === OrgMode.ENTERPRISE && me.user.role !== Role.ADMIN;
  const allowed = new Set<Level>(me?.user.allowedLevels ?? ['PEOPLE', 'PROCESS', 'COMPANY']);
  const visibleLevels = LEVELS.filter((l) => allowed.has(l.key));
  const restricted = visibleLevels.length < LEVELS.length;

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.progress.get(),
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis', 'all'],
    queryFn: () => api.kpis.list(),
  });

  const loading = progressLoading || kpisLoading;

  const perLevel = useMemo(() => {
    if (!kpis?.items) return null;
    const grouped: Record<Level, string[]> = { PEOPLE: [], PROCESS: [], COMPANY: [] };
    for (const k of kpis.items) grouped[k.level].push(k.id);
    return grouped;
  }, [kpis]);

  const openLevel = (level: Level) => {
    if (!perLevel) return;
    const ids = perLevel[level];
    if (ids.length === 0) return;
    const resume = progress?.levels.find((l) => l.level === level);
    const idx = resume && resume.lastQuestionIndex < ids.length ? resume.lastQuestionIndex : 0;
    const target = ids[idx] ?? ids[0];
    if (target) router.push(`/(app)/kpi/${target}?level=${level}&index=${idx}`);
  };

  return (
    <Screen glow>
      <TopBar title="ASSESSMENT" showBack />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator
        alwaysBounceVertical
      >
        <Text className="text-text-primary text-2xl font-bold mb-1">Pick a category</Text>
        <Text className="text-text-secondary mb-4">
          Answer one question at a time. Progress saves automatically.
        </Text>

        {isEnterpriseEmployee && me?.org.selectedFramework && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              borderRadius: 12,
              backgroundColor: `${colors.brand[500]}14`,
              borderWidth: 1,
              borderColor: `${colors.brand[500]}33`,
              marginBottom: 16,
            }}
          >
            <Ionicons name="lock-closed" size={14} color={colors.brand[400]} />
            <Text style={{ flex: 1, color: colors.text.secondary, fontSize: 12, lineHeight: 16 }}>
              Framework locked by your admin:{' '}
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
                {frameworkLabel(me.org.selectedFramework)}
              </Text>
            </Text>
          </View>
        )}

        {loading && (
          <View className="items-center py-10">
            <ActivityIndicator color={colors.brand[400]} />
            <Text className="text-text-muted mt-3">Loading KPIs…</Text>
          </View>
        )}

        {!loading && restricted && visibleLevels.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
              marginBottom: 16,
            }}
          >
            <Ionicons name="information-circle-outline" size={14} color={colors.text.muted} />
            <Text style={{ flex: 1, color: colors.text.muted, fontSize: 12, lineHeight: 16 }}>
              Your admin has assigned you {visibleLevels.length} of 3 categories.
            </Text>
          </View>
        )}

        {!loading && visibleLevels.length === 0 && (
          <View
            style={{
              alignItems: 'center',
              padding: 24,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
            }}
          >
            <Ionicons name="lock-closed" size={28} color={colors.text.muted} />
            <Text
              style={{
                color: colors.text.secondary,
                fontSize: 14,
                marginTop: 10,
                textAlign: 'center',
              }}
            >
              No assessments assigned to you yet.
            </Text>
            <Text
              style={{
                color: colors.text.muted,
                fontSize: 12,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              Ask your admin to grant you access to People, Process, or Company.
            </Text>
          </View>
        )}

        {!loading &&
          visibleLevels.map((meta) => {
            const ids = perLevel?.[meta.key] ?? [];
            const total = ids.length;
            const levelProg = progress?.levels.find((l) => l.level === meta.key);
            const pct = Math.round(levelProg?.completionPct ?? 0);
            const status = levelProg?.status ?? 'NOT_STARTED';
            const statusLabel =
              status === 'COMPLETED' ? 'COMPLETE' : status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'NOT STARTED';
            const statusColor =
              status === 'COMPLETED'
                ? colors.score.green
                : status === 'IN_PROGRESS'
                  ? colors.brand[400]
                  : colors.text.muted;
            const progressColor = pct > 0 ? scoreColorForValue(pct) : colors.brand[400];
            const cta =
              status === 'COMPLETED' ? 'REVIEW' : status === 'IN_PROGRESS' ? 'CONTINUE' : 'BEGIN';

            return (
              <PressableGlow
                key={meta.key}
                onPress={() => openLevel(meta.key)}
                style={{ marginBottom: 16 }}
                glowColor={progressColor}
              >
                <Card tone={status === 'COMPLETED' ? 'success' : 'neutral'}>
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: `${progressColor}22` }}
                      >
                        <Ionicons name={meta.icon} size={20} color={progressColor} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-text-primary font-bold text-lg">{meta.title}</Text>
                        <Text className="text-text-secondary text-xs mt-0.5" numberOfLines={1}>
                          {meta.subtitle}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${statusColor}22` }}
                    >
                      <Text
                        className="text-[10px] font-bold tracking-widest"
                        style={{ color: statusColor }}
                      >
                        {statusLabel}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-text-muted text-[11px] tracking-widest">PROGRESS</Text>
                    <Text className="text-text-primary font-bold text-base">
                      {pct}
                      <Text className="text-text-secondary text-sm">%</Text>
                      <Text className="text-text-muted text-xs">  ·  {total} KPIs</Text>
                    </Text>
                  </View>

                  <View className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                    <View
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: progressColor,
                        borderRadius: 999,
                      }}
                    />
                  </View>

                  <View className="flex-row items-center justify-end mt-4">
                    <Text
                      className="font-bold tracking-widest text-xs mr-1"
                      style={{ color: progressColor }}
                    >
                      {cta}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={progressColor} />
                  </View>
                </Card>
              </PressableGlow>
            );
          })}

        <PressableGlow
          onPress={() => router.push('/(app)/scorecard')}
          style={{ alignSelf: 'center', marginTop: 16 }}
        >
        <View
          className="flex-row items-center px-5 py-3 rounded-full bg-bg-elevated border border-border-subtle"
        >
          <Ionicons name="document-text-outline" size={16} color={colors.brand[400]} />
          <Text className="text-text-primary font-bold tracking-widest ml-2 text-xs">
            VIEW FULL SCORECARD
          </Text>
        </View>
        </PressableGlow>
      </ScrollView>
    </Screen>
  );
}
