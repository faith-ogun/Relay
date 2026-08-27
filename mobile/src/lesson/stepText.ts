import { StyleSheet } from 'react-native';
import { colors, font, space, type } from '../theme/tokens';

/**
 * The three pieces of text every step shares: the eyebrow, the prompt, and the
 * quiet line under the interaction.
 *
 * Split out of StepView so a step renderer in its own file cannot drift from the
 * ones still inside it. A meter step whose question sits at a different size to
 * a multiple-choice question reads as two different products.
 */
export const stepText = StyleSheet.create({
  kicker: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.blueDeep,
  },
  question: {
    fontFamily: font.black, fontSize: type.heading, color: colors.ink,
    marginTop: 6, lineHeight: type.heading * 1.3,
  },
  hint: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: space.sm,
  },
});
