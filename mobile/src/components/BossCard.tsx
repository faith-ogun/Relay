import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, curve, font, pressSmall, radius, space, tabular, type } from '../theme/tokens';
import type { BossStatus } from '../services/bosses';

/**
 * The boss that closes a unit.
 *
 * Built on an INK plate rather than the white cards the rest of the path uses.
 * That is the whole point of it: a learner scrolling their path should be able
 * to tell without reading that the thing at the end of a unit is not another
 * lesson. Same reason the run screen swaps the progress bar to red.
 *
 * Three states, and each says the one thing that is true:
 *   locked   - lessons outstanding, so it names how many.
 *   open     - the exam is sittable, so it leads with the button.
 *   cleared  - it is done, so it leads with the score and offers a re-sit.
 */

const Shield: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = colors.white }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* A shield with a resistor across it: the unit's components, defended. */}
    <Path
      d="M12 2.6 4.7 5.4v6.1c0 4.4 3.1 8.1 7.3 9.9 4.2-1.8 7.3-5.5 7.3-9.9V5.4z"
      fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round"
    />
    <Path d="M6.9 12h2.2M14.9 12h2.2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Rect x={9.1} y={9.6} width={5.8} height={4.8} rx={1.2} fill="none" stroke={color} strokeWidth={2} />
  </Svg>
);

export const BossCard: React.FC<{
  unitTitle: string;
  status: BossStatus | null;
  /** The bar to clear, as the server reports it. Never hard-coded here: a
   *  card promising 80% while the server grades at 75% is worse than no card. */
  passRatio: number;
  lessonsRemaining: number;
  onStart: () => void;
}> = ({ unitTitle, status, passRatio, lessonsRemaining, onStart }) => {
  const cleared = !!status?.cleared;
  const locked = lessonsRemaining > 0 || !status?.ready;
  const best = status?.bestRatio ?? 0;

  return (
    <View style={[card.plate, cleared && card.plateCleared]}>
      <View style={card.head}>
        <View style={[card.badge, cleared && card.badgeCleared]}>
          <Shield color={cleared ? colors.ink : colors.white} />
        </View>
        <View style={card.headText}>
          <Text style={card.kicker}>
            {cleared ? 'UNIT CLEARED' : locked ? 'BOSS LOCKED' : 'UNIT BOSS'}
          </Text>
          <Text style={card.title} numberOfLines={2}>{unitTitle}</Text>
        </View>
      </View>

      <Text style={card.blurb}>
        {locked
          ? lessonsRemaining > 0
            ? `${lessonsRemaining} lesson${lessonsRemaining === 1 ? '' : 's'} left in this unit before the boss opens.`
            : 'Clear the unit before this one first.'
          : cleared
            ? 'Sit it again any time. It costs no hearts and the questions change.'
            : `${status?.questions ?? 0} questions drawn from every skill in this unit. No hearts, so you can take it as many times as you need.`}
      </Text>

      {!locked && (
        <View style={card.meta}>
          {cleared ? (
            <Text style={[card.metaText, tabular]}>Best {Math.round(best * 100)}%</Text>
          ) : (
            <Text style={[card.metaText, tabular]}>+{status?.xp ?? 0} XP</Text>
          )}
          <View style={card.dot} />
          <Text style={[card.metaText, tabular]}>
            Pass at {Math.round(passRatio * 100)}%
          </Text>
        </View>
      )}

      {!locked && (
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={cleared ? `Sit the ${unitTitle} boss again` : `Start the ${unitTitle} boss`}
          style={({ pressed }) => [
            card.cta, cleared && card.ctaCleared,
            // The plate drops out from under the face on press, same physical
            // idiom as Button, so the card feels like the rest of the app.
            pressed ? card.ctaDown : pressSmall,
          ]}
        >
          <Text style={[card.ctaText, cleared && card.ctaTextCleared]}>
            {cleared ? 'Sit it again' : 'Face the boss'}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const card = StyleSheet.create({
  plate: {
    backgroundColor: colors.ink, borderRadius: radius.lg, ...curve,
    padding: space.lg, marginTop: space.md,
    borderWidth: 3, borderColor: colors.red,
  },
  plateCleared: { borderColor: colors.green },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: {
    width: 46, height: 46, borderRadius: radius.sm, ...curve,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.red,
  },
  badgeCleared: { backgroundColor: colors.green },
  headText: { flex: 1 },
  kicker: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5,
    color: colors.inkMute,
  },
  title: {
    fontFamily: font.black, fontSize: type.heading, color: colors.white,
    letterSpacing: -0.5, marginTop: 1,
  },

  blurb: {
    fontFamily: font.semibold, fontSize: type.small, color: '#c9ccd2',
    marginTop: space.md, lineHeight: 20,
  },

  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  metaText: { fontFamily: font.black, fontSize: type.small, color: colors.gold },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.inkMute },

  cta: {
    marginTop: space.md, backgroundColor: colors.red,
    borderRadius: radius.md, ...curve, paddingVertical: 14, alignItems: 'center',
  },
  ctaCleared: { backgroundColor: colors.white },
  ctaDown: { transform: [{ translateY: 3 }] },
  ctaText: { fontFamily: font.black, fontSize: type.body, color: colors.white, letterSpacing: 0.2 },
  ctaTextCleared: { color: colors.ink },
});
