import React from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Lock } from '../icons';
import { curve, font, radius, type } from '../../theme/tokens';
import { makeStyles, useColors } from '../../theme/theme';

/**
 * The three kinds of live session, in one control at the top of the Live tab.
 *
 * Interview Mode and career coaching were real, finished features that no tab
 * reached: the only way in was a row on the profile screen, which is where an
 * app puts settings, not where it puts the thing it is selling. A seventh tab in
 * the bottom bar was not available either, because six is already the point at
 * which the labels stop being readable.
 *
 * So they are segments rather than destinations, exactly as the simulator's
 * Code / Circuit / Build / Sandbox are: three views of one activity, which is
 * "talk to Ohmlet with the camera on". The visual and interaction language is
 * deliberately identical to `components/sim/SimTabs.tsx`, down to the haptic, so
 * the app has one segmented control rather than two that nearly match.
 *
 * Two things it adds that SimTabs does not need:
 *
 *   A LOCKED state. A learner without Max still sees both paid modes, still
 *   selects them, and lands on a panel that says what the mode is and where to
 *   buy it. Hiding them would be tidier and would sell nothing.
 *
 *   A HELD state. Switching segment while a session is live would tear down a
 *   conversation mid-sentence, so the screen refuses; `held` is what makes the
 *   refusal feel like a refusal rather than a dead button.
 *
 * "Bench" rather than "Live tutor" for the first segment, deliberately: a Live
 * tab whose first segment is called Live Tutor reads as a mistake.
 */

export type LiveMode = 'bench' | 'interview' | 'coaching';

const SEGMENTS: { key: LiveMode; label: string; hint: string }[] = [
  { key: 'bench', label: 'Bench', hint: 'The tutor watches your board and talks you through the build' },
  { key: 'interview', label: 'Interview', hint: 'A mock interview tuned to a job description, scored at the end' },
  { key: 'coaching', label: 'Coaching', hint: 'A coaching session built on what Ohmlet has watched you build' },
];

interface Props {
  value: LiveMode;
  onChange: (mode: LiveMode) => void;
  /** Modes this plan does not include. Shown and selectable; the panel sells them. */
  locked?: readonly LiveMode[];
  /** A session is running, so the screen is about to refuse the switch. */
  held?: boolean;
  /** `dark` is the variant that sits over the camera feed. */
  tone?: 'light' | 'dark';
  style?: ViewStyle;
}

export const LiveModes: React.FC<Props> = ({
  value, onChange, locked = [], held = false, tone = 'light', style,
}) => {
  const colors = useColors();
  const s = useS();
  const dark = tone === 'dark';
  return (
    <View style={[s.bar, dark && s.barDark, style]}>
      {SEGMENTS.map((seg) => {
        const on = seg.key === value;
        const shut = locked.includes(seg.key);
        return (
          <Pressable
            key={seg.key}
            onPress={() => {
              if (on) return;
              // A refused switch has to feel refused. Everything else, including
              // selecting a locked mode to read what it is, is a real selection.
              void (held
                ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                : Haptics.selectionAsync());
              onChange(seg.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={shut ? `${seg.label}, on the Max plan` : seg.label}
            accessibilityHint={held ? 'Your session is still live, so this cannot change yet' : seg.hint}
            style={({ pressed }) => [
              s.seg,
              on && (dark ? s.segOnDark : s.segOn),
              pressed && !on && (dark ? s.segPressedDark : s.segPressed),
            ]}
          >
            {shut && (
              <Lock
                size={13}
                color={
                  on
                    ? colors.goldText
                    : (dark ? 'rgba(255,255,255,0.55)' : colors.inkMute)
                }
              />
            )}
            <Text
              style={[
                s.label,
                dark && s.labelDark,
                shut && (dark ? s.labelShutDark : s.labelShut),
                on && (dark ? s.labelOnDark : s.labelOn),
              ]}
              numberOfLines={1}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const useS = makeStyles((colors) => ({
  bar: {
    flexDirection: 'row', gap: 4, padding: 4,
    backgroundColor: colors.inkFaint, borderRadius: radius.md, ...curve,
  },
  // Over the camera the bar is glass, not grey: the same treatment the build
  // bar and the kit buttons already use lower down the same feed.
  barDark: {
    backgroundColor: 'rgba(20,24,31,0.72)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.26)',
  },
  seg: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: radius.sm, ...curve,
  },
  segOn: { backgroundColor: colors.surface },
  segOnDark: { backgroundColor: colors.gold },
  segPressed: { backgroundColor: 'rgba(255,255,255,0.5)' },
  segPressedDark: { backgroundColor: 'rgba(255,255,255,0.14)' },
  // Three segments on a 393pt screen leaves about 105pt each. At type.small the
  // longest label plus its lock glyph still fits without truncating.
  label: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  labelOn: { color: colors.ink },
  labelShut: { color: colors.inkMute },
  labelDark: { color: 'rgba(255,255,255,0.78)' },
  labelOnDark: { color: colors.onGold },
  labelShutDark: { color: 'rgba(255,255,255,0.55)' },
}));
