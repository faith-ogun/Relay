import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, font } from '../theme/tokens';

/**
 * The three numbers that say how you are doing, in a strip across the top.
 *
 * Compact on purpose: it is context, not content. Home used to open with a
 * greeting and three large stat cards before anything you could act on, which
 * put the least useful thing in the most valuable space.
 */
const Flame: React.FC<{ lit: boolean }> = ({ lit }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24">
    <Path d="M12 2.5c3.4 3 5 5.6 5 8.2a5 5 0 0 1-10 0c0-1.3.5-2.6 1.6-4 .2 1.6.9 2.5 1.9 2.8-.4-2.6.1-5 1.5-7z"
          fill={lit ? colors.red : 'none'} stroke={lit ? colors.red : colors.inkSoft}
          strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

const Bolt: React.FC = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24">
    <Path d="M13.5 2.5 5.5 13.5h5L9.5 21.5l8.5-11.5h-5.2z"
          fill={colors.gold} stroke={colors.ink} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);

const Target: React.FC<{ done: boolean }> = ({ done }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={8.5} fill="none" stroke={done ? colors.greenDeep : colors.inkSoft} strokeWidth={1.9} />
    <Circle cx={12} cy={12} r={3.4} fill={done ? colors.greenDeep : 'none'}
            stroke={done ? colors.greenDeep : colors.inkSoft} strokeWidth={1.9} />
  </Svg>
);

export const StatStrip: React.FC<{
  xp: number;
  streak: number;
  doneToday: number;
  dailyGoal: number;
}> = ({ xp, streak, doneToday, dailyGoal }) => {
  const met = doneToday >= dailyGoal;
  return (
    <View style={s.strip}>
      <View style={s.pill}><Bolt /><Text style={s.value}>{xp}</Text></View>
      <View style={s.pill}>
        <Flame lit={streak > 0} />
        <Text style={[s.value, streak > 0 && { color: colors.red }]}>{streak}</Text>
      </View>
      <View style={[s.pill, met && s.pillDone]}>
        <Target done={met} />
        <Text style={[s.value, met && { color: colors.greenDeep }]}>
          {Math.min(doneToday, dailyGoal)}/{dailyGoal}
        </Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 2, borderColor: colors.line, borderRadius: 999,
    backgroundColor: colors.white, paddingVertical: 7,
  },
  pillDone: { borderColor: colors.greenDeep, backgroundColor: '#eef7e0' },
  value: { fontFamily: font.black, fontSize: 14, color: colors.ink },
});
