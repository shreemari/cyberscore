import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors, neonShadow } from '@/theme/colors';

const SLIDES = [
  {
    icon: 'shield-checkmark' as const,
    title: 'Security Scans',
    body: 'Detect vulnerabilities before they become threats.',
  },
  {
    icon: 'analytics' as const,
    title: 'Live Scorecard',
    body: 'People, Process and Company health tracked against 46 KPIs.',
  },
  {
    icon: 'sparkles' as const,
    title: 'AI Insights',
    body: 'Claude-powered benchmarking against your industry peers.',
  },
];

// Onboarding carousel — neon diamond badge with gradient frame + inner glow,
// 3-slide value prop, Next/Skip.
export default function Onboarding() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i]!;

  const next = () => {
    if (i < SLIDES.length - 1) setI(i + 1);
    else router.replace('/(auth)/login');
  };

  return (
    <Screen glow>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        <View
          className="w-full bg-bg-card rounded-3xl p-8 items-center"
          style={{
            borderWidth: 1,
            borderColor: 'rgba(34,211,238,0.25)',
            ...neonShadow(colors.neon.cyan, 0.25, 32),
          }}
        >
          {/* Diamond badge — gradient frame rotated 45°, icon counter-rotated */}
          <View style={{ marginBottom: 32 }}>
            <LinearGradient
              colors={['#22d3ee', '#a855f7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 96,
                height: 96,
                transform: [{ rotate: '45deg' }],
                borderRadius: 22,
                padding: 1.5,
                ...neonShadow(colors.neon.cyan, 0.8, 26),
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.bg.elevated,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View style={{ transform: [{ rotate: '-45deg' }] }}>
                  <Ionicons name={slide.icon} size={42} color={colors.neon.cyan} />
                </View>
              </View>
            </LinearGradient>
          </View>

          <Text
            style={{
              color: '#f9fafb',
              fontSize: 26,
              fontWeight: '800',
              letterSpacing: 0.5,
              textShadowColor: 'rgba(34,211,238,0.35)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 14,
            }}
          >
            {slide.title}
          </Text>
          <Text className="text-text-secondary text-center mt-2 leading-5 px-2">{slide.body}</Text>

          <View className="flex-row gap-1.5 mt-6 mb-6">
            {SLIDES.map((_, idx) => (
              <View
                key={idx}
                style={{
                  width: idx === i ? 26 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: idx === i ? colors.neon.cyan : colors.border.muted,
                }}
              />
            ))}
          </View>
          <Button label="Next" onPress={next} className="w-full" iconRight="arrow-forward" />
          <Pressable onPress={() => router.replace('/(auth)/login')} className="mt-4" hitSlop={8}>
            <Text className="text-text-muted" style={{ letterSpacing: 2, fontSize: 11 }}>
              SKIP
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
