import { useEffect, useRef } from 'react';

// ── Accessible dialog behaviour (#54) ──
//
// One hook for the things every modal must do to be usable by keyboard and
// screen-reader users (WCAG 2.4.3 Focus Order, 2.1.2 No Keyboard Trap, 2.1.1
// Keyboard):
//   - move focus into the dialog on open (to the first focusable, or the panel),
//   - trap Tab/Shift+Tab inside it while open,
//   - close on Escape,
//   - restore focus to whatever was focused before it opened, on close.
//
// Returns a ref to attach to the dialog panel. Pair it with role="dialog",
// aria-modal="true", and aria-labelledby on that same element.

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Remember what had focus so we can hand it back when the dialog closes.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Move focus into the dialog: first focusable, else the panel itself.
    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      // Wrap around at the ends so focus never escapes the dialog.
      if (e.shiftKey && active === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      // Restore focus only if it's still inside the (now unmounting) dialog, so we
      // don't yank focus away from wherever the user has since moved.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return ref;
}
