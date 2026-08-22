import React, { useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, NativeScrollEvent, NativeSyntheticEvent,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '../components/Button';
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
    kicker: 'IT SEES YOUR BENCH',
    title: 'Point your camera at the board.',
    body: 'The tutor checks your components before you wire anything, then watches the board as you build. A resistor in the wrong row gets caught while you are still holding it.',
  },
  {
    art: require('../../assets/brand/mascot-point.png'),
    kicker: 'IT TALKS BACK',
    title: 'Ask out loud, mid-build.',
    body: 'Voice guidance step by step. Ask why the circuit works while your hands are busy, and it writes and debugs the Arduino sketch with you.',
  },
  {
    art: require('../../assets/brand/mascot-celebrate.png'),
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
    router.replace('/sign-in');
  };

  const next = () => {
    if (last) return void finish();
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  return (
    <View style={s.screen}>
      <Pressable onPress={finish} style={s.skip} accessibilityRole="button" accessibilityLabel="Skip">
        <Text style={s.skipText}>Skip</Text>
      </Pressable>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={s.flex}
      >
        {SLIDES.map((slide) => (
          <View key={slide.kicker} style={[s.slide, { width }]}>
            <Image source={slide.art} style={s.art} resizeMode="contain" accessibilityRole="image" accessibilityLabel="" />
            <Text style={s.kicker}>{slide.kicker}</Text>
            <Text style={s.title}>{slide.title}</Text>
            <Text style={s.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.footer}>
        <View style={s.dots} accessibilityRole="progressbar" accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, i) => {
            const active = i === index;
            return <View key={slide.kicker} style={[s.dot, active ? s.dotActive : null]} />;
          })}
        </View>
        <Button label={last ? 'Create my account' : 'Next'} onPress={next} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, paddingTop: space.xxl * 1.2 },
  flex: { flex: 1 },
  skip: { position: 'absolute', top: space.xxl * 1.3, right: space.lg, zIndex: 10, padding: space.sm },
  skipText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  slide: { alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.xl },
  art: { width: 190, height: 190, marginBottom: space.lg },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.blueDeep },
  title: {
    fontFamily: font.black, fontSize: type.title, color: colors.ink,
    textAlign: 'center', letterSpacing: -0.6, marginTop: space.sm, lineHeight: type.title * 1.15,
  },
  body: {
    fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.md, lineHeight: 22,
  },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: space.xs },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line,
    borderWidth: 1.5, borderColor: colors.line,
  },
  dotActive: { width: 26, backgroundColor: colors.gold, borderColor: colors.ink },
});
