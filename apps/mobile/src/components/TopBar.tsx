import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme/colors';

interface TopBarProps {
  title?: string;
  /** @deprecated bell is removed app-wide */
  showBell?: boolean;
  showAvatar?: boolean;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
}

// Glass wordmark header. Italic brand-blue CYMETRIC (matches the reference
// mocks). Left slot takes either a back chevron or a circular avatar chip
// (the avatar navigates to /profile). Right slot is reserved for caller-
// supplied controls. No bell, no glow — restraint beats pyrotechnics.
export function TopBar({ title, showAvatar, showBack, rightSlot }: TopBarProps) {
  return (
    <View className="flex-row items-center justify-between px-5 py-3">
      <View className="flex-row items-center flex-1">
        {showBack ? (
          <Pressable onPress={() => router.back()} hitSlop={10} className="mr-3">
            <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
          </Pressable>
        ) : showAvatar ? (
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            hitSlop={8}
            className="h-9 w-9 rounded-full items-center justify-center mr-3"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              borderTopColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <Ionicons name="person" size={16} color={colors.text.primary} />
          </Pressable>
        ) : null}
        <Text
          style={{
            color: colors.brand[400],
            fontWeight: '800',
            letterSpacing: 2,
            fontStyle: 'italic',
            fontSize: 18,
          }}
        >
          {title ?? 'CYMETRIC'}
        </Text>
      </View>
      {rightSlot && <View className="flex-row items-center gap-3">{rightSlot}</View>}
    </View>
  );
}
