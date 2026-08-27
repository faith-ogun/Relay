import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../Button';
import { Close } from '../icons';
import type { KitCheckPhase } from '../../hooks/useKitCheck';
import type { IdentifiedComponent, InventoryResult, PartStatus } from '../../services/visionVerifier';
import { colors, curve, font, leading, radius, space, tabular, tracking, type } from '../../theme/tokens';
import { elevation } from '../../theme/elevation';
import { stagger } from '../../theme/motion';

/**
 * The result of pointing the camera at the bench: step 2 of the learning loop.
 *
 * One sheet covers the whole interaction, from the shutter to the verdict, so
 * the learner taps once and watches it happen rather than waiting on a button
 * that has gone quiet. Every phase the hook can be in is drawn here, including
 * the failures: a check that cannot reach the service says so and offers the
 * retry, and one that cannot be retried says that instead of pretending.
 *
 * The per-part list is not reconciled against the build's parts here. The
 * service already anchors its answer to the expected list and defaults anything
 * the model skipped to "unsure", so every expected part is always accounted for
 * and a second opinion on this side could only disagree with it.
 *
 * Status is carried by a drawn mark AND the row's own rule colour, never by
 * colour alone, so the list still reads with colour vision differences and in
 * the glare of a desk lamp.
 */

interface Props {
  visible: boolean;
  phase: KitCheckPhase;
  /** What the learner asked for, so the progress copy and the retry match. */
  intent: 'inventory' | 'identify';
  inventory: InventoryResult | null;
  component: IdentifiedComponent | null;
  error: string;
  retryable: boolean;
  buildTitle?: string;
  /** True once the result has been handed to the live tutor. */
  toldTutor: boolean;
  onRetry: () => void;
  onClose: () => void;
}

/** Below this the model is telling us it could not really see the bench. */
const LOW_CONFIDENCE = 0.5;

