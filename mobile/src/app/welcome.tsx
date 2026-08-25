import React, { useCallback, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../components/Button';
import { CurrentLoopScene } from '../components/scenes/CurrentLoopScene';
import { colors, font, space, type } from '../theme/tokens';

/**
 * The front door. Before this, the app opened straight onto a login form, which
 * reads as a web page in a phone frame rather than an app. A first launch should
 * introduce the product before it asks for anything.
 *
 * One signature motion: a staggered rise, mascot first. Not twenty small wobbles.
 */
export default function Welcome() {
  const mascot = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;
  const scene = useRef(new Animated.Value(0)).current;
  const actions = useRef(new Animated.Value(0)).current;

  // Replayed on focus, not on mount: this screen is mounted while the router is
  // still deciding where to send you, so a mount-time entrance could play to an
  // audience of nobody and then sit finished.
  useFocusEffect(
    useCallback(() => {
      [mascot, copy, scene, actions].forEach((v) => v.setValue(0));
      Animated.stagger(110, [
      Animated.timing(mascot, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(copy, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scene, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(actions, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return () => undefined;
    }, [mascot, copy, scene, actions]),
  );

  const rise = (v: Animated.Value, distance = 24) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  });

  return (
    <View style={s.screen}>
      <View style={s.top}>
        <Animated.View style={rise(mascot, 34)}>
          <Image
            source={require('../../assets/brand/mascot-wave.png')}
            style={s.mascot}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="The Ohmlet mascot waving"
          />
        </Animated.View>

        <Animated.View style={[rise(copy), s.copyBlock]}>
          <Text style={s.wordmark}>OHMLET</Text>
          <Text style={s.headline}>Learn electronics by actually building it.</Text>
          <Text style={s.sub}>
            A live tutor that watches your breadboard through your camera, talks you through the
            wiring, and catches the mistake before you power anything on.
          </Text>
        </Animated.View>
      </View>

      {/* The screen's one continuous motion, and the first idea the curriculum
          teaches: one loop, one current, nothing used up along the way. */}
      <Animated.View style={[rise(scene), s.scene]}>
        <CurrentLoopScene />
        <Text style={s.sceneCaption}>ONE LOOP. ONE CURRENT.</Text>
      </Animated.View>

      <Animated.View style={[rise(actions), s.actions]}>
        <Button label="Get started" onPress={() => router.push('/onboarding')} />
        <Pressable
          onPress={() => router.push('/sign-in')}
          style={s.secondary}
          accessibilityRole="button"
          accessibilityLabel="I already have an account"
        >
          <Text style={s.secondaryText}>I already have an account</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: colors.cream,
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl,
    justifyContent: 'space-between',
  },
  top: { alignItems: 'center' },
  mascot: { width: 210, height: 210 },
  copyBlock: { alignItems: 'center', marginTop: space.md },
  wordmark: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 4,
    color: colors.inkSoft, marginBottom: space.sm,
  },
  headline: {
    fontFamily: font.black, fontSize: type.display, color: colors.ink,
    letterSpacing: -1, textAlign: 'center', lineHeight: type.display * 1.1,
  },
  sub: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', marginTop: space.md, lineHeight: 22, paddingHorizontal: space.sm,
  },
  scene: { alignItems: 'center', gap: space.xs },
  sceneCaption: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.4, color: colors.inkSoft,
  },
  actions: { gap: space.xs },
  secondary: { paddingVertical: space.md, alignItems: 'center' },
  secondaryText: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft },
});
