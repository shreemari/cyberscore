import { useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, Platform, Animated, Easing } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Level, OrgMode, Role } from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { ScoreRing } from '@/components/ScoreRing';
import { Card } from '@/components/Card';
import { PressableGlow } from '@/components/PressableGlow';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { colors, scoreColorForValue } from '@/theme/colors';

export default function Dashboard() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.me);
  const isEnterprise = me?.org.mode === OrgMode.ENTERPRISE;
  const isAdmin = me?.user.role === Role.ADMIN;
  const showTeamRollup = isEnterprise && isAdmin;

  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ['scorecard'],
    queryFn: () => api.scorecard.current(),
  });
  const { data: progress } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.progress.get(),
  });
  // Admin-only: aggregated team scorecard + member count.
  const { data: teamScorecard } = useQuery({
    queryKey: ['admin', 'scorecard'],
    queryFn: () => api.team.scorecard(),
    enabled: showTeamRollup,
  });

  const onRefresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['scorecard'] }),
      qc.invalidateQueries({ queryKey: ['progress'] }),
      ...(showTeamRollup
        ? [qc.invalidateQueries({ queryKey: ['admin', 'scorecard'] })]
        : []),
    ]);
  }, [qc, showTeamRollup]);

  const overall = data?.overallScore ?? null;
  const people = data?.levelBreakdown?.people;
  const proc = data?.levelBreakdown?.process;
  const company = data?.levelBreakdown?.company;

  const allowedLevels = new Set<Level>(
    me?.user.allowedLevels ?? [Level.PEOPLE, Level.PROCESS, Level.COMPANY],
  );
  const showPeople = allowedLevels.has(Level.PEOPLE);
  const showProcess = allowedLevels.has(Level.PROCESS);
  const showCompany = allowedLevels.has(Level.COMPANY);

  const resumeTarget = progress?.levels.find((p) => p.status === 'IN_PROGRESS');
  const ctaLabel = resumeTarget
    ? 'RESUME ASSESSMENT'
    : overall == null
      ? 'START ASSESSMENT'
      : 'CONTINUE ASSESSMENT';

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
        {/* Admin-only team rollup banner. Sits above the score ring so the
            admin lands on the company picture first; their personal score
            ring stays underneath as a per-user breakdown. */}
        {showTeamRollup && (
          <TeamRollupBanner
            orgName={me!.org.orgName}
            memberCount={teamScorecard?.memberCount ?? null}
            activeAnswerers={teamScorecard?.activeAnswerers ?? null}
            overallScore={teamScorecard?.overallScore ?? null}
            consensusFlagCount={teamScorecard?.consensusSignals.length ?? 0}
            onPressManage={() => router.push('/(app)/team')}
          />
        )}

        {/* Hero score ring */}
        <View className="items-center mt-4 mb-2">
          <ScoreRing score={overall} label={overall == null ? 'No score yet' : 'Overall'} />

          {overall != null && (
            <Text
              style={{
                color: colors.text.muted,
                textAlign: 'center',
                marginTop: 18,
                paddingHorizontal: 24,
                lineHeight: 19,
                fontSize: 12,
              }}
            >
              System integrity within optimal parameters.{' '}
              {Math.round(data?.completeness ?? 0)}% complete.
            </Text>
          )}
        </View>

        {/* People + Process tiles (side by side, gated by allowedLevels) */}
        {(showPeople || showProcess) && (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12, marginTop: 8 }}>
            {showPeople && (
              <LevelTile
                title="People"
                score={people?.score ?? null}
                tone="brand"
                onPress={() => router.push('/(app)/assessment')}
              />
            )}
            {showProcess && (
              <LevelTile
                title="Process"
                score={proc?.score ?? null}
                tone="warning"
                onPress={() => router.push('/(app)/assessment')}
              />
            )}
          </View>
        )}

        {/* Company card — full width, gated */}
        {showCompany && (
        <PressableGlow
          onPress={() => router.push('/(app)/assessment')}
          glowColor={colors.score.green}
        >
          <Card tone="success" glow>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: `${colors.score.green}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <Ionicons name="business" size={16} color={colors.score.green} />
                </View>
                <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 16 }}>
                  Company
                </Text>
              </View>
              {/* SECURE pill */}
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: `${colors.score.green}18`,
                  borderWidth: 1,
                  borderColor: `${colors.score.green}44`,
                }}
              >
                <Text
                  style={{
                    color: colors.score.green,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 2,
                  }}
                >
                  {company?.colorBand ?? 'PENDING'}
                </Text>
              </View>
            </View>

            {/* Inline stats */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <CompanyStat label="ANSWERED" value={String(company?.answered ?? 0)} />
              <CompanyStat label="TOTAL KPIS" value={String(company?.total ?? 0)} />
              <CompanyStat
                label="SCORE"
                value={company?.score != null ? `${Math.round(company.score)}%` : '—'}
              />
            </View>
          </Card>
        </PressableGlow>
        )}

        {/* Resume Assessment CTA */}
        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <PressableGlow
            onPress={() => router.push('/(app)/assessment')}
            glowColor={colors.brand[400]}
          >
            <ResumeButton label={ctaLabel} />
          </PressableGlow>
        </View>

        {isLoading && (
          <Text style={{ color: colors.text.muted, textAlign: 'center', marginTop: 40 }}>
            Loading scorecard…
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

type TileCardTone = 'brand' | 'warning' | 'success';

function LevelTile({
  title,
  score,
  tone,
  onPress,
}: {
  title: string;
  score: number | null;
  tone: TileCardTone;
  onPress: () => void;
}) {
  const toneColors: Record<TileCardTone, string> = {
    brand: colors.brand[400],
    warning: colors.score.amber,
    success: colors.score.green,
  };
  const accent = toneColors[tone];

  return (
    <PressableGlow onPress={onPress} style={{ flex: 1 }} glowColor={accent}>
      <Card tone={tone} glow>
        <Text
          style={{
            color: colors.text.muted,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: '700',
            marginBottom: 6,
          }}
        >
          {title.toUpperCase()}
        </Text>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: 38,
            fontWeight: '800',
            lineHeight: 44,
            ...(Platform.OS === 'ios'
              ? {
                  textShadowColor: `${accent}44`,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 10,
                }
              : {}),
          }}
        >
          {score == null ? '—' : Math.round(score)}
          {score != null && (
            <Text style={{ color: colors.text.secondary, fontSize: 18, fontWeight: '600' }}>%</Text>
          )}
        </Text>
        {/* Progress bar — animates from 0 to score% on mount */}
        <AnimatedProgressBar value={score ?? 0} accent={accent} />
      </Card>
    </PressableGlow>
  );
}

// ─── Animated progress bar with a slow sheen sweep ───────────────────────
function AnimatedProgressBar({ value, accent }: { value: number; accent: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: value,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, widthAnim]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1800),
      ]),
    ).start();
  }, [sheen]);

  const widthStyle = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Sheen translates across the visible portion
  const sheenTranslate = sheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 200],
  });

  return (
    <View
      style={{
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 999,
        marginTop: 10,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: widthStyle,
          height: '100%',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[accent, `${accent}88`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 999 }}
        />
        {/* Sheen sweep */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 30,
            transform: [{ translateX: sheenTranslate }, { skewX: '-20deg' }],
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── RESUME button with a sheen sweep across its inner surface ──────────
function ResumeButton({ label }: { label: string }) {
  const sheen = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
      ]),
    ).start();
  }, [sheen]);

  const sheenX = sheen.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 260],
  });

  return (
    <LinearGradient
      colors={['rgba(96,165,250,0.5)', 'rgba(59,130,246,0.5)', 'rgba(168,85,247,0.5)']}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 999, padding: 1.5 }}
    >
      <View
        style={{
          backgroundColor: colors.bg.base,
          borderRadius: 999,
          paddingHorizontal: 28,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <Ionicons name="play-circle-outline" size={20} color={colors.brand[400]} />
        <Text
          style={{
            color: colors.text.primary,
            fontWeight: '800',
            marginLeft: 10,
            letterSpacing: 2,
            fontSize: 12,
          }}
        >
          {label}
        </Text>
        {/* Sheen */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 50,
            transform: [{ translateX: sheenX }, { skewX: '-20deg' }],
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

// Admin-only banner rendered at the top of the dashboard for ENTERPRISE
// orgs. Surfaces the company-wide score, member count, and a count of
// consensus flags (KPIs where employees disagree with the admin's
// authoritative answer). Tapping anywhere routes to the team screen.
function TeamRollupBanner({
  orgName,
  memberCount,
  activeAnswerers,
  overallScore,
  consensusFlagCount,
  onPressManage,
}: {
  orgName: string;
  memberCount: number | null;
  activeAnswerers: number | null;
  overallScore: number | null;
  consensusFlagCount: number;
  onPressManage: () => void;
}) {
  const accent = colors.brand[400];
  const scoreLabel =
    overallScore == null ? '—' : `${Math.round(overallScore)}%`;

  return (
    <PressableGlow onPress={onPressManage} glowColor={accent}>
      <Card tone="brand" glow blur intensity={20}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: `${accent}22`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="people" size={18} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text.muted,
                  fontSize: 9,
                  letterSpacing: 2,
                  fontWeight: '700',
                }}
              >
                COMPANY ROLLUP
              </Text>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: 16,
                  fontWeight: '800',
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {orgName}
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: `${accent}1f`,
              borderWidth: 1,
              borderColor: `${accent}55`,
            }}
          >
            <Text style={{ color: accent, fontWeight: '800', fontSize: 11, letterSpacing: 1.5 }}>
              MANAGE
            </Text>
            <Ionicons name="arrow-forward" size={12} color={accent} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <RollupStat label="TEAM SCORE" value={scoreLabel} accent={accent} />
          <RollupStat
            label="MEMBERS"
            value={memberCount == null ? '—' : `${activeAnswerers ?? 0}/${memberCount}`}
            sub="active"
          />
          <RollupStat
            label="CONSENSUS"
            value={String(consensusFlagCount)}
            sub={consensusFlagCount === 0 ? 'aligned' : 'flags'}
            accent={consensusFlagCount > 0 ? colors.score.amber : undefined}
          />
        </View>
      </Card>
    </PressableGlow>
  );
}

function RollupStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <View>
      <Text
        style={{
          color: colors.text.muted,
          fontSize: 9,
          letterSpacing: 2,
          fontWeight: '700',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: accent ?? colors.text.primary,
          fontWeight: '800',
          fontSize: 18,
        }}
      >
        {value}
      </Text>
      {sub && (
        <Text style={{ color: colors.text.muted, fontSize: 10, marginTop: 2 }}>{sub}</Text>
      )}
    </View>
  );
}

function CompanyStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text
        style={{
          color: colors.text.muted,
          fontSize: 9,
          letterSpacing: 2,
          fontWeight: '700',
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: colors.text.primary, fontWeight: '800', fontSize: 20 }}>{value}</Text>
    </View>
  );
}
