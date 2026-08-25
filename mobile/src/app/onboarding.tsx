import React, { useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, NativeScrollEvent, NativeSyntheticEvent,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { track } from '../services/analytics';
import { goBack } from '../services/nav';
import { Button } from '../components/Button';
import { BoardScanScene } from '../components/scenes/BoardScanScene';
import { TwinScene } from '../components/scenes/TwinScene';
import { VoiceScene } from '../components/scenes/VoiceScene';
import { markOnboardingSeen } from '../services/firstRun';
import { colors, font, space, type } from '../theme/tokens';

const { width } = Dimensions.get('window');

/**
 * Three beats, one idea each: it sees, it talks, you keep the build. Every claim
 * here is a shipped capability — no promises the product does not keep, which is
 * the rule the web marketing pages were rebuilt around.
 */
const SLIDES = [
  {
    art: require('../../assets/brand/mascot-probe.png'),
    Scene: BoardScanScene,
    kicker: 'IT SEES YOUR BENCH',
    title: 'Point your camera at the board.',
    body: 'The tutor checks your components before you wire anything, then watches the board as you build. A resistor in the wrong row gets caught while you are still holding it.',
  },
  {
    art: require('../../assets/brand/mascot-point.png'),
    Scene: VoiceScene,
    kicker: 'IT TALKS BACK',
    title: 'Ask out loud, mid-build.',
    body: 'Voice guidance step by step. Ask why the circuit works while your hands are busy, and it writes and debugs the Arduino sketch with you.',
  },
  {
    art: require('../../assets/brand/mascot-celebrate.png'),
    Scene: TwinScene,
    kicker: 'YOU KEEP THE BUILD',
    title: 'Finish, and it becomes a 3D twin.',
    body: 'Every completed circuit turns into a model you can spin, keep, and share. Your XP and streak carry across every session.',
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollView>(null);
  const last = index === SLIDES.length - 1;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) =>
        setIndex(Math.round(e.nativeEvent.contentOffset.x / width)),
    },
  );

  const finish = async () => {
    await markOnboardingSeen();
    // `atSlide` is the drop-off point: someone who skips on slide 1 was never
    // reached by the pitch, which is a different problem from skipping on 3.
    track('onboarding_complete', { atSlide: index + 1, skipped: !last });
    // Setup comes before the account on purpose: four taps of investment is a
    // better place to ask for an email than a cold form, and the answers shape
    // what Home shows the moment they land on it.
    router.replace('/setup');
  };

  const next = () => {
    if (last) return void finish();
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  // Back goes a slide at a time, and off the first slide returns to Welcome.
  // A swipe already does this, but not everyone reaches for a swipe, and
  // someone who tapped "Get started" by accident needs a visible way out.
  const back = () => {
    if (index === 0) return void goBack('/welcome');
    scroller.current?.scrollTo({ x: (index - 1) * width, animated: true });
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <Pressable onPress={back} style={s.topButton} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
          <Text style={s.backGlyph}>‹</Text>
        </Pressable>
        {/* One filled segment per slide seen: it says how much is left, which
            three dots at the bottom of the screen do not. */}
        <View style={s.progress} accessibilityRole="progressbar"
              accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, i) => (
            <View key={slide.kicker} style={[s.progressSeg, i <= index && s.progressSegOn]} />
          ))}
        </View>
        <Pressable onPress={finish} style={s.topButton} accessibilityRole="button" accessibilityLabel="Skip" hitSlop={10}>
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={s.flex}
      >
        {SLIDES.map(({ Scene, ...slide }) => (
          <View key={slide.kicker} style={[s.slide, { width }]}>
            <Image source={slide.art} style={s.art} resizeMode="contain" accessibilityRole="image" accessibilityLabel="" />
            <Text style={s.kicker}>{slide.kicker}</Text>
            <Text style={s.title}>{slide.title}</Text>
            <Text style={s.body}>{slide.body}</Text>
            {/* The animated scene shows the mechanic the copy describes, and
                fills what was otherwise dead space at the bottom of the slide. */}
            <View style={s.scene}>
              <Scene />
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={s.footer}>
        <Button label={last ? 'Set up my path' : 'Next'} onPress={next} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, paddingTop: space.sm },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, paddingBottom: space.sm,
  },
  topButton: { minWidth: 44, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontFamily: font.black, fontSize: 30, lineHeight: 32, color: colors.ink },
  skipText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  progress: { flex: 1, flexDirection: 'row', gap: 5 },
  progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
  progressSegOn: { backgroundColor: colors.ink },
  slide: { alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.xl },
  art: { width: 132, height: 132, marginBottom: space.md },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.blueDeep },
  title: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    textAlign: 'center', letterSpacing: -0.6, marginTop: space.sm, lineHeight: type.title * 1.15,
  },
  body: {
    fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.md, lineHeight: 22,
  },
  scene: { marginTop: space.lg, alignItems: 'center', justifyContent: 'center', flex: 1 },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },
});
