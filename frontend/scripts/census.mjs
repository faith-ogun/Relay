import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const { LESSON_CONTENT } = await server.ssrLoadModule('/components/ohmlet/data/lessons.ts');

// Families by what the user SEES on screen, not the type name.
const OPTION_PICKER = new Set(['multiple_choice', 'predict_behavior', 'predict_reading', 'choose_resistor']); // tap one of N text options
const BINARY = new Set(['true_false']); // tap one of two
const TYPED = new Set(['fill_blank']); // type a short answer
const INTERACTIVE = new Set(['match', 'drag_order', 'identify_component', 'spot_error', 'draw_connection', 'trace_current', 'fix_the_circuit', 'build_to_spec']); // drag/click-canvas/reorder

const lessons = Object.entries(LESSON_CONTENT);
let gradedTotal = 0, pickerTotal = 0, binaryTotal = 0, typedTotal = 0, interactiveTotal = 0, withImage = 0;
let under10 = 0, noInteractive = 0, noImage = 0, pickerMajority = 0;
const rows = [];

for (const [id, lesson] of lessons) {
  const steps = lesson.steps;
  const graded = steps.filter((s) => s.type !== 'teach');
  const picker = graded.filter((s) => OPTION_PICKER.has(s.type)).length;
  const binary = graded.filter((s) => BINARY.has(s.type)).length;
  const typed = graded.filter((s) => TYPED.has(s.type)).length;
  const interactive = graded.filter((s) => INTERACTIVE.has(s.type)).length;
  const imgs = graded.filter((s) => 'circuitDiagram' in s && s.circuitDiagram).length;

  gradedTotal += graded.length; pickerTotal += picker; binaryTotal += binary; typedTotal += typed; interactiveTotal += interactive; withImage += imgs;
  if (graded.length < 10) under10++;
  if (interactive === 0) noInteractive++;
  if (imgs === 0) noImage++;
  const pickerPlusBinary = picker + binary;
  if (pickerPlusBinary / graded.length > 0.6) pickerMajority++;
  rows.push({ id, graded: graded.length, picker, binary, typed, interactive, imgs });
}

const pct = (n) => `${((n / gradedTotal) * 100).toFixed(1)}%`;
console.log(`\nLESSONS: ${lessons.length}   GRADED STEPS: ${gradedTotal}   avg graded/lesson: ${(gradedTotal / lessons.length).toFixed(1)}\n`);
console.log('WHAT THE USER SEES (share of graded steps):');
console.log(`  option-picker (MC + predict_behavior + predict_reading + choose_resistor): ${pickerTotal}  ${pct(pickerTotal)}`);
console.log(`  binary true/false:                                                          ${binaryTotal}  ${pct(binaryTotal)}`);
console.log(`  typed fill-blank:                                                           ${typedTotal}  ${pct(typedTotal)}`);
console.log(`  ===> all tap/type, no canvas:                                               ${pickerTotal + binaryTotal + typedTotal}  ${pct(pickerTotal + binaryTotal + typedTotal)}`);
console.log(`  genuinely interactive (match/reorder/click-circuit/draw/trace/fix/build):   ${interactiveTotal}  ${pct(interactiveTotal)}`);
console.log(`\n  graded steps carrying a circuit image: ${withImage}  ${pct(withImage)}`);
console.log(`\nPER-LESSON RED FLAGS:`);
console.log(`  lessons with < 10 graded steps:        ${under10} / ${lessons.length}`);
console.log(`  lessons with ZERO interactive steps:   ${noInteractive} / ${lessons.length}`);
console.log(`  lessons with ZERO circuit images:      ${noImage} / ${lessons.length}`);
console.log(`  lessons where tap-pick+binary > 60%:   ${pickerMajority} / ${lessons.length}`);

await server.close();
