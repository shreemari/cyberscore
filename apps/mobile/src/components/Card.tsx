import { View, StyleSheet, type ViewProps, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';

// Card — frosted glass surface. Two layers do the heavy lifting:
//   1. optional tonal gradient wash behind the card (colour bleed for
//      People/Process/Company cards on the dashboard)
//   2. BlurView that frosts whatever's behind it (works on top of the
//      Screen gradient or a photo background)
// Borders are intentionally low-contrast white; the top edge gets a slightly
// brighter glint so the card reads as lit from above (classic glass trick).
// `selected` is reserved for KPI answer states — gets a soft green halo.
interface CardProps extends ViewProps {
  selected?: boolean;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand';
  /**
   * Soft tonal shadow + a very faint radial wash behind the card. Used for
   * the dashboard tiles where each category gets its own accent bleed.
   */
  glow?: boolean;
  /**
   * When false, skips the BlurView wrapper. Use for nested cards or screens
   * where we already have a blur underneath and don't want compounding.
   */
  blur?: boolean;
  intensity?: number;
}

const TONE_GLOW: Record<NonNullable<CardProps['tone']>, string | null> = {
  neutral: null,
  brand: colors.brand[500],
  success: colors.score.green,
  warning: colors.score.amber,
  danger: colors.score.red,
};

export function Card({
  selected,
  tone = 'neutral',
  glow,
  blur = true,
  intensity = 24,
  className = '',
  children,
  style,
  ...rest
}: CardProps) {
  const toneColor = TONE_GLOW[tone];

  // Selected state — subtle green halo + slightly brighter border. No
  // gradient frame; the reference shows the selected KPI option with a clean
  // glow, not a neon frame.
  const borderColor = selected
    ? 'rgba(16,185,129,0.55)'
    : toneColor
      ? `${toneColor}33`
      : 'rgba(255,255,255,0.06)';

  const shadow =
    glow && toneColor
      ? {
          shadowColor: toneColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: Platform.OS === 'ios' ? 0.22 : 0,
          shadowRadius: 18,
          elevation: 6,
        }
      : selected
        ? {
            shadowColor: colors.score.green,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0,
            shadowRadius: 14,
            elevation: 5,
          }
        : undefined;

  const content = (
    <View className={`p-5 ${className}`} {...rest}>
      {children}
    </View>
  );

  return (
    <View
      style={[
        {
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1,
          borderColor,
          // Fake a top-light glint — marginally brighter border on top only.
          borderTopColor: selected ? 'rgba(16,185,129,0.7)' : 'rgba(255,255,255,0.12)',
        },
        shadow,
        style,
      ]}
    >
      {/* Tonal wash behind the blur — creates the "colour bleed" look without
          saturating the whole card. Only renders when tone + glow are set. */}
      {glow && toneColor && (
        <LinearGradient
          colors={[`${toneColor}26`, 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {blur ? (
        <BlurView intensity={intensity} tint="dark" style={{ borderRadius: 20 }}>
          {content}
        </BlurView>
      ) : (
        content
      )}
    </View>
  );
}
