import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Close } from './icons';
import { Button } from './Button';
import { fetchFilm, type FilmUrls } from '../services/labs';
import { font, space, type } from '../theme/tokens';
import { makeStyles, useColors } from '../theme/theme';

/**
 * A lesson film, played from a signed URL.
 *
 * The URL is fetched when the learner opens this and NEVER cached. It expires in
 * thirty minutes by design, and a cached signed URL is one that outlives the
 * reason it was short-lived. Re-opening a film re-signs it, which costs one
 * cheap request against a three minute video.
 *
 * The phone cut is used, not the web one: it is composed for a tall frame, with
 * the diagram sized for it and the captions where a thumb is not. Playing the
 * 16:9 cut on a phone would letterbox it into a strip.
 */
export const FilmPlayer: React.FC<{
  skillId: string;
  title: string;
  onClose: () => void;
}> = ({ skillId, title, onClose }) => {
  const colors = useColors();
  const s = useS();
  const [urls, setUrls] = useState<FilmUrls | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchFilm(skillId).then((r) => {
      if (!alive) return;
      if (r.ok) setUrls(r.data);
      else setFailure(
        r.reason === 'offline' || r.reason === 'timeout'
          ? 'A film needs a connection. It is not downloaded to your phone yet.'
          : r.reason === 'upgrade_required'
            ? 'Lesson films are in Ohmlet Labs, an early-access feature for Max.'
            : r.reason === 'not_found'
              ? 'There is no film for this skill yet.'
              : 'That film could not be loaded just now.',
      );
    });
    return () => { alive = false; };
  }, [skillId]);

  const player = useVideoPlayer(urls?.video.phone ?? null, (p) => {
    p.loop = false;
    p.play();
  });

  if (failure) {
    return (
      <View style={s.screen}>
        <Header title={title} onClose={onClose} />
        <View style={s.centre}>
          <Text style={s.failTitle}>Not right now</Text>
          <Text style={s.failBody}>{failure}</Text>
          <Button label="Back" onPress={onClose} style={{ marginTop: space.lg }} />
        </View>
      </View>
    );
  }

  if (!urls) {
    return (
      <View style={s.screen}>
        <Header title={title} onClose={onClose} />
        <View style={s.centre}>
          <ActivityIndicator color={colors.ink} />
          <Text style={s.failBody}>Getting the film</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header title={title} onClose={onClose} />
      <VideoView
        style={s.video}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
        nativeControls
        contentFit="contain"
      />
      <Text style={s.caption}>
        Captions are burned into the film, so it reads with the sound off.
      </Text>
    </View>
  );
};

/**
 * A film's own top bar, with its own safe-area padding.
 *
 * FilmPlayer is presented inside a <Modal>, and a Modal is a SEPARATE native
 * view hierarchy: it renders outside the root Shell in `app/_layout.tsx` and
 * therefore inherits none of that shell's `paddingTop: insets.top`. A fixed
 * padding was standing in for it, and 32 is smaller than the 59 a Dynamic
 * Island phone reserves, so the close button sat underneath the island and was
 * very hard to hit. Reported 2026-09-01.
 *
 * The identical bug was fixed once already, for the back button, which is what
 * the note in `_layout.tsx` is about. It came back here because a Modal escapes
 * the fix. `mobile/scripts/check-modal-insets.mjs` now fails on the pattern.
 *
 * `space.md` is added on top of the inset so the button is not flush against the
 * island, and a floor keeps it sane on a device that reports no inset at all.
 */
const Header: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => {
  const s = useS();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.head, { paddingTop: Math.max(insets.top, space.md) + space.md }]}>
      <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close film">
        <Close size={22} />
      </Pressable>
      <Text style={s.headTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
    );
};

const useS = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.slab },
  head: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingBottom: space.md,   // paddingTop is applied inline from the safe-area inset
    backgroundColor: colors.cream,
  },
  headTitle: { flex: 1, fontFamily: font.black, fontSize: type.label, color: colors.ink, textAlign: 'center' },
  video: { flex: 1, backgroundColor: colors.slab },
  caption: {
    fontFamily: font.semibold, fontSize: type.meta, color: colors.inkMute,
    textAlign: 'center', padding: space.md, backgroundColor: colors.cream,
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: colors.cream, padding: space.xl },
  failTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  failBody: {
    fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft,
    textAlign: 'center', lineHeight: 22, maxWidth: 320,
  },
}));
