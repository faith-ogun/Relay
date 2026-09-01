import { useEffect } from 'react';

// ── useBodyScrollLock ──
//
// One primitive for "the page behind this overlay must not move".
//
// Getting this right is fiddly enough that every overlay in the app should share
// it rather than each doing `document.body.style.overflow = 'hidden'`:
//
//   1. Reference counted. Two overlays can be open at once (a confirm on top of
//      an editor); the page stays locked until the LAST one closes, and the
//      original inline styles are restored, not guessed at.
//   2. Scrollbar compensation. Hiding overflow removes the classic desktop
//      scrollbar, which widens the viewport and jolts the whole layout sideways.
//      We add the reclaimed width back as body padding, and publish it as
//      `--ohmlet-scrollbar-gap` so a pinned element can compensate too.
//   3. Correct scroller. The viewport's scrolling comes from <html>, and only
//      falls through to <body> when <html> computes to `overflow: visible`. We
//      lock whichever one actually owns it.
//   4. iOS. Safari on iPhone/iPad ignores `overflow: hidden` on the body and
//      happily rubber-bands the page behind the overlay, so there we pin the
//      body with `position: fixed` and a negative `top` offset instead.
//   5. Exact restoration. The pinned-body trick resets the scroll position to
//      zero, and a programmatic scroll (focusing something, an anchor) can move
//      the page even while locked. On release we put the scroll offset back
//      exactly where it was, with smooth scrolling temporarily off so the
//      correction is invisible.

interface LockSnapshot {
  scrollX: number;
  scrollY: number;
  /** The element whose `overflow` we hid: <html> or <body>. */
  target: HTMLElement;
  targetOverflow: string;
  bodyPaddingRight: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  scrollbarGapVar: string;
}

const SCROLLBAR_GAP_VAR = '--ohmlet-scrollbar-gap';

let lockCount = 0;
let snapshot: LockSnapshot | null = null;

/** iOS and iPadOS, where `overflow: hidden` on the body does not hold. */
function needsPinnedBody(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports a desktop Safari user agent, so fall back to touch.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

function acquire(): void {
  lockCount += 1;
  if (lockCount > 1 || typeof document === 'undefined') return;

  const doc = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const pinBody = needsPinnedBody();
  const htmlOverflowY = window.getComputedStyle(doc).overflowY;
  const target = pinBody || htmlOverflowY === 'visible' ? body : doc;

  snapshot = {
    scrollX,
    scrollY,
    target,
    targetOverflow: target.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    scrollbarGapVar: doc.style.getPropertyValue(SCROLLBAR_GAP_VAR),
  };

  // Width of the scrollbar that is about to disappear. Zero on overlay-scrollbar
  // platforms (macOS trackpad, mobile), which is exactly what we want.
  const gap = Math.max(0, window.innerWidth - doc.clientWidth);
  if (gap > 0) {
    const currentPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${currentPadding + gap}px`;
  }
  doc.style.setProperty(SCROLLBAR_GAP_VAR, `${gap}px`);

  if (pinBody) {
    body.style.position = 'fixed';
    body.style.top = `${-scrollY}px`;
    body.style.left = `${-scrollX}px`;
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
  } else {
    target.style.overflow = 'hidden';
  }
}

function release(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  const snap = snapshot;
  snapshot = null;
  if (!snap || typeof document === 'undefined') return;

  const doc = document.documentElement;
  const body = document.body;

  snap.target.style.overflow = snap.targetOverflow;
  body.style.paddingRight = snap.bodyPaddingRight;
  body.style.position = snap.bodyPosition;
  body.style.top = snap.bodyTop;
  body.style.left = snap.bodyLeft;
  body.style.right = snap.bodyRight;
  body.style.width = snap.bodyWidth;
  if (snap.scrollbarGapVar) doc.style.setProperty(SCROLLBAR_GAP_VAR, snap.scrollbarGapVar);
  else doc.style.removeProperty(SCROLLBAR_GAP_VAR);

  if (window.scrollX !== snap.scrollX || window.scrollY !== snap.scrollY) {
    const previousBehavior = doc.style.scrollBehavior;
    doc.style.scrollBehavior = 'auto';
    window.scrollTo(snap.scrollX, snap.scrollY);
    doc.style.scrollBehavior = previousBehavior;
  }
}

/**
 * Freeze page scrolling while an overlay is mounted.
 *
 * Call it from the overlay component, above any hook that moves focus, so the
 * page is already pinned before anything can scroll it.
 *
 * @param active set false to keep the hook mounted without holding the lock.
 */
export function useBodyScrollLock(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    acquire();
    return release;
  }, [active]);
}

export default useBodyScrollLock;
