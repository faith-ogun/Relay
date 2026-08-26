import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, curve, font, radius, space, type } from '../../theme/tokens';

/**
 * Three ways into the bench.
 *
 * A segmented control rather than another row in the main tab bar: these are
 * three views of one activity, not three destinations. Putting them in the app's
 * bottom bar would say they are peers of Learn and Community, which they are not.
 */

export type SimTab = 'code' | 'circuit' | 'sandbox';

const LABELS: { key: SimTab; label: string; hint: string }[] = [
  { key: 'code', label: 'Code', hint: 'Write and run a sketch' },
  { key: 'circuit', label: 'Circuit', hint: 'Solve a circuit live' },
  { key: 'sandbox', label: 'Sandbox', hint: 'Build on a breadboard' },
];

export const SimTabs: React.FC<{ value: SimTab; onChange: (t: SimTab) => void }> = ({ value, onChange }) => (
  <View style={s.bar}>
    {LABELS.map((t) => {
      const on = t.key === value;
      return (
        <Pressable
          key={t.key}
          onPress={() => {
            if (on) return;
            void Haptics.selectionAsync();
            onChange(t.key);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: on }}
          accessibilityHint={t.hint}
          style={({ pressed }) => [s.seg, on && s.segOn, pressed && !on && s.segPressed]}
        >
          <Text style={[s.label, on && s.labelOn]}>{t.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', gap: 4,
    margin: space.lg, marginBottom: 0, padding: 4,
    backgroundColor: colors.inkFaint, borderRadius: radius.md, ...curve,
  },
  seg: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: radius.sm, ...curve,
  },
  segOn: { backgroundColor: colors.white },
  segPressed: { backgroundColor: 'rgba(255,255,255,0.5)' },
  label: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  labelOn: { color: colors.ink },
});
