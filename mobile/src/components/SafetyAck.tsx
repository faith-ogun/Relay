import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from './Button';
import { colors, font, radius, space, type, curve } from '../theme/tokens';
import { elevation } from '../theme/elevation';

// The live tutor pairs AI-generated guidance with real electronics, so this is
// shown once before a learner's first live session. The wording is copied from
// the web acknowledgement rather than rephrased: it mirrors Terms section 9, and
// two surfaces making subtly different safety promises is worse than either one
// alone.
const POINTS = [
  "Ohmlet's guidance is AI-generated and can be wrong. Use your own judgement and double-check before you power a circuit.",
  'Stick to low-voltage hobby electronics. Never use mains power, and stop if a part gets hot, smells, or behaves oddly.',
  'You build at your own risk.',
];

interface Props {
  visible: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export const SafetyAck: React.FC<Props> = ({ visible, onAccept, onCancel }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={s.backdrop}>
      <View style={s.sheet}>
        <View style={s.badge}>
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path
              d="M12 2.5 4.5 5.8v5.4c0 4.6 3.1 8.6 7.5 9.8 4.4-1.2 7.5-5.2 7.5-9.8V5.8Z"
              fill="none" stroke={colors.ink} strokeWidth={2.2} strokeLinejoin="round"
            />
            <Path d="m8.6 12 2.4 2.4 4.4-4.6" fill="none" stroke={colors.ink}
                  strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>

        <Text style={s.title}>A quick safety check</Text>

        <View style={s.points}>
          {POINTS.map((p) => (
            <View key={p} style={s.point}>
              <View style={s.dot} />
              <Text style={s.pointText}>{p}</Text>
            </View>
          ))}
        </View>

        <Button label="I understand" onPress={onAccept} style={{ marginTop: space.lg }} />
        <Pressable onPress={onCancel} style={s.cancel} accessibilityRole="button">
          <Text style={s.cancelText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(20,24,31,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: space.lg,
  },
  sheet: {
    width: '100%', maxWidth: 420, backgroundColor: colors.white,
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, ...curve,
    padding: space.lg, ...elevation.card,
  },
  badge: {
    width: 54, height: 54, borderRadius: radius.md, ...curve, borderWidth: 2.5, borderColor: colors.ink,
    backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    letterSpacing: -0.5, marginTop: space.md,
  },
  points: { marginTop: space.md, gap: space.sm },
  point: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: 4, ...curve, backgroundColor: colors.gold, marginTop: 7 },
  pointText: {
    flex: 1, fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, lineHeight: 21,
  },
  cancel: { alignSelf: 'center', paddingVertical: space.md },
  cancelText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
