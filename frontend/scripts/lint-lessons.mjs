#!/usr/bin/env node
/**
 * Lesson linter CLI — `npm run lint:lessons`.
 *
 * Loads the real lesson data through Vite's module loader (so TypeScript and
 * extensionless imports resolve exactly as the app does — no extra tooling), runs
 * the shared lint rules from lessonSchema.ts, prints a report, and exits non-zero
 * if there are any errors. Warnings are shown but do not fail the build.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

async function main() {
  const server = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
  });

  try {
    const [{ LESSON_CONTENT }, { CURRICULUM }, { summarizeLint }] = await Promise.all([
      server.ssrLoadModule('/components/ohmlet/data/lessons.ts'),
      server.ssrLoadModule('/components/ohmlet/data/curriculum.ts'),
      server.ssrLoadModule('/components/ohmlet/data/lessonSchema.ts'),
    ]);

    const { problems, errorCount, warnCount, lessonsWithErrors, ok } = summarizeLint(LESSON_CONTENT, CURRICULUM);
    const lessonCount = Object.keys(LESSON_CONTENT).length;

    // Group by lesson, errors first.
    const byLesson = new Map();
    for (const p of problems) {
      if (!byLesson.has(p.lessonId)) byLesson.set(p.lessonId, []);
      byLesson.get(p.lessonId).push(p);
    }

    console.log(c.bold(`\nLinting ${lessonCount} lessons…\n`));

    if (problems.length === 0) {
      console.log(c.green('✓ No problems found.'));
    } else {
      for (const [lessonId, list] of byLesson) {
        const hasError = list.some((p) => p.severity === 'error');
        console.log(`${hasError ? c.red('✗') : c.yellow('!')} ${c.bold(lessonId)}`);
        for (const p of list.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))) {
          const tag = p.severity === 'error' ? c.red('error') : c.yellow('warn ');
          const where = p.stepIndex === null ? c.dim('(lesson)') : c.dim(`(step ${p.stepIndex}${p.stepType ? ` · ${p.stepType}` : ''})`);
          console.log(`    ${tag} ${where} ${p.message}`);
        }
      }
    }

    console.log(
      `\n${c.bold('Summary:')} ${errorCount ? c.red(`${errorCount} error(s)`) : c.green('0 errors')}, ` +
        `${warnCount ? c.yellow(`${warnCount} warning(s)`) : '0 warnings'}` +
        (lessonsWithErrors ? c.dim(` · ${lessonsWithErrors} lesson(s) with errors`) : '') +
        '\n',
    );

    await server.close();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    await server.close();
    console.error(c.red('Linter failed to run:'), err);
    process.exit(2);
  }
}

main();
