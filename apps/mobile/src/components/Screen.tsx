import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

interface ScreenProps extends ViewProps {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /**
   * Adds a single soft blue→violet wash with a slow breathing pulse. One
   * glow per screen is the rule — anything more competes with content and
   * breaks the restrained glass look.
   */
  glow?: boolean;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Shared shell. Dark base with an optional slow-breathing gradient wash at
// the top — opacity drifts between 0.7 and 1.0 over ~6s, easing in/out, so
// the screen feels alive without distracting.
export function Screen({
  children,
  edges = ['top', 'bottom'],
  glow,
  style,
  ...rest
}: ScreenProps) {
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!glow) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [glow, breath]);

  const opacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  return (
    <View className="flex-1 bg-bg-base">
      <StatusBar style="light" />
      {glow && (
        <AnimatedLinearGradient
          colors={['rgba(59,130,246,0.18)', 'rgba(168,85,247,0.08)', 'transparent']}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.85 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 520,
            opacity,
          }}
          pointerEvents="none"
        />
      )}
      <SafeAreaView edges={edges} style={[{ flex: 1 }, style]} {...rest}>
        {children}
      </SafeAreaView>
    </View>
  );
}
