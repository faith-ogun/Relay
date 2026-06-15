import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import { TOUR_STEPS } from '../data/tour';
import type { AppTab } from '../types';

type SpotlightRect = { top: number; left: number; width: number; height: number };

/**
 * Onboarding tour: spotlight positioning, step navigation, keyboard control,
 * and smart popover placement. Self-contained except for the active-tab pair,
 * which it needs to switch tabs when a step targets a different tab.
 */
export function useTour(activeTab: AppTab, setActiveTab: (tab: AppTab) => void) {
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const measureTarget = useCallback((target: string) => {
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el) { setSpotlightRect(null); return; }
    const rect = el.getBoundingClientRect();
    const pad = 8;
    // Cap height so huge elements (like library grid) don't push popover off screen
    const maxH = window.innerHeight * 0.5;
    setSpotlightRect({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: Math.min(rect.height + pad * 2, maxH),
    });
  }, []);

  useEffect(() => {
    if (!tourOpen) { setSpotlightRect(null); return; }
    const step = TOUR_STEPS[tourStep];
    if (!step) return;

    // Switch tab if the step requires it
    if (step.tab && step.tab !== activeTab) {
      setActiveTab(step.tab);
    }

    // Single short delay to let tab render, then measure
    const timer = requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        // Measure immediately after scroll
        requestAnimationFrame(() => measureTarget(step.target));
      }, 50);
    });

    return () => cancelAnimationFrame(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, tourStep, activeTab, measureTarget]);

  // Recalculate spotlight on resize
  useEffect(() => {
    if (!tourOpen) return;
    const recalc = () => measureTarget(TOUR_STEPS[tourStep]?.target);
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [tourOpen, tourStep, measureTarget]);

  const advanceTour = useCallback(() => {
    setTourStep((prev) => {
      if (prev < TOUR_STEPS.length - 1) return prev + 1;
      setTourOpen(false);
      return prev;
    });
  }, []);

  const retreatTour = useCallback(() => {
    setTourStep((prev) => Math.max(0, prev - 1));
  }, []);

  // Keyboard navigation for tour
  useEffect(() => {
    if (!tourOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTourOpen(false);
      if (e.key === 'ArrowRight' || e.key === 'Enter') advanceTour();
      if (e.key === 'ArrowLeft') retreatTour();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourOpen, advanceTour, retreatTour]);

  // Compute popover position — smart flip if it would go off screen
  const getPopoverStyle = (): React.CSSProperties => {
    if (!spotlightRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const step = TOUR_STEPS[tourStep];
    const gap = 12;
    const popW = 320;
    const popH = 210;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;

    // Try preferred position, flip if it doesn't fit
    let pos = step.position;
    const spaceBottom = vh - (spotlightRect.top + spotlightRect.height);
    const spaceTop = spotlightRect.top;
    const spaceRight = vw - (spotlightRect.left + spotlightRect.width);
    const spaceLeft = spotlightRect.left;

    if (pos === 'bottom' && spaceBottom < popH + gap) pos = spaceTop > popH + gap ? 'top' : 'right';
    if (pos === 'top' && spaceTop < popH + gap) pos = spaceBottom > popH + gap ? 'bottom' : 'right';
    if (pos === 'right' && spaceRight < popW + gap) pos = spaceLeft > popW + gap ? 'left' : 'bottom';
    if (pos === 'left' && spaceLeft < popW + gap) pos = spaceRight > popW + gap ? 'right' : 'bottom';

    const clampX = (x: number) => Math.max(margin, Math.min(vw - popW - margin, x));
    const clampY = (y: number) => Math.max(margin, Math.min(vh - popH - margin, y));

    switch (pos) {
      case 'bottom':
        return { top: clampY(spotlightRect.top + spotlightRect.height + gap), left: clampX(spotlightRect.left + spotlightRect.width / 2 - popW / 2) };
      case 'top':
        return { top: clampY(spotlightRect.top - popH - gap), left: clampX(spotlightRect.left + spotlightRect.width / 2 - popW / 2) };
      case 'right':
        return { top: clampY(spotlightRect.top + spotlightRect.height / 2 - popH / 2), left: clampX(spotlightRect.left + spotlightRect.width + gap) };
      case 'left':
        return { top: clampY(spotlightRect.top + spotlightRect.height / 2 - popH / 2), left: clampX(spotlightRect.left - popW - gap) };
      default:
        return { top: clampY(spotlightRect.top + spotlightRect.height + gap), left: clampX(spotlightRect.left) };
    }
  };

  return {
    tourOpen,
    setTourOpen,
    tourStep,
    setTourStep,
    spotlightRect,
    advanceTour,
    retreatTour,
    getPopoverStyle,
  };
}
