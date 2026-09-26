import { View, Text, Pressable } from 'react-native';
import { colors } from '@/theme/colors';

interface Segment<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (key: T) => void;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        padding: 4,
      }}
    >
      {segments.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onChange(seg.key)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: active ? colors.brand[500] : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.5,
                color: active ? '#ffffff' : colors.text.secondary,
              }}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