export const KitCheckSheet: React.FC<Props> = ({
  visible, phase, intent, inventory, component, error, retryable, buildTitle,
  toldTutor, onRetry, onClose,
}) => {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // 'idle' is in here so the sheet can never be blank: a caller that opens it
  // a tick before starting the check shows the shutter copy, not nothing.
  const working = phase === 'idle' || phase === 'capturing' || phase === 'checking';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View
          style={[s.sheet, { paddingBottom: insets.bottom + space.md }]}
          accessibilityViewIsModal
        >
          <View style={s.grabber} />
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={s.close}
            accessibilityRole="button"
            accessibilityLabel="Close the kit check"
          >
            <Close size={17} />
          </Pressable>

          <ScrollView
            contentContainerStyle={s.inner}
            showsVerticalScrollIndicator={false}
          >
            {working && (
              <View style={s.working} accessibilityLiveRegion="polite">
                <ActivityIndicator color={colors.goldPlate} />
                <Text style={s.workingTitle}>
                  {phase === 'capturing'
                    ? 'Holding the frame'
                    : intent === 'identify' ? 'Reading the part' : 'Looking at your bench'}
                </Text>
                <Text style={s.workingBody}>
                  {intent === 'identify'
                    ? 'Working out what you are holding up.'
                    : buildTitle
                      ? `Checking what is in shot against the ${buildTitle} parts list.`
                      : 'Checking what is in shot against your parts list.'}
                </Text>
              </View>
            )}

            {phase === 'error' && (
              <View accessibilityLiveRegion="polite">
                <Text style={s.eyebrow}>KIT CHECK</Text>
                <Text style={s.verdictTitle}>That did not go through</Text>
                <Text style={s.body}>{error}</Text>
                <View style={s.actions}>
                  {retryable && (
                    <View style={s.action}>
                      <Button label="Try again" onPress={onRetry} />
                    </View>
                  )}
                  <View style={s.action}>
                    <Button label="Close" variant="secondary" onPress={onClose} />
                  </View>
                </View>
              </View>
            )}

            {phase === 'done' && inventory && (
              <InventoryReport
                result={inventory}
                reduced={reduced}
                toldTutor={toldTutor}
                onRetry={onRetry}
                onClose={onClose}
              />
            )}

            {phase === 'done' && component && (
              <ComponentReport
                result={component}
                toldTutor={toldTutor}
                onRetry={onRetry}
                onClose={onClose}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── The inventory verdict ────────────────────────────────────────────────────

const InventoryReport: React.FC<{
  result: InventoryResult;
  reduced: boolean;
  toldTutor: boolean;
  onRetry: () => void;
  onClose: () => void;
}> = ({ result, reduced, toldTutor, onRetry, onClose }) => {
  const found = result.parts.filter((p) => p.status === 'present').length;
  const missing = result.parts.filter((p) => p.status === 'missing').length;
  const unsure = result.parts.filter((p) => p.status === 'unsure').length;

  return (
    <View>
      <Text style={s.eyebrow}>KIT CHECK</Text>
      <Text style={s.verdictTitle}>
        {result.ready ? 'Your bench is ready.' : missing > 0 ? 'A couple of gaps.' : 'Nearly there.'}
      </Text>
      <View
        style={[
          s.verdict,
          result.ready ? s.verdictReady : s.verdictWaiting,
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text style={s.verdictText}>{result.feedback}</Text>
      </View>

      <View style={s.tally}>
        <Tally count={found} label="found" tint={colors.greenDeep} />
        {missing > 0 && <Tally count={missing} label="missing" tint={colors.red} />}
        {unsure > 0 && <Tally count={unsure} label="unsure" tint={colors.blueDeep} />}
      </View>

      <View style={s.partList}>
        {result.parts.map((part, i) => (
          <PartRow key={`${part.name}-${i}`} part={part} index={i} reduced={reduced} />
        ))}
      </View>

      {result.found_extras.length > 0 && (
        <View style={s.extras}>
          <Text style={s.sectionLabel}>ALSO ON THE BENCH</Text>
          <View style={s.extraChips}>
            {result.found_extras.map((extra) => (
              <View key={extra} style={s.extraChip}>
                <Text style={s.extraChipText}>{extra}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {result.confidence < LOW_CONFIDENCE && (
        <Text style={s.caveat}>
          That was a hard photo to read. Spread the parts out on a plain surface with the light
          behind you and check again.
        </Text>
      )}

      {toldTutor && <Text style={s.told}>The tutor has this, so it can pick up from here.</Text>}

      <View style={s.actions}>
        <View style={s.action}>
          <Button label="Check again" variant="secondary" onPress={onRetry} />
        </View>
        <View style={s.action}>
          <Button label="Done" onPress={onClose} />
        </View>
      </View>
    </View>
  );
};

const Tally: React.FC<{ count: number; label: string; tint: string }> = ({ count, label, tint }) => (
  <View style={[s.tallyPill, { borderColor: tint }]}>
    <Text style={[s.tallyCount, { color: tint }]}>{count}</Text>
    <Text style={s.tallyLabel}>{label.toUpperCase()}</Text>
  </View>
);

const StatusMark: React.FC<{ status: PartStatus['status'] }> = ({ status }) => {
  const tint =
    status === 'present' ? colors.greenDeep : status === 'missing' ? colors.red : colors.blueDeep;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10.5} fill={tint} />
      {status === 'present' && (
        <Path d="m7.6 12.2 3 3 5.8-6.2" fill="none" stroke={colors.white} strokeWidth={2.4}
              strokeLinecap="round" strokeLinejoin="round" />
      )}
      {status === 'missing' && (
        <Path d="M7.5 12h9" fill="none" stroke={colors.white} strokeWidth={2.4} strokeLinecap="round" />
      )}
      {status === 'unsure' && (
        <>
          <Path d="M9.5 9.6a2.6 2.6 0 1 1 3.4 2.5c-.7.3-1 .8-1 1.6v.2"
                fill="none" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" />
          <Circle cx={11.9} cy={17} r={1.25} fill={colors.white} />
        </>
      )}
    </Svg>
  );
};

const PartRow: React.FC<{ part: PartStatus; index: number; reduced: boolean }> = ({
  part, index, reduced,
}) => {
  const tint =
    part.status === 'present' ? colors.line
      : part.status === 'missing' ? colors.red : colors.blue;
  const spoken =
    part.status === 'present' ? 'found' : part.status === 'missing' ? 'missing' : 'not sure';

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(stagger(index, 38)).duration(260)}
      style={[s.partRow, { borderLeftColor: tint }, part.status !== 'present' && s.partRowFlagged]}
      accessibilityLabel={`${part.name}: ${spoken}${part.note ? `. ${part.note}` : ''}`}
    >
      <StatusMark status={part.status} />
      <View style={s.partText}>
        <Text style={[s.partName, part.status === 'missing' && s.partNameMissing]}>{part.name}</Text>
        {!!part.note && <Text style={s.partNote}>{part.note}</Text>}
      </View>
    </Animated.View>
  );
};

// ── A single component, identified ───────────────────────────────────────────

const ComponentReport: React.FC<{
  result: IdentifiedComponent;
  toldTutor: boolean;
  onRetry: () => void;
  onClose: () => void;
}> = ({ result, toldTutor, onRetry, onClose }) => (
  <View>
    <Text style={s.eyebrow}>WHAT THIS IS</Text>
    <View style={s.idHead}>
      <Text style={s.verdictTitle}>{result.name}</Text>
      {!!result.value && (
        <View style={s.valueChip}>
          <Text style={s.valueChipText}>{result.value}</Text>
        </View>
      )}
    </View>

    <Text style={s.body}>{result.purpose}</Text>

    <View style={s.tip}>
      <View style={s.tipBand} />
      <View style={s.tipBody}>
        <Text style={s.sectionLabel}>ON THE BENCH</Text>
        <Text style={s.tipText}>{result.tip}</Text>
      </View>
    </View>

    {result.confidence < LOW_CONFIDENCE && (
      <Text style={s.caveat}>
        That was a hard one to read. Hold it closer, with the markings facing the camera.
      </Text>
    )}

    {toldTutor && <Text style={s.told}>The tutor has this, so you can just ask about it.</Text>}

    <View style={s.actions}>
      <View style={s.action}>
        <Button label="Scan another" variant="secondary" onPress={onRetry} />
      </View>
      <View style={s.action}>
        <Button label="Done" onPress={onClose} />
      </View>
    </View>
  </View>
);

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,31,0.5)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...curve,
    borderTopWidth: 2.5, borderColor: colors.ink,
    ...elevation.overlay,
  },
  grabber: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: colors.inkFaint,
    alignSelf: 'center', marginTop: 10,
  },
  close: {
    position: 'absolute', top: space.md, right: space.md, zIndex: 2,
    width: 34, height: 34, borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  inner: { padding: space.lg, paddingTop: space.md },

  working: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm },
  workingTitle: {
    fontFamily: font.black, fontSize: type.heading, letterSpacing: tracking.heading, color: colors.ink,
  },
  workingBody: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, textAlign: 'center', maxWidth: 300,
  },

  eyebrow: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta, color: colors.inkMute,
  },
  verdictTitle: {
    fontFamily: font.black, fontSize: type.title, lineHeight: leading.title,
    letterSpacing: tracking.title, color: colors.ink, marginTop: 2,
  },
  body: {
    fontFamily: font.semibold, fontSize: type.body, lineHeight: leading.body,
    color: colors.inkSoft, marginTop: space.sm,
  },

  verdict: {
    marginTop: space.md, padding: space.md, borderRadius: radius.md, ...curve, borderWidth: 2,
  },
  verdictReady: { backgroundColor: colors.green, borderColor: colors.greenDeep },
  verdictWaiting: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  verdictText: {
    fontFamily: font.bold, fontSize: type.body, lineHeight: leading.body, color: colors.ink,
  },

  tally: { flexDirection: 'row', gap: 6, marginTop: space.md },
  tallyPill: {
    flexDirection: 'row', alignItems: 'baseline', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, ...curve,
    borderWidth: 2, backgroundColor: colors.white,
  },
  tallyCount: { fontFamily: font.black, fontSize: type.label, ...tabular },
  tallyLabel: { fontFamily: font.black, fontSize: 9, letterSpacing: 1, color: colors.inkSoft },

  partList: { marginTop: space.md, gap: 6 },
  partRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.white, borderRadius: radius.sm, ...curve,
    borderWidth: 1.5, borderColor: colors.line, borderLeftWidth: 5,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  // A gap is worth more of the eye than something already ticked off.
  partRowFlagged: { ...elevation.card },
  partText: { flex: 1 },
  partName: { fontFamily: font.bold, fontSize: type.small, color: colors.ink },
  partNameMissing: { fontFamily: font.black },
  partNote: {
    fontFamily: font.semibold, fontSize: type.meta, lineHeight: leading.meta,
    color: colors.inkSoft, marginTop: 3,
  },

  extras: { marginTop: space.lg },
  sectionLabel: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta, color: colors.inkMute,
  },
  extraChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  extraChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, ...curve,
    backgroundColor: colors.blueSoft, borderWidth: 1.5, borderColor: colors.blue,
  },
  extraChipText: { fontFamily: font.bold, fontSize: type.meta, color: colors.ink },

  caveat: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: leading.small,
    color: colors.inkSoft, marginTop: space.lg,
  },
  told: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: tracking.meta,
    color: colors.greenDeep, textTransform: 'uppercase', marginTop: space.md,
  },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  action: { flex: 1 },

  idHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  valueChip: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, ...curve,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.goldPlate,
  },
  valueChipText: { fontFamily: font.black, fontSize: type.small, color: colors.goldText, ...tabular },

  tip: {
    flexDirection: 'row', marginTop: space.lg,
    backgroundColor: colors.white, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, overflow: 'hidden',
  },
  tipBand: { width: 6, backgroundColor: colors.gold },
  tipBody: { flex: 1, padding: space.md },
  tipText: {
    fontFamily: font.bold, fontSize: type.small, lineHeight: leading.small,
    color: colors.ink, marginTop: 6,
  },
});
