import { Pressable, Text, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'accent';
type Size = 'md' | 'lg';

interface ButtonProps {
  onPress?: () => void;
  label: string;
  /**
   * primary  — flat blue fill (most CTAs: Create Account, Download PDF)
   * accent   — gradient-border transparent pill (Resume Assessment hero CTA)
   * secondary — frosted glass pill (Share with Board, Pause & Save)
   * outline  — thin neon cyan ring (legacy; prefer `secondary`)
   * ghost    — text-only
   */
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  className?: string;
}

export function Button({
  onPress,
  label,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  icon,
  iconRight,
  className = '',
}: ButtonProps) {
  const heightCls = size === 'lg' ? 'h-14' : 'h-12';
  const textSize = size === 'lg' ? 14 : 13;

  const labelColor =
    variant === 'primary'
      ? '#fff'
      : variant === 'outline'
        ? colors.neon.cyan
        : variant === 'accent'
          ? '#fff'
          : colors.text.primary;

  const iconColor = labelColor;

  // The `loading` prop still gates double-taps via the Pressable below
  // (disabled={disabled || loading}), but we deliberately do not render a
  // spinner inside the button anymore. The user sees the same label they
  // tapped, the tap is registered, and the screen transition happens as
  // soon as the underlying work finishes. Feels snappier on demo screens
  // where the API call is sub-second.
  const inner = (
    <View className={`flex-row items-center justify-center ${heightCls} px-5`}>
      {icon && (
        <Ionicons name={icon} size={18} color={iconColor} style={{ marginRight: 8 }} />
      )}
      <Text
        style={{
          color: labelColor,
          fontSize: textSize,
          fontWeight: '700',
          letterSpacing: 1.8,
        }}
      >
        {label.toUpperCase()}
      </Text>
      {iconRight && (
        <Ionicons name={iconRight} size={18} color={iconColor} style={{ marginLeft: 8 }} />
      )}
    </View>
  );

  const baseShadow =
    variant === 'primary'
      ? {
          shadowColor: colors.brand[500],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0,
          shadowRadius: 14,
          elevation: 5,
        }
      : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-2xl overflow-hidden ${disabled ? 'opacity-40' : ''} ${className}`}
      style={baseShadow}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
    >
      {variant === 'primary' ? (
        <View style={{ backgroundColor: colors.brand[500] }}>
          {/* Subtle inner highlight — fakes the soft sheen on glass buttons */}
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%' }}
            pointerEvents="none"
          />
          {inner}
        </View>
      ) : variant === 'accent' ? (
        // Gradient-border transparent pill — used for the hero CTA on dashboard.
        <View style={{ borderRadius: 18, padding: 1.25 }}>
          <LinearGradient
            colors={[colors.neon.cyan, colors.neon.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 18, padding: 1.25 }}
          >
            <BlurView
              intensity={24}
              tint="dark"
              style={{
                borderRadius: 17,
                backgroundColor: 'rgba(10,14,26,0.6)',
              }}
            >
              {inner}
            </BlurView>
          </LinearGradient>
        </View>
      ) : variant === 'outline' ? (
        <View
          className="rounded-2xl"
          style={{
            borderWidth: 1,
            borderColor: colors.neon.cyan,
            backgroundColor: 'rgba(34,211,238,0.05)',
          }}
        >
          {inner}
        </View>
      ) : variant === 'secondary' ? (
        <View
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            borderTopColor: 'rgba(255,255,255,0.2)',
            backgroundColor: 'rgba(255,255,255,0.04)',
          }}
        >
          <BlurView intensity={18} tint="dark">
            {inner}
          </BlurView>
        </View>
      ) : (
        <View>{inner}</View>
      )}
    </Pressable>
  );
}
