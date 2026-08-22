import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space, type } from '../theme/tokens';

interface Props {
  label: string;
  onPress: () => void;
  /** 'apple' renders Apple's required black treatment; 'plain' is a white card. */
  tone: 'apple' | 'plain';
  glyph?: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
}

export const SocialButton: React.FC<Props> = ({ label, onPress, tone, glyph, busy, disabled }) => {
  const apple = tone === 'apple';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
      style={({ pressed }) => [
        s.base,
        apple ? s.apple : s.plain,
        pressed && s.pressed,
        (busy || disabled) && s.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={apple ? colors.white : colors.ink} />
      ) : (
        <View style={s.row}>
          {glyph}
          <Text style={[s.label, apple ? s.labelApple : s.labelPlain]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

/** Apple's mark, drawn rather than shipped as an image asset. */
export const AppleGlyph: React.FC<{ color?: string }> = ({ color = colors.white }) => (
  <Text style={{ color, fontSize: 18, marginTop: -3 }}></Text>
);

export const GoogleGlyph: React.FC = () => (
  <Text style={{ fontFamily: font.black, fontSize: 16, color: '#4285F4' }}>G</Text>
);

const s = StyleSheet.create({
  base: {
    borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: space.lg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  apple: { backgroundColor: colors.ink, borderColor: colors.ink },
  plain: { backgroundColor: colors.white, borderColor: colors.line },
  pressed: { opacity: 0.85, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: font.extrabold, fontSize: type.body },
  labelApple: { color: colors.white },
  labelPlain: { color: colors.ink },
});
