import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, font, type } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The brand moment before the app resolves where you belong.
 *
 * Duolingo and Mimo both hold a full-bleed brand screen for a beat on launch,
 * and it is most of why they read as established rather than assembled. Ohmlet
 * had a spinner on a cream field, which reads as a page still loading.
 *
 * One motion: the mascot rises and settles while a ring charges around it, then
 * the wordmark fades up. Nothing loops, because this screen is meant to end.
 */
export const BrandSplash: React.FC = () => {
  const rise = useRef(new Animated.Value(0)).current;
  const charge = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(rise, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        // NOT useNativeDriver: the legacy native driver animates transform and
        // opacity only, so a stroke property driven through it silently never
        // moves. This ring is the first animation in the app and it was dead.
        Animated.timing(charge, {
          toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
        }),
      ]),
      Animated.timing(word, {
        toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
    ]).start();
  }, [rise, charge, word]);

  const R = 92;
  const CIRC = 2 * Math.PI * R;

  return (
    <View style={s.screen}>
      <View style={s.centre}>
        {/* The ring charges once, like a capacitor filling. */}
        <Svg width={R * 2 + 16} height={R * 2 + 16} style={StyleSheet.absoluteFill}>
          <Circle
            cx={R + 8} cy={R + 8} r={R}
            stroke="rgba(10,10,10,0.10)" strokeWidth={5} fill="none"
          />
          <AnimatedCircle
            cx={R + 8} cy={R + 8} r={R}
            stroke={colors.ink} strokeWidth={5} fill="none" strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={charge.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] })}
            transform={`rotate(-90 ${R + 8} ${R + 8})`}
          />
        </Svg>

        <Animated.View
          style={{
            opacity: rise,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
              { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
            ],
          }}
        >
          <Image
            source={require('../../assets/brand/mascot-wave.png')}
            style={s.mascot}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Ohmlet"
          />
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          s.wordmark,
          {
            opacity: word,
            transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        OHMLET
      </Animated.Text>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  centre: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  mascot: { width: 132, height: 132 },
  wordmark: {
    position: 'absolute', bottom: 72,
    fontFamily: font.black, fontSize: type.heading, letterSpacing: 8, color: colors.ink,
  },
});
