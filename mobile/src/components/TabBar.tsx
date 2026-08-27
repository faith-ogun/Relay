import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, curve, font, type } from '../theme/tokens';
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

export interface TabItem {
  key: keyof typeof TAB_ICONS;
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
                on a hairline row is not enough signal to find yourself by. */}
            <View style={s.slot}>
              <Image
                source={TAB_ART[item.key][on ? 'on' : 'off']}
                style={s.icon}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>
            <Text style={[s.label, on && s.labelOn]} maxFontSizeMultiplier={1.15} numberOfLines={1}>
              {item.label}
            </Text>
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
    paddingTop: 8,
    ...elevation.overlay,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 },
  slot: {
    width: 46, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  // 30, not the 26 the drawn glyphs used: the selected state carries its own
  // plate inside the artwork and needs the room for it.
  icon: { width: 30, height: 30 },
  label: {
    // Sentence case at 11px, not uppercase at 11px with wide tracking: the old
    // treatment made five short words into five grey smears.
    fontFamily: font.extrabold, fontSize: type.meta, color: colors.inkMute,
    letterSpacing: 0,
  },
  labelOn: { fontFamily: font.black, color: colors.ink },
});
