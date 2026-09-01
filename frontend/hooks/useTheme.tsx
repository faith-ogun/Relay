import React, { useCallback, useEffect, useState } from 'react';

/**
 * Light, dark, or follow the device.
 *
 * `system` is the default and it is not a synonym for light: it reads
 * `prefers-color-scheme`, so a phone set to dark shows Ohmlet dark without the
 * learner choosing anything. That is the behaviour people expect from every
 * other app on the device, and an app that ignores it reads as broken rather
 * than as opinionated.
 *
 * The chosen mode is stored; the RESOLVED colour is not. Storing "dark" because
 * the device was dark last Tuesday would strand the page in dark after the
 * device went back to light.
 *
 * The mode is written onto a WRAPPER around the workspace, not onto <html>, so
 * the landing pages keep their light marketing palette whatever the learner
 * chooses. `ThemeScope` below is that wrapper.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_KEY = 'ohmlet-theme';

/** Read the stored choice. Any junk in storage means the default. */
export function storedMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';       // private mode, or storage blocked
  }
}


export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(storedMode);

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, mode); } catch { /* nothing to do */ }
  }, [mode]);

  // On `system`, follow the device live so `resolved` stays honest. The CSS does
  // not need this, because its media query re-evaluates by itself; the label in
  // the Appearance section does, and so does anything reading `resolved`.
  const [deviceDark, setDeviceDark] = useState(
    () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setDeviceDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /** What the workspace is actually showing, which `mode` alone cannot say. */
  const resolved: 'light' | 'dark' = mode === 'system' ? (deviceDark ? 'dark' : 'light') : mode;

  return { mode, resolved, setMode: useCallback((m: ThemeMode) => setMode(m), []) };
}

/**
 * The element that carries the theme. Everything inside it is themed; everything
 * outside stays on the light landing palette.
 *
 * It writes `system` through verbatim rather than resolving it, because the
 * stylesheet's media query is what should decide, and it re-evaluates itself
 * when the device changes without React needing to re-render at all.
 */
export const ThemeScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode } = useTheme();
  return (
    <div data-ohmlet-theme={mode} className="min-h-screen bg-ohmlet-canvas">
      {children}
    </div>
  );
};
