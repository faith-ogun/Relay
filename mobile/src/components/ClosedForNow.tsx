import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { goBack } from '../services/nav';
import { font, space, type } from '../theme/tokens';
import { makeStyles } from '../theme/theme';

/**
 * Shown when a surface is closed to this account rather than missing or broken.
 *
 * Deliberately explains WHY. A screen that simply refuses reads as a bug and
 * sends people to support; a screen that says "this is closed while the account
 * belongs to someone under the age of consent" is a rule, and people accept
 * rules they can see.
 */
export const ClosedForNow: React.FC<{ title: string; body: string }> = ({ title, body }) => {
  const s = useS();
  return (
    <View style={s.screen}>
      <Pressable onPress={() => goBack('/home')} style={s.backLink} accessibilityRole="button">
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>
      <View style={s.body}>
        <Image
          source={require('../../assets/brand/mascot-point.png')}
          style={s.mascot}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel=""
        />
        <Text style={s.title}>{title}</Text>
        <Text style={s.text}>{body}</Text>
      </View>
    </View>
  );
};

const useS = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.cream, paddingTop: space.xxl, paddingHorizontal: space.lg },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.body, color: colors.blueDeep },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingBottom: space.xxl },
  mascot: { width: 130, height: 130 },
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, textAlign: 'center', letterSpacing: -0.5 },
  text: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', lineHeight: 23,
  },
}));
