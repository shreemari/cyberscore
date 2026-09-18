import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Stacked brandmark for auth screens. A glowing rounded-square emblem with
// a pulse / analytics icon inside, above the CyMetric wordmark with the
// 'Cy' prefix in neon cyan and 'Metric' in soft white. The tagline reads
// SECURE ACCESS PROTOCOL.
//
// Visual language: glassmorphism + neon cyan accents that match the rest
// of the auth flow. The emblem uses three layered rings (halo, rotated
// frame, inner card) plus four corner-bracket accents to evoke a HUD.
export function BrandLogo() {
  return (
    <View pointerEvents="none" style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 88,
          height: 88,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        {/* Outer halo */}
        <View
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(34,211,238,0.08)',
          }}
        />
        {/* Middle ring */}
        <View
          style={{
            position: 'absolute',
            width: 96,
            height: 96,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(34,211,238,0.25)',
            transform: [{ rotate: '45deg' }],
          }}
        />
        {/* Inner emblem */}
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: 'rgba(12,22,38,0.9)',
            borderWidth: 1.5,
            borderColor: 'rgba(34,211,238,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: '#22d3ee',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 24,
                }
              : { elevation: 12 }),
          }}
        >
          {/* pulse-rate icon: a heartbeat / metric line inside a shield
              shape. Reads simultaneously as security (shield) and
              measurement (pulse line), which is exactly what the product
              does. Stroke colour matches the cyan accent ring. */}
          <Ionicons name="pulse" size={38} color="#22d3ee" />
        </View>
        {/* Corner accents */}
        <View style={corner(0, 0, true, true)} />
        <View style={corner(0, undefined, true, false)} />
        <View style={corner(undefined, 0, false, true)} />
        <View style={corner(undefined, undefined, false, false)} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={{
            fontSize: 44,
            fontWeight: '900',
            letterSpacing: 1,
            color: '#22d3ee',
            textShadowColor: 'rgba(34,211,238,0.9)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 18,
          }}
        >
          Cy
        </Text>
        <Text
          style={{
            fontSize: 44,
            fontWeight: '900',
            letterSpacing: 1,
            color: '#e0f2fe',
            textShadowColor: 'rgba(34,211,238,0.6)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 18,
          }}
        >
          Metric
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
        <View style={{ width: 20, height: 1, backgroundColor: 'rgba(34,211,238,0.5)' }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22d3ee' }} />
        <Text
          style={{
            color: 'rgba(226,232,240,0.7)',
            letterSpacing: 3,
            fontSize: 11,
            fontWeight: '600',
          }}
        >
          SECURE ACCESS PROTOCOL
        </Text>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22d3ee' }} />
        <View style={{ width: 20, height: 1, backgroundColor: 'rgba(34,211,238,0.5)' }} />
      </View>
    </View>
  );
}

function corner(top: number | undefined, left: number | undefined, isTop: boolean, isLeft: boolean) {
  return {
    position: 'absolute' as const,
    width: 10,
    height: 10,
    top: isTop ? 4 : undefined,
    bottom: !isTop ? 4 : undefined,
    left: isLeft ? 4 : undefined,
    right: !isLeft ? 4 : undefined,
    borderColor: '#22d3ee',
    borderTopWidth: isTop ? 1.5 : 0,
    borderBottomWidth: !isTop ? 1.5 : 0,
    borderLeftWidth: isLeft ? 1.5 : 0,
    borderRightWidth: !isLeft ? 1.5 : 0,
  };
}
