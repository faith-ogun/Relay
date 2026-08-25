import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, curve, font, tabular, tracking, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import * as Haptics from 'expo-haptics';

/**
 * The five places you can be.
 *
 * Home was a stack of eight rows, which is a menu rather than a product: nothing
 * was ranked, so everything competed. A tab bar says what matters (learn), keeps
 * the rest one tap away, and gets achievements, twins, plan and account off the
 * front page and into a profile where they belong.
 *
 * Icons are drawn rather than pulled from an icon set, because a lightning bolt
 * and a breadboard say Ohmlet and a generic glyph set says nothing.
 */

type IconProps = { active: boolean };
const stroke = (a: boolean) => (a ? colors.ink : colors.inkSoft);

// The icons draw on a 24 grid but render at 26, so the nominal stroke is scaled
// to land at a true 2.5px on screen. Otherwise every icon is subtly lighter
// than the borders beside it and the whole row looks unresolved.
const ICON_SIZE = 26;
const ICON_STROKE = 2.5 * (24 / ICON_SIZE);

const LearnIcon: React.FC<IconProps> = ({ active }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
    <Path d="M3 7.5 12 3.5l9 4-9 4z" fill={active ? colors.gold : 'none'}
          stroke={stroke(active)} strokeWidth={ICON_STROKE} strokeLinejoin="round" />
    <Path d="M6.5 10.5v4.8c0 1.6 2.5 2.7 5.5 2.7s5.5-1.1 5.5-2.7v-4.8"
          fill="none" stroke={stroke(active)} strokeWidth={ICON_STROKE} strokeLinecap="round" />
  </Svg>
);

const PracticeIcon: React.FC<IconProps> = ({ active }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
    <Rect x={3} y={5} width={18} height={14} rx={3} fill={active ? colors.gold : 'none'}
          stroke={stroke(active)} strokeWidth={ICON_STROKE} />
    <Path d="M13 8.5 9.5 13h3.2L11 16.5" fill="none" stroke={stroke(active)}
          strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LiveIcon: React.FC<IconProps> = ({ active }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
    <Rect x={2.5} y={6.5} width={13} height={11} rx={3} fill={active ? colors.gold : 'none'}
          stroke={stroke(active)} strokeWidth={ICON_STROKE} />
    <Path d="M16.5 11.5 21.5 8.5v7l-5-3z" fill={active ? colors.gold : 'none'}
          stroke={stroke(active)} strokeWidth={ICON_STROKE} strokeLinejoin="round" />
  </Svg>
);

const CommunityIcon: React.FC<IconProps> = ({ active }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
    <Circle cx={9} cy={9} r={3.2} fill={active ? colors.gold : 'none'} stroke={stroke(active)} strokeWidth={ICON_STROKE} />
    <Circle cx={16.5} cy={10.5} r={2.4} fill="none" stroke={stroke(active)} strokeWidth={ICON_STROKE} />
    <Path d="M3.5 19c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6" fill="none"
          stroke={stroke(active)} strokeWidth={ICON_STROKE} strokeLinecap="round" />
    <Path d="M16 14.6c2.4.2 4.5 1.6 4.5 4.4" fill="none"
          stroke={stroke(active)} strokeWidth={ICON_STROKE} strokeLinecap="round" />
  </Svg>
);

const ProfileIcon: React.FC<IconProps> = ({ active }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
    <Circle cx={12} cy={8.5} r={3.6} fill={active ? colors.gold : 'none'} stroke={stroke(active)} strokeWidth={ICON_STROKE} />
    <Path d="M4.5 19.5c0-3.6 3.4-5.6 7.5-5.6s7.5 2 7.5 5.6" fill="none"
          stroke={stroke(active)} strokeWidth={ICON_STROKE} strokeLinecap="round" />
  </Svg>
);

export const TAB_ICONS = {
  learn: LearnIcon,
  practice: PracticeIcon,
  live: LiveIcon,
  community: CommunityIcon,
  profile: ProfileIcon,
} as const;

export interface TabItem {
  key: keyof typeof TAB_ICONS;
  label: string;
  onPress: () => void;
}

export const TabBar: React.FC<{ items: TabItem[]; active: string }> = ({ items, active }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const Icon = TAB_ICONS[item.key];
        const on = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              item.onPress();
            }}
            style={s.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
          >
            <Icon active={on} />
            <Text style={[s.label, on && s.labelOn]} maxFontSizeMultiplier={1.15}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(20,24,31,0.12)',
    paddingTop: 8,
    ...elevation.overlay,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  label: {
    fontFamily: font.extrabold, fontSize: type.meta, color: colors.inkSoft,
    letterSpacing: tracking.meta, textTransform: 'uppercase',
  },
  labelOn: { fontFamily: font.black, color: colors.ink },
});
