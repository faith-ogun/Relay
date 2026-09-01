import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { curve, font, radius, space, type } from '../theme/tokens';
import { makeStyles } from '../theme/theme';

/**
 * The plain list of answer options, and the styles every option-shaped control
 * in a lesson is built from.
 *
 * Extracted from StepView so that two renderers cannot draw the same control
 * two ways. It matters here specifically because the picture question falls
 * back to this list when its photographs cannot be fetched: a fallback that
 * looked even slightly unlike an ordinary question would read as a fault rather
 * than as a question.
 *
 * Presentation only. The owning renderer keeps the selection, registers the
 * grader, and passes indices through unchanged, so `picked` and `correct` are
 * always AUTHORED indices and `order` only decides where each one is drawn.
 */
export const OptionList: React.FC<{
  options: string[];
  /** Authored indices, in the order they should be drawn. */
  order: number[];
  picked: number | null;
  correct: number;
  checked: boolean;
  onPick: (index: number) => void;
}> = ({ options, order, picked, correct, checked, onPick }) => {
  const optionStyles = useOptionStyles();
  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      {order.map((originalIndex) => {
        const opt = options[originalIndex];
        const isPicked = picked === originalIndex;
        const reveal = checked && (originalIndex === correct || isPicked);
        const good = checked && originalIndex === correct;
        return (
          <Pressable
            key={`${opt}-${originalIndex}`}
            disabled={checked}
            onPress={() => onPick(originalIndex)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isPicked }}
            style={[
              optionStyles.option,
              isPicked && !checked && optionStyles.optionPicked,
              reveal && (good ? optionStyles.optionRight : optionStyles.optionWrong),
            ]}
          >
            <Text style={[optionStyles.optionText, reveal && good && optionStyles.optionTextRight]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const useOptionStyles = makeStyles((colors) => ({
  option: {
    borderWidth: 2.5, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: space.md,
  },
  optionPicked: { borderColor: colors.ink, backgroundColor: colors.goldSoft },
  optionRight: { borderColor: colors.greenDeep, backgroundColor: colors.greenSoft },
  optionWrong: { borderColor: colors.red, backgroundColor: colors.redSoft },
  optionText: { fontFamily: font.bold, fontSize: type.body, color: colors.ink },
  optionTextRight: { color: colors.ink },
}));
