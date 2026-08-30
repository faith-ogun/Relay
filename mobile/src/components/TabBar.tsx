import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import * as Haptics from 'expo-haptics';

/**
 * The six places you can be.
 *
 * Home was a stack of eight rows, which is a menu rather than a product: nothing
 * was ranked, so everything competed. A tab bar says what matters (learn), keeps
 * the rest one tap away, and gets achievements, twins, plan and account off the
 * front page and into a profile where they belong.
 *
 * Icons are drawn rather than pulled from an icon set, because a lightning bolt
 * and a breadboard say Ohmlet and a generic glyph set says nothing.
 *
 * NO CAPTIONS, since 2026-08-29. Each tab used to carry its name in 11px under
 * the icon. Faith asked for the same treatment the top strip got: take the words
 * away and let the icons be big enough to speak. The words were not carrying
 * meaning the artwork did not already carry, and they were holding every icon
 * down to 30pt in a bar that had room for more.
 *
 * The caption WAS carrying one thing, and it was not visual: the tab's name for
 * anyone who cannot see the picture. That moved to `accessibilityLabel` on the
 * Pressable, which unlike a plain View is an accessibility element already, so
 * the label is read rather than merely present.
 */

/**
 * 34, up from 30, which is what removing the captions bought.
 *
 * Not larger than 34, and the reason is measurable: the painted set is authored
 * at 30pt, so its @3x files are 90x90 and the ink already fills 90% of that
 * canvas. 34pt asks a 3x screen for 102px and gets 90, a 13% upscale that soft
 * edges absorb. 40pt would ask for 120 and start to blur the linework, which is
 * the opposite of what making them bigger was for. Past 34 the art has to be
 * re-exported, not stretched.
 */
const ICON = 34;

/**
 * The tab icons are painted artwork, one file per state.
 *
 * They were five SVG paths drawn here. The comment above used to argue that
 * drawing them beat pulling from an icon set, because a lightning bolt from a
 * pack is somebody else's lightning bolt. That reasoning was right and the
 * result still was not Ohmlet's: Faith's words for the old Practice icon were
 * "very, very rudimentary". Hand-drawn generic is still generic.
 *
 * Every one now carries the electronics idea. The graduation cap's tassel is a
 * resistor, Practice is a breadboard with a real component across it, Live is a
 * camera with a lit indicator, Community wires three people together, Profile
 * has a component at the collar.
 *
 * Two files each. The selected state is not a tint of the unselected one: it is
 * its own drawing, with the gold plate built into the art. That is why `slotOn`
 * is gone from the styles below, and why the two states must stay the same
 * scale as each other, which is enforced by generating both from one source
 * normalised on its LINEWORK rather than its canvas. Scale the icon on tap and
 * the whole bar twitches.
 */
const TAB_ART = {
  learn: { off: require('../../assets/nav/learn-off.png'), on: require('../../assets/nav/learn-on.png') },
  practice: { off: require('../../assets/nav/practice-off.png'), on: require('../../assets/nav/practice-on.png') },
  live: { off: require('../../assets/nav/live-off.png'), on: require('../../assets/nav/live-on.png') },
  community: { off: require('../../assets/nav/community-off.png'), on: require('../../assets/nav/community-on.png') },
  profile: { off: require('../../assets/nav/profile-off.png'), on: require('../../assets/nav/profile-on.png') },
} as const;

export const TAB_ICONS = TAB_ART;

/**
 * The plans tab's icon, drawn here rather than painted.
 *
 * TEMPORARY, AND DELIBERATELY SO. Faith is making the real one; when
 * assets/nav/plans-off.png and plans-on.png land, this component goes and a
 * `plans` entry joins TAB_ART above. scripts/check-stat-icons.mjs fails if the
 * art appears and this is still being drawn, so the swap cannot be left half
 * done and forgotten.
 *
 * It is a battery rather than a coin or a crown, for the same reason every other
 * icon in this bar carries an electronics idea: a coin says "payment" in a way
 * that belongs to any app, and a battery says how much you have got, which is
 * exactly what a plan is here. Three cells for three tiers, and the selected
 * state fills them.
 *
 * Built to the same rules as the painted set: the off state is ink linework with
 * no plate, and the on state carries its own pale plate so the two never change
 * scale when you tap between them.
 */
const PlansIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <Svg width={ICON} height={ICON} viewBox="0 0 30 30">
    {active && (
      <Rect x={0.9} y={0.9} width={28.2} height={28.2} rx={8}
        fill={colors.goldSoft} stroke={colors.goldPlate} strokeWidth={1.4} />
    )}
    {/* The can. */}
    <Rect x={5.5} y={9} width={16} height={12} rx={2.6}
      fill={active ? colors.white : 'none'} stroke={colors.ink} strokeWidth={2.1} />
    {/* The positive terminal. */}
    <Rect x={22.2} y={12.6} width={2.6} height={4.8} rx={1.1} fill={colors.ink} />
    {/* Three cells, filled when this is where you are. */}
    {[7.9, 12.2, 16.5].map((x, i) => (
      <Rect key={x} x={x} y={11.6} width={3.1} height={6.8} rx={1}
        fill={active ? [colors.gold, colors.gold, colors.goldDeep][i] : colors.inkMute} />
    ))}
  </Svg>
);


export interface TabItem {
  /** `plans` is drawn rather than painted, until its artwork exists. */
  key: keyof typeof TAB_ICONS | 'plans';
  /**
   * No longer drawn on screen. It is the tab's ACCESSIBLE NAME, which is the
   * job the caption was actually doing: a row of six pictures with nothing said
   * about them is not navigable by anyone who cannot see the pictures.
   */
  label: string;
  onPress: () => void;
}

export const TabBar: React.FC<{ items: TabItem[]; active: string }> = ({ items, active }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.map((item) => {
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
            {/* The active tab gets a filled plate behind its icon. A colour swap
                on a hairline row is not enough signal to find yourself by, and
                it is the only signal left now the captions have gone. */}
            <View style={s.slot}>
              {item.key === 'plans' ? (
                <PlansIcon active={on} />
              ) : (
                <Image
                  source={TAB_ART[item.key][on ? 'on' : 'off']}
                  style={s.icon}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              )}
            </View>
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
    // A real edge, not a hairline. The bar is app chrome and should read as a
    // surface the content sits above, which a 0.5px line does not achieve.
    borderTopWidth: 2,
    borderTopColor: colors.line,
    paddingTop: 6,
    ...elevation.overlay,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  slot: {
    width: ICON + 12, height: ICON + 4,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { width: ICON, height: ICON },
});
