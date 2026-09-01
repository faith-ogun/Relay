// The one place that knows which lesson films exist.
//
// Discovered from the directory rather than kept as a list, because the list
// was already wrong once: tts.mjs still pointed at src/lessons/ months after
// the scripts moved under src/lesson-film/. A directory cannot go stale.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(ROOT, 'src/lesson-film/lessons');

export async function allLessons() {
  const out = [];
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.ts')).sort()) {
    const mod = await import(join(DIR, f));
    const lesson = Object.values(mod).find((v) => v && typeof v === 'object' && Array.isArray(v.segments));
    if (!lesson) throw new Error(`${f} exports no LessonScript`);
    out.push(lesson);
  }
  return out;
}
