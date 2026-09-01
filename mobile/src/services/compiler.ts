// ── Arduino compile service ──
//
// The phone does not compile: avr-gcc is a native toolchain and does not exist
// on iOS. The sketch goes to our compiler service, which returns Intel HEX that
// AVR8js then executes locally. So the simulation is on-device and offline-safe
// once compiled, but getting the firmware needs a connection.

import { COMPILER_BASE } from './config';
import { getIdToken } from './firebase';

export interface Diagnostic {
  line?: number | null;
  message: string;
}

export type CompileResult =
  | { ok: true; hex: string; flashBytes: number; ramBytes: number }
  | { ok: false; errors: Diagnostic[]; reason: 'compile' | 'offline' | 'unavailable' | 'auth' };

export const compilerConfigured = (): boolean => !!COMPILER_BASE;

export async function compileSketch(source: string): Promise<CompileResult> {
  if (!COMPILER_BASE) {
    return { ok: false, errors: [], reason: 'unavailable' };
  }
  const token = await getIdToken();
  if (!token) return { ok: false, errors: [], reason: 'auth' };

  try {
    const res = await fetch(`${COMPILER_BASE}/v1/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source }),
    });

    if (res.status === 503) {
      // The service sheds load behind a circuit breaker rather than queueing.
      return { ok: false, errors: [], reason: 'unavailable' };
    }
    if (!res.ok) return { ok: false, errors: [], reason: 'unavailable' };

    const data = await res.json();
    if (!data.ok || !data.hex) {
      return {
        ok: false,
        reason: 'compile',
        errors: Array.isArray(data.errors) ? data.errors : [],
      };
    }
    return {
      ok: true,
      hex: data.hex,
      flashBytes: data.text_bytes ?? 0,
      ramBytes: data.data_bytes ?? 0,
    };
  } catch {
    return { ok: false, errors: [], reason: 'offline' };
  }
}
