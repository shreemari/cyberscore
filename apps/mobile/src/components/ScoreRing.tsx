import { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, RadialGradient, G } from 'react-native-svg';
import { colors, scoreColorForValue } from '@/theme/colors';

interface ScoreRingProps {
  /** null = idle/empty state (dashed ring + orbit accents, no number). */
  score: number | null;
  size?: number;
  label?: string;
}

// Hero ring — dark, minimal, with a subtle "well" effect behind the ring and
// two sparkle stars slowly orbiting in opposite directions.
//
// Layers:
//   1. faint dark radial wash behind the ring (the "well" / depression)
//   2. dashed track ring
//   3. coloured arc (only when score exists)
//   4. centre number + label
//   5. two animated sparkle stars orbiting (counter-rotating)
export function ScoreRing({ score, size = 240, label }: ScoreRingProps) {
  const c = size / 2;
  const r = (size - 4) / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const colour = score == null ? colors.brand[400] : scoreColorForValue(score);
  const idle = score == null;

  // ─── Draw-in animation: arc fills + number counts up ───────────────────
  // Single Animated.Value that sweeps 0 → target pct over 1.4s with ease-out
  // cubic. The arc reads it via a listener (JS-driven; SVG strokeDasharray
  // can't go through the native driver). Number derives from the same value.
  const animPct = useRef(new Animated.Value(0)).current;
  const [renderedPct, setRenderedPct] = useState(0);

  useEffect(() => {
    if (idle) return;
    animPct.setValue(0);
    Animated.timing(animPct, {
      toValue: pct,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = animPct.addListener(({ value }) => setRenderedPct(value));
    return () => animPct.removeListener(id);
  }, [pct, idle, animPct]);

  const dash = (renderedPct / 100) * circumference;
  const displayNumber = Math.round(renderedPct);

  // ─── Orbiting indicator dots ───────────────────────────────────────────
  const cwSpin = useRef(new Animated.Value(0)).current;
  const ccwSpin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(cwSpin, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.timing(ccwSpin, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [cwSpin, ccwSpin]);

  const cwRotate = cwSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ccwRotate = ccwSpin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const PAD = 26; // room for the orbiting stars to sit just outside the ring
  const total = size + PAD * 2;

  return (
    <View
      style={{
        width: total,
        height: total,
        alignItems: 'center',
        justifyContent: 'center',
        ...(!idle && Platform.OS === 'ios'
          ? {
              shadowColor: colour,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 28,
            }
          : {}),
      }}
    >
      <Svg width={total} height={total}>
        <Defs>
          <LinearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colour} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.neon.cyan} stopOpacity="1" />
          </LinearGradient>
          {/* Dark "well" — slightly darker than bg in the centre, fades out */}
          <RadialGradient id="well" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.55" />
            <Stop offset="0.7" stopColor="#000000" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* 1. Dark well behind the ring */}
        <Circle cx={c + PAD} cy={c + PAD} r={r + 4} fill="url(#well)" />

        <G transform={`translate(${PAD}, ${PAD})`}>
          {/* 2. Dashed track */}
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1.2}
            strokeDasharray="2 6"
            fill="none"
          />

          {/* 3. Coloured arc */}
          {!idle && (
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke="url(#arc)"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${dash} ${circumference - dash}`}
              transform={`rotate(-90 ${c} ${c})`}
            />
          )}
        </G>
      </Svg>

      {/* 4. Centre overlay */}
      {!idle && (
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 9,
              letterSpacing: 3,
              fontWeight: '700',
              marginBottom: 4,
            }}
          >
            CYBER RESILIENCE
          </Text>
          <Text
            style={{
              color: '#ffffff',
              fontSize: 60,
              fontWeight: '800',
              letterSpacing: -1,
              lineHeight: 64,
              textShadowColor: `${colour}aa`,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 16,
            }}
          >
            {displayNumber}
            <Text
              style={{
                fontSize: 22,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: 0,
              }}
            >
              %
            </Text>
          </Text>
          {label && (
            <Text
              style={{
                marginTop: 4,
                color: 'rgba(255,255,255,0.42)',
                fontSize: 10,
                letterSpacing: 3,
                fontWeight: '700',
              }}
            >
              {label.toUpperCase()}
            </Text>
          )}
        </View>
      )}

      {/* 5. Orbiting indicator dots — bright cyan + muted, counter-rotating
             at different speeds. Restrained, no icons, no decoration. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: total,
          height: total,
          transform: [{ rotate: cwRotate }],
        }}
      >
        {/* Bright cyan dot with halo — sits on the ring edge */}
        <View
          style={{
            position: 'absolute',
            top: PAD - 6,
            left: total / 2 - 6,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.neon.cyan,
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: colors.neon.cyan,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: 8,
                }
              : {}),
          }}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: total,
          height: total,
          transform: [{ rotate: ccwRotate }],
        }}
      >
        {/* Muted dot — counter-rotating, no glow */}
        <View
          style={{
            position: 'absolute',
            bottom: PAD - 4,
            left: total / 2 - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.35)',
          }}
        />
      </Animated.View>
    </View>
  );
}
