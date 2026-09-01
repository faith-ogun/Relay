import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { getManifest } from '../services/curriculum';
import { componentImageUrl } from './assetUrl';
import { radius, curve } from '../theme/tokens';
import { duration } from '../theme/motion';
import { makeStyles } from '../theme/theme';

// ── The photographs of real parts that lessons point at ──
//
// 26 multiple_choice steps and 54 match steps address a photograph of a real
// component by a root-relative path: "/components/led.png". A browser resolves
// that against the document origin, so the web app has always been fine. A
// phone has no document origin, so the path resolved to nothing and mobile drew
// nothing: "Tap the LED" became four words, one of which was the word "LED".
//
// Three ways to give a phone those pictures, and why this is the one.
//
//   1. Bundle them. Metro cannot require a computed path, so it needs a static
//      registry, the pattern components/ChallengeArt.tsx already uses for its
//      painted scenes. It is the only option that needs no network at all, and
//      it is rejected on two counts: the 19 published files are 10 MB of
//      1254 x 1254 PNG, and a NEW component photograph could then only reach a
//      learner through an App Store review, which is precisely what serving the
//      curriculum from the backend exists to avoid.
//   2. Proxy them through live-bridge. Correct, and it costs an endpoint plus a
//      bearer token on every image request. The token rotates, the URL is the
//      cache key, so a rotating token means nothing ever stays cached and
//      offline replay dies with it.
//   3. Fetch them from the static origin they are already published to, and let
//      expo-image keep them on disk. That is this file. It is the same origin
//      the backend rewrites achievement art to (see `_absolute_art` in
//      backend/live-bridge/app/curriculum.py): public, CDN backed, no token, so
//      the URL is a stable cache key, and expo-image's disk cache is what makes
//      a lesson replay with no signal.
//
// The cost, stated plainly rather than buried: the FIRST time a learner meets a
// given photograph they need a connection, and each file is 170 KB to 1.1 MB
// because the published assets are 1254 x 1254 with no downscaled derivative to
// ask for. Resized WebP derivatives belong in the frontend's asset pipeline and
// would cut this by an order of magnitude; until they exist, ImageChoiceStep
// treats a picture that will not arrive as a first-class state rather than as a
// broken question.
//
// ── Why the content version is in the URL ──
//
// expo-image keys its disk cache by URL and does not revalidate within it, and
// underneath that iOS answers a repeat GET out of NSURLCache for as long as the
// response allows: Firebase Hosting serves these files with
// `Cache-Control: public, max-age=2592000`. Both layers are invisible from
// JavaScript. A photograph replaced at the same path would therefore keep
// serving its old bytes to any phone that already holds them, however correctly
// this code decided to refetch. That is the same failure src/services/
// curriculum.ts documents for lesson bodies, and it takes the same fix: address
// the content by its version, so a version change is a different URL and
// therefore a guaranteed miss in both caches.
//
// It cuts the other way too. The curriculum version moves for any lesson edit,
// not only for art, so a version bump costs a learner the photographs they meet
// after it: four pictures on the steps they actually reach, not the whole set.
// Serving a picture that no longer matches the lesson is the worse of the two.

// The addressing itself lives in assetUrl.ts, with no React and no native
// module in it, so the check script can transpile that file and exercise the
// real functions instead of grepping this one for a `?v=`.
export { ASSET_ORIGIN, componentImageUrl, isComponentImagePath } from './assetUrl';

// ── The content version, resolved once per app run ──
//
// The lesson body carries the version, but it arrives at the run shell and not
// at an individual step, and a step must not be handed a different URL for the
// same picture depending on which screen rendered it. The cached manifest is the
// device's single answer to "which content generation is this", and reading it
// is one AsyncStorage read: `getManifest` returns the cached copy immediately
// and refreshes behind it.

/** null means "asked, and the device has no manifest to answer with". */
export type AssetVersion = string | null;

let resolved: AssetVersion | undefined;
let inFlight: Promise<AssetVersion> | null = null;

function resolveVersion(): Promise<AssetVersion> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    let version: AssetVersion = null;
    try {
      version = (await getManifest())?.version ?? null;
    } catch {
      version = null;
    }
    resolved = version;
    // A null is "could not find out", not an answer, so the next step is allowed
    // to ask again and pick the version up as soon as a manifest lands.
    inFlight = null;
    return version;
  })();
  return inFlight;
}

/**
 * The version to address component art with. `undefined` while it is being
 * resolved, which is a real render state: emitting a bare URL first and a
 * versioned one a tick later would fetch every photograph twice.
 */
export function useAssetVersion(): AssetVersion | undefined {
  const [version, setVersion] = useState<AssetVersion | undefined>(
    typeof resolved === 'string' ? resolved : undefined,
  );

  useEffect(() => {
    if (typeof resolved === 'string') {
      setVersion(resolved);
      return;
    }
    let alive = true;
    void resolveVersion().then((v) => { if (alive) setVersion(v); });
    return () => { alive = false; };
  }, []);

  return version;
}

// ── The photograph itself ──

export type PhotoPhase = 'loading' | 'ready' | 'failed';

const Skeleton: React.FC = () => {
  const s = useS();
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.85, { duration: duration.fill }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[StyleSheet.absoluteFill, s.skeleton, style]} />;
};

/**
 * One component photograph, sized to its box and never cropped.
 *
 * Three states, all of them real: a pulsing plate while it is on its way, the
 * photograph once it has arrived, and an empty box of the same size when it
 * cannot be fetched, so nothing around it jumps. What a failure MEANS is the
 * caller's decision, which is why the phase is reported out: a match row simply
 * loses its thumbnail, while a picture question has lost its question and falls
 * back to words.
 *
 * Note on failures: Firebase Hosting rewrites an unmatched path to index.html
 * with a 200, so a photograph that is not published arrives as HTML rather than
 * as a 404. It fails to decode and lands here as an error either way.
 */
export const ComponentPhoto: React.FC<{
  /** Authored root-relative path, e.g. "/components/led.png". */
  path: string;
  height: number;
  /** Square thumbnails set this; option cards fill their card. */
  width?: number;
  /** Bump to re-attempt a fetch that failed. */
  attempt?: number;
  onPhase?: (phase: PhotoPhase) => void;
}> = ({ path, height, width, attempt = 0, onPhase }) => {
  const s = useS();
  const version = useAssetVersion();
  const url = version === undefined ? null : componentImageUrl(path, version);
  const [phase, setPhase] = useState<PhotoPhase>('loading');

  useEffect(() => { setPhase('loading'); }, [url, attempt]);

  // Held in a ref so a caller does not have to memoise the callback to avoid an
  // effect loop, which is the kind of trap that gets worked around with a
  // disabled lint rule.
  const report = useRef(onPhase);
  report.current = onPhase;
  useEffect(() => { report.current?.(phase); }, [phase]);

  return (
    <View style={[s.box, { height }, width === undefined ? null : { width }]}>
      {phase === 'loading' && <Skeleton />}
      {!!url && phase !== 'failed' && (
        <Image
          key={`${url}#${attempt}`}
          source={url}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          // What makes a lesson replay with no signal.
          cachePolicy="memory-disk"
          transition={duration.snappy}
          onLoad={() => setPhase('ready')}
          onError={() => setPhase('failed')}
        />
      )}
    </View>
  );
};

const useS = makeStyles((colors) => ({
  box: { width: '100%', overflow: 'hidden', borderRadius: radius.sm, ...curve },
  skeleton: { backgroundColor: colors.inkFaint, borderRadius: radius.sm, ...curve },
}));
