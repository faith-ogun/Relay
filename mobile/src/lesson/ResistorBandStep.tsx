import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Line, Rect } from 'react-native-svg';
import { CircuitDiagram } from '../components/circuits/CircuitDiagram';
import { colors, curve, font, radius, space, tabular, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';
import { stepText } from './stepText';
import {
  BAND_COLOURS, MULTIPLIER_LABELS, TOLERANCE_BAND, bandChoices, bandMeaning,
  decodeBands, encodeOhms, fmtOhms, type Bands,
} from './resistorCode';
import type { StepChooseResistor, StepProps } from './types';

/**
 * choose_resistor with a `bands` spec: build the part, do not pick it off a list.
 *
 * 45 of these were falling through to the choice renderer with an `options`
 * array of exactly one entry, so "Set the bands to make a 1 kΩ (1000 Ω)
 * resistor." offered a single button reading "1 kΩ". Reading the colour code IS
 * the lesson, so the learner sets three bands and the decoded value updates as
 * they go, which is the feedback loop the exercise was written around.
 *
 * Graded on exact ohms, as on the web: (digit1 * 10 + digit2) * 10^multiplier.
 */

const BAND_TITLES = ['1st band', '2nd band', 'Multiplier'];

// The drawn part, in its own viewBox.
const VIEW_W = 240;
const VIEW_H = 96;
const BAND_X = [82, 110, 138];
const BAND_W = 14;

const Resistor: React.FC<{
  bands: Bands;
  selected: number;
  onPick: (index: number) => void;
  disabled: boolean;
}> = ({ bands, selected, onPick, disabled }) => (
  <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
    <Line x1={8} y1={48} x2={52} y2={48} stroke={colors.inkMute} strokeWidth={3} strokeLinecap="round" />
    <Line x1={188} y1={48} x2={232} y2={48} stroke={colors.inkMute} strokeWidth={3} strokeLinecap="round" />
    <Rect x={52} y={26} width={136} height={44} rx={14} fill="#d8b98c" stroke="#b08e63" strokeWidth={2} />
    {BAND_X.map((x, i) => (
      <Rect
        key={`band-${i}`}
        x={x - BAND_W / 2} y={22} width={BAND_W} height={52} rx={2}
        fill={BAND_COLOURS[bands[i]].hex} stroke={colors.ink} strokeWidth={0.75}
      />
    ))}
    <Rect x={168} y={26} width={10} height={44} rx={2} fill={TOLERANCE_BAND.hex} />
    {BAND_X.map((x, i) => (
      <Rect
        key={`sel-${i}`}
        x={x - 11} y={78} width={22} height={4} rx={2}
        fill={selected === i ? colors.ink : 'transparent'}
      />
    ))}
    {/* Wide, invisible targets: a 14pt band is not something a finger can hit. */}
    {!disabled && BAND_X.map((x, i) => (
      <Rect
        key={`hit-${i}`}
        x={x - 17} y={8} width={34} height={80} rx={6}
        fill={colors.ink} fillOpacity={0.001}
        onPress={() => onPick(i)}
      />
    ))}
  </Svg>
);

export const ResistorBandStep: React.FC<StepProps & { step: StepChooseResistor }> = ({
  step, checked, correct, onSubmit, onCanCheck, registerGrader,
}) => {
  const target = step.bands.targetOhms;
  const [bands, setBands] = useState<Bands>([0, 0, 0]);
  const [selected, setSelected] = useState(0);
  // Black-black-black is 0 Ω, which is never the answer, so a learner who has
  // not touched a band has not answered. Checking anyway would cost a heart for
  // an accidental tap on a question they never attempted.
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setBands([0, 0, 0]);
    setSelected(0);
    setTouched(false);
  }, [step]);

  const value = decodeBands(bands);

  useEffect(() => {
    onCanCheck(touched);
    registerGrader(touched ? () => onSubmit(value === target) : null);
    return () => registerGrader(null);
  }, [touched, value, target, onCanCheck, registerGrader, onSubmit]);

  const paint = useCallback((digit: number) => {
    setBands((cur) => {
      const next: Bands = [cur[0], cur[1], cur[2]];
      next[selected] = digit;
      return next;
    });
    setTouched(true);
    Haptics.selectionAsync().catch(() => {});
  }, [selected]);

  const answer = useMemo(() => encodeOhms(target), [target]);
  const choices = bandChoices(selected);

  return (
    <View>
      <Text style={stepText.kicker}>SET THE COLOUR BANDS</Text>
      <Text style={stepText.question}>{step.question}</Text>
      <CircuitDiagram circuit={step.circuitDiagram} />

      <View style={s.part}>
        <Resistor bands={bands} selected={selected} onPick={setSelected} disabled={checked} />

        <Text
          style={[s.value, checked && (correct ? s.valueRight : s.valueWrong)]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {fmtOhms(value)}
        </Text>

        <View style={s.bandRow}>
          {BAND_TITLES.map((title, i) => {
            const colour = BAND_COLOURS[bands[i]];
            const on = selected === i;
            return (
              <Pressable
                key={title}
                disabled={checked}
                onPress={() => setSelected(i)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: checked }}
                accessibilityLabel={`${title}, ${colour.name}, ${bandMeaning(i, bands[i])}`}
                style={({ pressed }) => [s.band, on && s.bandOn, pressed && s.bandPressed]}
              >
                <Text style={s.bandTitle}>{title}</Text>
                <View style={s.bandChipRow}>
                  <View style={[s.chip, { backgroundColor: colour.hex }]} />
                  <Text style={s.bandName} numberOfLines={1}>{colour.name}</Text>
                </View>
                <Text style={s.bandMeans}>{i === 2 ? MULTIPLIER_LABELS[bands[i]] : bands[i]}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.toleranceNote}>
          The gold band is the tolerance: this part is accurate to {TOLERANCE_BAND.label}.
        </Text>
      </View>

      <Text style={s.paletteTitle}>
        {checked ? BAND_TITLES[selected] : `Colour for the ${BAND_TITLES[selected].toLowerCase()}`}
      </Text>
      <View style={s.palette}>
        {BAND_COLOURS.slice(0, choices).map((colour, digit) => {
          const on = bands[selected] === digit;
          return (
            <Pressable
              key={colour.name}
              disabled={checked}
              onPress={() => paint(digit)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: checked }}
              accessibilityLabel={`${colour.name}, ${bandMeaning(selected, digit)}`}
              style={({ pressed }) => [
                s.swatch,
                { backgroundColor: colour.hex },
                on && s.swatchOn,
                pressed && s.swatchPressed,
                checked && s.swatchOff,
              ]}
            >
              <Text style={[s.swatchText, { color: colour.ink }]} numberOfLines={1}>
                {selected === 2 ? MULTIPLIER_LABELS[digit] : digit}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!checked && !touched && (
        <Text style={stepText.hint}>Tap a band, then pick its colour. The value updates as you go.</Text>
      )}
      {checked && !correct && answer && (
        <Text style={stepText.hint}>
          {fmtOhms(target)} is {answer.map((v) => BAND_COLOURS[v].name).join(', ')}:
          digits {answer[0]} and {answer[1]}, then {MULTIPLIER_LABELS[answer[2]]}.
        </Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  part: {
    marginTop: space.md, backgroundColor: colors.white, borderWidth: 2.5,
    borderColor: colors.line, borderRadius: radius.lg, ...curve,
    padding: space.md, ...elevation.card,
  },
  value: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    textAlign: 'center', marginTop: space.sm, letterSpacing: -0.6, ...tabular,
  },
  valueRight: { color: colors.greenDeep },
  valueWrong: { color: colors.red },
  bandRow: { flexDirection: 'row', gap: 8, marginTop: space.md },
  band: {
    flex: 1, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    paddingVertical: 8, paddingHorizontal: 8, backgroundColor: colors.white,
  },
  bandOn: { borderColor: colors.ink, backgroundColor: colors.goldSoft },
  bandPressed: { transform: [{ scale: 0.97 }] },
  bandTitle: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 0.6, color: colors.inkSoft },
  bandChipRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  chip: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink },
  bandName: { fontFamily: font.bold, fontSize: type.meta, color: colors.ink, flexShrink: 1 },
  bandMeans: { fontFamily: font.black, fontSize: type.small, color: colors.ink, marginTop: 3, ...tabular },
  toleranceNote: {
    fontFamily: font.semibold, fontSize: type.meta, color: colors.inkMute,
    marginTop: space.sm, lineHeight: 15,
  },
  paletteTitle: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.6, color: colors.inkSoft,
    marginTop: space.md, textTransform: 'uppercase',
  },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.sm },
  swatch: {
    width: 46, height: 46, borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.inkFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  swatchOn: { borderWidth: 3.5, borderColor: colors.ink },
  swatchPressed: { transform: [{ scale: 0.94 }] },
  swatchOff: { opacity: 0.5 },
  swatchText: { fontFamily: font.black, fontSize: type.meta, ...tabular },
});
