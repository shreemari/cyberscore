import { useRef } from 'react';
import { Animated, Pressable, Platform, type PressableProps, type ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';

interface PressableGlowProps extends PressableProps {
  children: React.ReactNode;
  glowColor?: string;
  style?: ViewStyle;
  /** Press-down scale. Lower = more exaggerated. */
  scaleTo?: number;
}

// Wraps children in an animated Pressable that dips & glows on touch.
// Gives interactive surfaces a 3D "lift" without hijacking layout.
//
// Split into two nested Animated.Views because React Native refuses to mix
// native-driven and JS-driven animations on the *same* node — the outer view
// animates shadow props (JS-driven, since shadows aren't native-drivable),
// the inner view animates transform (native-driven for 60fps).
export function PressableGlow({
  children,
  glowColor = colors.brand[400],
  scaleTo = 0.97,
  style,
  ...rest
}: PressableGlowProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const onIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
    Animated.timing(glow, {
      toValue: 1,
      duration: 140,
      useNativeDriver: false,
    }).start();
  };

  const onOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
    Animated.timing(glow, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const shadowOpacity =
    Platform.OS === 'ios'
      ? glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] })
      : 0;
  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [6, 18] });

  return (
    <Animated.View
      style={[
        {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity,
          shadowRadius,
        },
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable onPressIn={onIn} onPressOut={onOut} {...rest}>
          {children}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
