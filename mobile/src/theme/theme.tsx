import React, {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';
import { Appearance, StyleSheet } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type Colors } from './tokens';
import { alpha, depthFor, type Depth } from './elevation';

// ── Dark mode ──
//
// The problem this file exists to solve is not the palette. It is that
// `StyleSheet.create` runs ONCE, at module import, and captures whatever colour
// was current at that moment. Sixty-nine module-scope stylesheets held 1,554
// baked-in colours, so a `colors` object that merely mutated would have changed
// nothing on screen: the styles were already built.
//
// So a stylesheet has to be a FUNCTION of the theme, and something has to call
// it again when the theme changes. That is `makeStyles`:
//
//     const useStyles = makeStyles((colors, th) => ({
//       card: { backgroundColor: colors.surface, ...th.elevation.card },
//     }));
//
//     function Card() {
//       const s = useStyles();
//       return <View style={s.card} />;
//     }
//
// Two arguments rather than one because a shadow is a colour too. `colors` is
// the palette, and naming it that is what let 1,554 existing `colors.x`
// references move into the factory untouched; `th` carries the depth tokens,
// which have to follow the theme for the same reason the fills do.

export type ThemeMode = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

/** Where the chosen mode lives on the device. */
export const APPEARANCE_KEY = 'ohmlet.appearance.v1';

export interface Theme extends Depth {
  /** What the learner chose. `system` is a choice, and it is the default. */
  mode: ThemeMode;
  /** What that resolves to right now, after the device is consulted. */
  scheme: Scheme;
  colors: Colors;
}

interface ThemeApi extends Theme {
  setMode: (mode: ThemeMode) => void;
}

const deviceScheme = (): Scheme => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

/**
 * Both resolved themes, built once at import.
 *
 * There are exactly two, they are pure functions of the palette, and building
 * them eagerly means switching themes never allocates: it swaps one object
 * reference, and every `makeStyles` cache below is already warm from the first
 * time that stylesheet was asked for in that theme.
 */
const THEMES: Record<Scheme, Theme> = {
  light: { mode: 'system', scheme: 'light', colors: lightColors, ...depthFor(lightColors, 'light') },
  dark: { mode: 'system', scheme: 'dark', colors: darkColors, ...depthFor(darkColors, 'dark') },
};

/** The resolved theme for a scheme, for the rare caller outside React. */
export const themeFor = (scheme: Scheme): Theme => THEMES[scheme];

// Light is the fallback for a component rendered outside the provider — a
// storybook, a test, a screen mounted before the root layout. It is never what
// the app itself uses, because `ThemeProvider` wraps the whole router.
const ThemeContext = createContext<ThemeApi>({
  ...THEMES.light,
  setMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [device, setDevice] = useState<Scheme>(deviceScheme);
  const [loaded, setLoaded] = useState(false);

  // The stored value is the MODE, never the resolved colour. Writing "dark"
  // because the phone happened to be dark when the choice was made strands the
  // app in dark for someone who has since moved their phone back to light, and
  // then no amount of changing the OS setting gets them out of it.
  useEffect(() => {
    let alive = true;
    const done = (m?: ThemeMode) => {
      if (!alive) return;
      if (m) setModeState(m);
      setLoaded(true);
    };
    AsyncStorage.getItem(APPEARANCE_KEY)
      .then((v) => done(v === 'light' || v === 'dark' || v === 'system' ? v : undefined))
      .catch(() => done());
    // Storage that never settles must not brick the app behind a blank screen:
    // after a second, go with the device and carry on.
    const bail = setTimeout(() => done(), 1000);
    return () => { alive = false; clearTimeout(bail); };
  }, []);

  // Followed at all times, not only while on `system`. Someone can be on an
  // explicit theme, flip the OS in Control Centre, then switch back to System,
  // and the answer has to already be right when they do.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setDevice(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const scheme: Scheme = mode === 'system' ? device : mode;

  const value = useMemo<ThemeApi>(() => ({
    ...THEMES[scheme],
    mode,
    setMode: (next: ThemeMode) => {
      setModeState(next);
      AsyncStorage.setItem(APPEARANCE_KEY, next).catch(() => {
        /* storage blocked: the choice holds for this launch, which is the
           harmless direction to fail in */
      });
    },
  }), [scheme, mode]);

  // Nothing renders until the stored choice is known. The splash screen is still
  // up at this point — the root layout only hides it once fonts AND this have
  // settled — so the alternative is not a faster first paint, it is a light app
  // that flashes to dark a frame later.
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/** The whole theme: mode, scheme, palette, depth, and the setter. */
export const useTheme = (): ThemeApi => useContext(ThemeContext);

/** Just the palette, for a colour passed as a prop rather than set in a style. */
export const useColors = (): Colors => useContext(ThemeContext).colors;

/**
 * A palette colour at partial opacity.
 *
 * `withAlpha(colors.gold, 0.16)` rather than `rgba(250,204,46,0.16)`: the second
 * one is a copy of the brand that no longer changes when the brand does, and it
 * is invisible to every check that looks at the palette.
 */
export const withAlpha = (color: string, a: number): string => alpha(color, a);

/** Just the resolved scheme, for the handful of places that branch on it. */
export const useScheme = (): Scheme => useContext(ThemeContext).scheme;

// Mirrors React Native's own `StyleSheet.create` signature. The open index
// half is what lets a plain object literal infer its exact key set instead of
// collapsing to a bag of unknown names.
type AnyStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Turn a stylesheet into a hook that follows the theme.
 *
 * Called at module scope exactly where `StyleSheet.create` used to be, so the
 * shape of every file is unchanged; the difference is that the sheet is now
 * built per theme, on first use, and cached forever after. There are two
 * themes, so a given factory runs at most twice for the life of the process and
 * a re-render costs one `Map.get`.
 */
export function makeStyles<T extends NamedStyles<T> | AnyStyles>(
  build: (colors: Colors, th: Theme) => T & AnyStyles,
): () => T {
  const cache = new Map<Scheme, T>();
  return function useStyles(): T {
    const scheme = useScheme();
    let sheet = cache.get(scheme);
    if (!sheet) {
      const theme = THEMES[scheme];
      sheet = StyleSheet.create(build(theme.colors, theme));
      cache.set(scheme, sheet);
    }
    return sheet;
  };
}
