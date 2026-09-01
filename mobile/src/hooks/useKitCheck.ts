// The kit check, as a hook a camera screen can mount.
//
// Everything between "the learner taps scan" and "there is a verdict on screen"
// lives here: pull a still off the preview, size it for the service, call the
// vision-verifier, and hold one honest state machine for the screen to render.
// A screen that uses this needs a CameraView ref and nothing else.
//
// Mirrors the web's KitCheck in frontend/components/ohmlet/views/LiveTutorView.tsx,
// which does the same work inline. A hook rather than a component because the two
// things it drives want very different surfaces: the inventory stage of a live
// session, and identifying a single part someone is holding up.
//
// It is mounted on the Parts stage of app/live.tsx, which owns the CameraView ref
// this needs. `checkInventory` also needs the chosen build's parts list, which
// now comes from services/builds.ts: the library used to exist only inside the
// web bundle (frontend/components/ohmlet/data/library.ts), which is why the
// inventory half had nothing to ask a question about and this hook sat unmounted.
// `identify` has no such dependency and works against any frame on its own.

import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { CameraView } from 'expo-camera';
import {
  identifyComponent,
  verifierConfigured,
  verifyInventory,
  VerifierError,
  type IdentifiedComponent,
  type InventoryResult,
} from '../services/visionVerifier';

export type KitCheckPhase = 'idle' | 'capturing' | 'checking' | 'done' | 'error';

/** Which of the two checks is running, so a screen can word its progress and
 *  its retry for the thing the learner actually asked for. */
export type KitCheckIntent = 'inventory' | 'identify';

export interface KitCheckState {
  phase: KitCheckPhase;
  /** What the current or last run was asked to do; null before the first run. */
  intent: KitCheckIntent | null;
  /** Set once an inventory check has returned. */
  inventory: InventoryResult | null;
  /** Set once a single-component identification has returned. */
  component: IdentifiedComponent | null;
  /** Learner-safe message; only meaningful in the `error` phase. */
  error: string;
  /** Whether the last error is worth offering a retry for. */
  retryable: boolean;
  /** False when no verifier URL is configured, so the screen can hide the feature. */
  available: boolean;
  checkInventory: (expectedParts: string[], buildTitle?: string) => Promise<void>;
  identify: (hint?: string) => Promise<void>;
  /** Run the last request again with the same arguments. The screen offering
   *  "try again" should not have to remember what was asked for, and a screen
   *  that reconstructs the arguments can quietly retry something else. */
  retry: () => Promise<void>;
  reset: () => void;
}

// quality 0.5 matches the frame the live tutor already streams from this same
// preview. It keeps a bench photo comfortably inside the service's 6 MB cap
// while staying legible enough to read a resistor's colour bands.
const CAPTURE_QUALITY = 0.5;

export function useKitCheck(camera: RefObject<CameraView | null>): KitCheckState {
  const [phase, setPhase] = useState<KitCheckPhase>('idle');
  const [intent, setIntent] = useState<KitCheckIntent | null>(null);
  const [inventory, setInventory] = useState<InventoryResult | null>(null);
  const [component, setComponent] = useState<IdentifiedComponent | null>(null);
  const [error, setError] = useState('');
  const [retryable, setRetryable] = useState(false);

  // The last request, arguments and all, so a retry is the same question rather
  // than a reconstruction of it.
  const again = useRef<null | (() => Promise<void>)>(null);

  // A second tap while a check is in flight would capture a new frame, spend
  // another Vertex call, and race the first result onto the screen.
  const busy = useRef(false);

  const capture = useCallback(async (): Promise<string | null> => {
    try {
      const shot = await camera.current?.takePictureAsync({
        base64: true,
        quality: CAPTURE_QUALITY,
        skipProcessing: true,
        shutterSound: false,
      });
      return shot?.base64 ?? null;
    } catch {
      return null;
    }
  }, [camera]);

  const run = useCallback(
    async (call: (frame: string) => Promise<void>) => {
      if (busy.current) return;
      busy.current = true;
      setError('');
      setRetryable(false);
      setPhase('capturing');
      try {
        const frame = await capture();
        if (!frame) {
          setError('Turn the camera on and point it at your parts, then run the check.');
          setRetryable(true);
          setPhase('error');
          return;
        }
        setPhase('checking');
        await call(frame);
        setPhase('done');
      } catch (e) {
        const known = e instanceof VerifierError;
        setError(known ? e.message : "Couldn't check your kit just now. Please try again.");
        setRetryable(known ? e.retryable : true);
        setPhase('error');
      } finally {
        busy.current = false;
      }
    },
    [capture],
  );

  const checkInventory = useCallback(
    (expectedParts: string[], buildTitle?: string) => {
      const go = () => {
        setIntent('inventory');
        return run(async (frame) => {
          setComponent(null);
          setInventory(await verifyInventory(frame, expectedParts, buildTitle));
        });
      };
      again.current = go;
      return go();
    },
    [run],
  );

  const identify = useCallback(
    (hint?: string) => {
      const go = () => {
        setIntent('identify');
        return run(async (frame) => {
          setInventory(null);
          setComponent(await identifyComponent(frame, hint));
        });
      };
      again.current = go;
      return go();
    },
    [run],
  );

  const retry = useCallback(() => again.current?.() ?? Promise.resolve(), []);

  const reset = useCallback(() => {
    setPhase('idle');
    setIntent(null);
    setInventory(null);
    setComponent(null);
    setError('');
    setRetryable(false);
    again.current = null;
  }, []);

  return {
    phase,
    intent,
    inventory,
    component,
    error,
    retryable,
    available: verifierConfigured(),
    checkInventory,
    identify,
    retry,
    reset,
  };
}

// ── Handing the result to the live tutor ─────────────────────────────────────
//
// The point of the kit check is not the sheet: it is that the tutor's next
// sentence is about the bench the learner actually has. Both messages are
// written in the FIRST PERSON, because they are sent with `sendText`, which
// shows them as the learner's own line in the transcript, and because it is the
// learner's action that produced them. A machine-voiced status dump would read
// as something the learner said in a robot voice.

const list = (names: string[]): string => names.join(', ');

/** What the learner would say after checking their parts. */
export function inventoryHandoff(result: InventoryResult, buildTitle?: string): string {
  const pick = (status: string) =>
    result.parts.filter((p) => p.status === status).map((p) => p.name);
  const present = pick('present');
  const missing = pick('missing');
  const unsure = pick('unsure');

  const said = [
    `I checked my parts${buildTitle ? ` for the ${buildTitle}` : ''}.`,
    present.length ? `I have: ${list(present)}.` : 'None of the parts turned up in the photo.',
  ];
  if (missing.length) said.push(`I can't find: ${list(missing)}.`);
  if (unsure.length) said.push(`The camera wasn't sure about: ${list(unsure)}.`);
  if (result.found_extras.length) said.push(`There is also ${list(result.found_extras)} on the bench.`);
  said.push(
    result.ready
      ? 'Ready when you are.'
      : "Can we start anyway, or should I swap something in for what's missing?",
  );
  return said.join(' ');
}

/** What the learner would say after holding a part up to the camera. */
export function componentHandoff(component: IdentifiedComponent): string {
  const value = component.value ? ` (${component.value})` : '';
  return (
    `I held a part up to the camera and it came back as ${component.name}${value}. ` +
    'Where does it go in this build?'
  );
}
