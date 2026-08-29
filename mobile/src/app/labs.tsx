import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Close } from '../components/icons';
import { Button } from '../components/Button';
import { FilmPlayer } from '../components/FilmPlayer';
import { fetchLabs, type LabsStatus } from '../services/labs';
import { getManifest, type Manifest } from '../services/curriculum';
import { goBack } from '../services/nav';
import { colors, curve, font, radius, space, type } from '../theme/tokens';
import { elevation } from '../theme/elevation';

/**
 * Ohmlet Labs.
 *
 * The Max tier has promised "early access to Ohmlet Labs" for a while with
 * nothing behind it. This is the thing itself: features that work but are not
 * finished, switched on early for the people paying most, and graduating to
 * everyone once they hold up.
 *
 * Two states, and the second one matters as much as the first. A learner WITHOUT
 * early access still gets a populated screen showing what is in Labs and what it
 * costs to get in. An empty screen reads as broken, and hiding the thing you are
 * selling is a strange way to sell it.
 */

export default function Labs() {
  const [status, setStatus] = useState<LabsStatus | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<{ skillId: string; title: string } | null>(null);

  const load = useCallback(async () => {
    const [labs, m] = await Promise.all([fetchLabs(), getManifest()]);
    if (labs.ok) setStatus(labs.data);
    setManifest(m);
  }, []);

  useEffect(() => { void load().finally(() => setLoading(false)); }, [load]);

  const filmsOn = !!status?.labs.some((l) => l.id === 'lesson-films');

  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <View style={s.head}>
        <Pressable onPress={() => goBack('/profile')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Close size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>OHMLET</Text>
          <Text style={s.title}>Labs</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.intro}>
          Features that work but are not finished. Max gets them first, and they
          open to everyone once they hold up.
        </Text>

        {status?.labs.map((lab) => (
          <View key={lab.id} style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>{lab.title}</Text>
              {lab.earlyAccess && (
                <View style={s.badge}><Text style={s.badgeText}>EARLY ACCESS</Text></View>
              )}
            </View>
            <Text style={s.cardBlurb}>{lab.blurb}</Text>
            {/* Always shown. Early access to a rough feature is only a privilege
                if you are told which part is rough. */}
            <View style={s.rough}>
              <Text style={s.roughLabel}>STILL ROUGH</Text>
              <Text style={s.roughText}>{lab.rough}</Text>
            </View>
          </View>
        ))}

        {status?.comingToEveryone.map((lab) => (
          <View key={lab.id} style={[s.card, s.cardLocked]}>
            <View style={s.cardHead}>
              <Text style={[s.cardTitle, { color: colors.inkSoft }]}>{lab.title}</Text>
              <View style={[s.badge, s.badgeLocked]}><Text style={s.badgeText}>MAX</Text></View>
            </View>
            <Text style={s.cardBlurb}>{lab.blurb}</Text>
            <Button label="See Max" variant="secondary" onPress={() => router.push('/plans')} />
          </View>
        ))}

        {filmsOn && manifest && (
          <>
            <Text style={s.section}>THE FILMS</Text>
            {manifest.units.map((unit) => {
              const skills = unit.skills.filter((sk) => sk.hasFilm);
              if (!skills.length) return null;
              return (
                <View key={unit.id} style={s.unit}>
                  <Text style={s.unitTitle}>{unit.title}</Text>
                  {skills.map((sk) => (
                    <Pressable
                      key={sk.id}
                      onPress={() => setPlaying({ skillId: sk.id, title: sk.title })}
                      style={({ pressed }) => [s.film, pressed && s.filmDown]}
                      accessibilityRole="button"
                      accessibilityLabel={`Play the film for ${sk.title}`}
                    >
                      <View style={s.play}>
                        <View style={s.playTriangle} />
                      </View>
                      <Text style={s.filmTitle} numberOfLines={1}>{sk.title}</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </>
        )}

        {!status && (
          <Text style={s.intro}>Labs could not be reached. Pull back and try again.</Text>
        )}
      </ScrollView>

      <Modal visible={!!playing} animationType="slide" onRequestClose={() => setPlaying(null)}>
        {playing && (
          <FilmPlayer skillId={playing.skillId} title={playing.title} onClose={() => setPlaying(null)} />
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm,
  },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkMute },
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, letterSpacing: -1 },
  scroll: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  intro: {
    fontFamily: font.bold, fontSize: type.label, color: colors.inkSoft,
    lineHeight: 22, marginBottom: space.sm,
  },

  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, ...curve,
    borderWidth: 2.5, borderColor: colors.ink, padding: space.lg,
    gap: space.sm, ...elevation.card,
  },
  cardLocked: { borderColor: colors.line, backgroundColor: colors.cream },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { flex: 1, fontFamily: font.black, fontSize: type.heading, color: colors.ink, letterSpacing: -0.5 },
  badge: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink,
  },
  badgeLocked: { backgroundColor: colors.inkFaint, borderColor: colors.inkMute },
  badgeText: { fontFamily: font.black, fontSize: 9, letterSpacing: 1.2, color: colors.ink },
  cardBlurb: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, lineHeight: 20 },

  rough: {
    backgroundColor: colors.goldSoft, borderRadius: radius.sm, ...curve,
    borderWidth: 2, borderColor: colors.goldPlate, padding: space.sm, gap: 2,
  },
  roughLabel: { fontFamily: font.black, fontSize: 9, letterSpacing: 1.4, color: colors.goldText },
  roughText: { fontFamily: font.semibold, fontSize: type.meta, color: colors.ink, lineHeight: 16 },

  section: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5,
    color: colors.inkMute, marginTop: space.lg,
  },
  unit: { gap: 6 },
  unitTitle: { fontFamily: font.black, fontSize: type.label, color: colors.ink, marginTop: space.sm },
  film: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.white, borderRadius: radius.md, ...curve,
    borderWidth: 2, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: 12,
  },
  filmDown: { transform: [{ translateY: 2 }], borderColor: colors.ink },
  play: {
    width: 30, height: 30, borderRadius: 999, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  // A drawn triangle, not a glyph: a text play symbol inherits the font and
  // sits off-centre in a circle.
  playTriangle: {
    width: 0, height: 0, marginLeft: 3,
    borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: colors.white,
  },
  filmTitle: { flex: 1, fontFamily: font.bold, fontSize: type.label, color: colors.ink },
});
