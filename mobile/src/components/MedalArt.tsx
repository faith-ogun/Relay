import React, { useState } from 'react';
import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

/**
 * One achievement's card art, and the single failure path it is allowed.
 *
 * The catalogue serves an absolute URL per achievement and that painted card is
 * the reward. Two surfaces show it now: the trophy case on /achievements, and
 * the shelf on Profile, which used to draw the achievement's TITLE in a box
 * instead. Faith's words: "the achievements shouldn't show the icons that they
 * created, it should show the actual preview of the cards, because we already
 * have cards".
 *
 * It is a component rather than two copies of an `<Image>` because the failure
 * handling is the part that must not drift. A missing file or a dead network has
 * to leave the medal disc underneath visible rather than a hole, and a second
 * hand-rolled `onError` somewhere else is how one surface ends up degrading
 * gracefully while the other shows a grey square.
 *
 * `failed` holds the URL that failed rather than a boolean, so a catalogue
 * refresh that changes the art path gets a fresh attempt instead of being
 * permanently written off by a URL that no longer exists.
 */
export const MedalArt: React.FC<{
  /** The catalogue's absolute URL. Undefined for an achievement with no art. */
  art?: string;
  size: number;
  /** Present but drained, for a medal not yet earned. */
  dimmed?: boolean;
  style?: StyleProp<ImageStyle>;
}> = ({ art, size, dimmed, style }) => {
  const [failed, setFailed] = useState<string | null>(null);
  if (!art || failed === art) return null;
  return (
    <Image
      source={{ uri: art }}
      style={[{ width: size, height: size }, dimmed && DRAINED, style]}
      contentFit="contain"
      transition={180}
      cachePolicy="disk"
      onError={() => setFailed(art)}
      accessible={false}
    />
  );
};

/** Locked art is present but drained, so a case reads as gaps to fill rather
 *  than a wall of identical grey discs. */
const DRAINED = { opacity: 0.28 } as const;
