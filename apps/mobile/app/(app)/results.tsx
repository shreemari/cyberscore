import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { api } from '@/lib/api';
import { colors, scoreColorForValue } from '@/theme/colors';

// Assessment Complete — big score cards for People / Process / Company,
// download PDF + share CTA. Navigated to when the user finishes a KPI level.
export default function Results() {
  const { data } = useQuery({
    queryKey: ['scorecard'],
    queryFn: () => api.scorecard.current(),
  });

  const people = data?.levelBreakdown?.people;
  const proc = data?.levelBreakdown?.process;
  const company = data?.levelBreakdown?.company;

  return (
    <Screen glow>
      {/* Header with back button */}
      <View
        style={{
          paddingTop: 56,
          paddingHorizontal: 20,
          paddingBottom: 4,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => router.replace('/(app)/dashboard')}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
        </Pressable>
        <Text
          style={{
            marginLeft: 12,
            color: colors.text.secondary,
            fontSize: 13,
            fontWeight: '600',
            letterSpacing: 1.5,
          }}
        >
          DASHBOARD
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 8, paddingBottom: 140 }}
        showsVerticalScrollIndicator
        alwaysBounceVertical
      >
        {/* Green checkmark bloom */}
        <View className="items-center mt-4 mb-6">
          <View style={{ position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
            {/* Radial green bloom */}
            <View
              style={{
                position: 'absolute',
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: `${colors.score.green}18`,
              }}
            />
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: `${colors.score.green}22`,
                borderWidth: 2,
                borderColor: `${colors.score.green}66`,
                alignItems: 'center',
                justifyContent: 'center',
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: colors.score.green,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.6,
                      shadowRadius: 24,
                    }
                  : { elevation: 8 }),
              }}
            >
              <Ionicons name="checkmark" size={40} color={colors.score.green} />
            </View>
          </View>

          <Text
            style={{
              color: colors.text.primary,
              fontSize: 28,
              fontWeight: '800',
              marginTop: 20,
              textAlign: 'center',
            }}
          >
            Assessment Complete
          </Text>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: 14,
              textAlign: 'center',
              marginTop: 8,
              lineHeight: 20,
              paddingHorizontal: 16,
            }}
          >
            Your systems have been analyzed. Here is your organizational cyber resilience breakdown.
          </Text>
        </View>

        {/* Category score cards */}
        <View style={{ gap: 12, marginBottom: 32 }}>
          <ScoreCard
            label="PEOPLE"
            score={people?.score ?? null}
            delta={null}
            tone="brand"
          />
          <ScoreCard
            label="PROCESS"
            score={proc?.score ?? null}
            delta={null}
            tone="warning"
          />
          <ScoreCard
            label="COMPANY"
            score={company?.score ?? null}
            delta={null}
            tone="success"
          />
        </View>

        {/* CTAs */}
        <View style={{ gap: 12 }}>
          <Button
            label="Download Executive PDF"
            icon="document-text"
            onPress={() => {
              // PDF generation — to be wired up to API endpoint
            }}
          />
          <Button
            variant="outline"
            label="Share with Board"
            icon="share-social"
            onPress={() => {
              // Share flow
            }}
          />
        </View>

        <Text
          style={{
            color: colors.text.muted,
            fontSize: 11,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          🔒 Generates a secure, 24-hour restricted link
        </Text>

        <Pressable
          onPress={() => router.replace('/(app)/dashboard')}
          style={{ marginTop: 24, alignItems: 'center' }}
        >
          <Text style={{ color: colors.brand[400], fontSize: 13, fontWeight: '600' }}>
            Back to Dashboard
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function ScoreCard({
  label,
  score,
  delta,
  tone,
}: {
  label: string;
  score: number | null;
  delta: number | null;
  tone: 'brand' | 'warning' | 'success';
}) {
  const toneColors = {
    brand: colors.brand[400],
    warning: colors.score.amber,
    success: colors.score.green,
  };
  const accent = toneColors[tone];
  const scoreVal = score != null ? Math.round(score) : null;
  const deltaPositive = delta != null && delta >= 0;

  return (
    <Card tone={tone} glow blur intensity={20}>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text
          style={{
            color: colors.text.muted,
            fontSize: 10,
            letterSpacing: 3,
            fontWeight: '700',
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: 72,
            fontWeight: '800',
            lineHeight: 80,
            ...(Platform.OS === 'ios'
              ? {
                  textShadowColor: `${accent}55`,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 20,
                }
              : {}),
          }}
        >
          {scoreVal ?? '—'}
        </Text>
        {delta != null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: deltaPositive ? `${colors.score.green}22` : `${colors.score.amber}22`,
            }}
          >
            <Ionicons
              name={deltaPositive ? 'arrow-up' : 'alert-circle-outline'}
              size={12}
              color={deltaPositive ? colors.score.green : colors.score.amber}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                marginLeft: 4,
                color: deltaPositive ? colors.score.green : colors.score.amber,
              }}
            >
              {deltaPositive ? `+${delta}% vs last` : 'Needs Focus'}
            </Text>
          </View>
        ) : (
          <View
            style={{
              marginTop: 4,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: `${accent}15`,
              borderWidth: 1,
              borderColor: `${accent}33`,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: accent }}>
              {scoreVal == null ? 'PENDING' : scoreVal >= 75 ? 'GOOD' : scoreVal >= 50 ? 'FAIR' : 'NEEDS FOCUS'}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}
