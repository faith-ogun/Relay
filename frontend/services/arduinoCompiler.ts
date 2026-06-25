// ── Arduino compile-service client (#73) ──
//
// Posts the learner's sketch to the compile service (avr-gcc), gets back an
// Intel-HEX firmware image (or compile errors) that the browser runs on AVR8js.
// Authed: the server derives the user from the verified Firebase token.

import { getIdToken } from './firebase';

const apiBase = () =>
  (import.meta.env.VITE_OHMLET_COMPILER_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const compilerConfigured = () => !!apiBase();

export type CompileDiagnostic = { line: number | null; message: string };
export type CompileResult = {
  ok: boolean;
  hex?: string;
  text_bytes?: number;
  data_bytes?: number;
  errors: CompileDiagnostic[];
};

export class CompilerError extends Error {
  retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'CompilerError';
    this.retryable = retryable;
  }
}

export async function compileSketch(source: string): Promise<CompileResult> {
  const base = apiBase();
  if (!base) throw new CompilerError('The Arduino compiler is not available right now.');
  const token = await getIdToken();
  if (!token) throw new CompilerError('Please sign in to compile and run code.');

  let res: Response;
  try {
    res = await fetch(`${base}/v1/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source }),
    });
  } catch {
    throw new CompilerError('Could not reach the compiler. Check your connection and try again.', true);
  }

  if (res.status === 503) throw new CompilerError('The compiler is busy right now. Try again in a moment.', true);
  if (res.status === 408) throw new CompilerError('Your sketch took too long to compile. Simplify it and try again.');
  if (res.status === 413) throw new CompilerError('That sketch is too large.');
  if (res.status === 401) throw new CompilerError('Please sign in to compile and run code.');
  if (!res.ok) throw new CompilerError('The compiler hit a snag. Please try again.', true);

  return (await res.json()) as CompileResult;
}
