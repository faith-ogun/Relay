import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

/**
 * Lets an interactive surface stop the scroller it sits inside.
 *
 * Refusing the responder is not enough on iOS. Every gesture surface in the app
 * already sets `onPanResponderTerminationRequest: () => false` and the native
 * scroll view still wins: UIScrollView's pan recogniser competes at the UIKit
 * level, below the JS responder system, so a drag with any vertical component
 * scrolls the page AND drags the thing, which is worse than either alone.
 *
 * The only reliable answer is to switch the scroller off while a gesture is
 * live. A context rather than props because the surfaces are several levels down
 * and some of them are shared: threading a callback through every one would put
 * the same boilerplate in six places and guarantee somebody forgets it.
 */

interface ScrollLockValue {
  /** Called with true when a gesture starts and false when it ends. */
  setLocked: (locked: boolean) => void;
}

const Ctx = createContext<ScrollLockValue>({ setLocked: () => {} });

/** For a gesture surface: lock on grant, release on end AND on terminate. */
export function useScrollLock(): ScrollLockValue {
  return useContext(Ctx);
}

/**
 * A ScrollView that any descendant can pause.
 *
 * Drop-in replacement for ScrollView. Locking is reference counted so two
 * surfaces gesturing at once (a pinch that starts on one part and drifts onto
 * another) cannot leave the scroller stuck off when only one of them ends.
 */
export const LockableScrollView: React.FC<ScrollViewProps & { children: React.ReactNode }> = ({
  children, scrollEnabled = true, ...rest
}) => {
  const [locks, setLocks] = useState(0);

  const setLocked = useCallback((locked: boolean) => {
    setLocks((n) => Math.max(0, n + (locked ? 1 : -1)));
  }, []);

  const value = useMemo(() => ({ setLocked }), [setLocked]);

  return (
    <Ctx.Provider value={value}>
      <ScrollView {...rest} scrollEnabled={scrollEnabled && locks === 0}>
        {children}
      </ScrollView>
    </Ctx.Provider>
  );
};
