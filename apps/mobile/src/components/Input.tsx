import { forwardRef, useRef, useState } from 'react';
import { TextInput, View, Text, Pressable, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  labelRight?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  rightSlot?: React.ReactNode;
}

// Glass input. Idle = faint white border + top glint.
//
// IMPORTANT: we do NOT re-render on focus. Under React Native's new
// architecture (Bridgeless mode — always on in Expo Go), toggling styles
// on the TextInput's wrapping View when focus fires causes the native view
// tree to reshuffle and drops focus — you see the keyboard flash for a
// frame and vanish. Focus styling is applied imperatively via setNativeProps
// on refs so the JS tree stays stable. See auth-flow debugging thread.
export const Input = forwardRef<TextInput, InputProps>(
  ({ label, labelRight, error, icon, secure, rightSlot, onFocus, onBlur, ...rest }, ref) => {
    const [reveal, setReveal] = useState(false);
    const showEye = secure && !rightSlot;

    const wrapRef = useRef<View>(null);

    const idleBorder = error ? colors.score.red : 'rgba(255,255,255,0.08)';
    const idleBorderTop = error ? colors.score.red : 'rgba(255,255,255,0.14)';
    const focusBorder = error ? colors.score.red : colors.brand[500];
    const focusBorderTop = error ? colors.score.red : colors.brand[400];

    const applyFocus = (on: boolean) => {
      // setNativeProps bypasses React's reconciler — no re-render, no focus drop.
      // (Icon color stays static — Ionicons doesn't expose setNativeProps and
      // re-rendering to animate it would reintroduce the Bridgeless blur bug.)
      wrapRef.current?.setNativeProps({
        style: {
          borderColor: on ? focusBorder : idleBorder,
          borderTopColor: on ? focusBorderTop : idleBorderTop,
        },
      });
    };

    return (
      <View className="gap-2">
        {label && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              className="text-text-secondary font-semibold"
              style={{ fontSize: 11, letterSpacing: 2 }}
            >
              {label.toUpperCase()}
            </Text>
            {labelRight && (
              <Text style={{ color: colors.text.muted, fontSize: 10, letterSpacing: 1 }}>
                {labelRight}
              </Text>
            )}
          </View>
        )}
        <View
          ref={wrapRef}
          className="flex-row items-center rounded-2xl px-4 h-14"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderColor: idleBorder,
            borderTopColor: idleBorderTop,
          }}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={colors.text.secondary}
              style={{ marginRight: 10 }}
            />
          )}
          <TextInput
            ref={ref}
            {...rest}
            onFocus={(e) => {
              applyFocus(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              applyFocus(false);
              onBlur?.(e);
            }}
            secureTextEntry={secure && !reveal}
            placeholderTextColor={colors.text.muted}
            selectionColor={colors.brand[400]}
            style={{ flex: 1, color: colors.text.primary, fontSize: 15 }}
            autoCapitalize={rest.autoCapitalize ?? 'none'}
            autoCorrect={false}
          />
          {showEye && (
            <Pressable onPress={() => setReveal((v) => !v)} hitSlop={8}>
              <Ionicons
                name={reveal ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={colors.text.secondary}
              />
            </Pressable>
          )}
          {rightSlot}
        </View>
        {error && <Text className="text-score-red text-xs">{error}</Text>}
      </View>
    );
  },
);
Input.displayName = 'Input';
