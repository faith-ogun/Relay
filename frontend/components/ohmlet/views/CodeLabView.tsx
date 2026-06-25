import React, { Suspense, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Cpu, Loader2, Play, Square, Zap } from 'lucide-react';
import { AVRRunner, CYCLES_PER_MS } from '../sim/avr';
import { solve, toMA } from '../sim/engine';
import { compileSketch, compilerConfigured, CompilerError, type CompileDiagnostic } from '../../../services/arduinoCompiler';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

/**
 * CodeLabView (#73) — write a real Arduino sketch, run real firmware.
 *
 * The sketch is compiled by our avr-gcc service into an Intel-HEX image, then
 * executed cycle-accurately in the browser on AVR8js (MIT). The emulated Uno's
 * pins drive a simulated board: pin 13 + pin 9 LEDs (their on-state current is
 * solved by our engine), and a pushbutton on pin 2 the sketch can read.
 */

const DEFAULT_SKETCH = `// Blink — the "hello world" of hardware.
// Pin 13 has an LED. Pin 9 has a second LED. Pin 2 has a button.

void setup() {
  pinMode(13, OUTPUT);
  pinMode(9, OUTPUT);
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Ohmlet online");
}

void loop() {
  digitalWrite(13, HIGH);
  digitalWrite(9, digitalRead(2) == LOW); // press the button to light pin 9
  delay(400);
  digitalWrite(13, LOW);
  delay(400);
}
`;

// Real LED current when a pin drives it through 220 Ω at 5 V (solved, not assumed).
const ledMa = (() => { const r = solve([{ kind: 'V', id: 'v', pos: 1, neg: 0, value: 5 }, { kind: 'R', id: 'r', a: 1, b: 2, value: 220 }, { kind: 'LED', id: 'l', anode: 2, cathode: 0 }]); return toMA(r.I.l ?? 0); })();

type Status = 'idle' | 'compiling' | 'running' | 'error';

export const CodeLabView: React.FC = () => {
  const [code, setCode] = useState(DEFAULT_SKETCH);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<CompileDiagnostic[]>([]);
  const [message, setMessage] = useState<string>('');
  const [serial, setSerial] = useState('');
  const [led13, setLed13] = useState(false);
  const [led9, setLed9] = useState(false);
  const [pressed, setPressed] = useState(false);

  const runnerRef = useRef<AVRRunner | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const pressedRef = useRef(false);
  useEffect(() => { pressedRef.current = pressed; }, [pressed]);

  const stop = () => { cancelAnimationFrame(rafRef.current); runnerRef.current = null; setStatus((s) => (s === 'running' ? 'idle' : s)); setLed13(false); setLed9(false); };
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const run = async () => {
    if (status === 'running') { stop(); return; }
    if (!compilerConfigured()) { setStatus('error'); setMessage('The Arduino runtime is being set up. Check back shortly.'); return; }
    setStatus('compiling'); setErrors([]); setMessage(''); setSerial('');
    try {
      const res = await compileSketch(code);
      if (!res.ok || !res.hex) { setStatus('error'); setErrors(res.errors || []); setMessage(res.errors?.length ? '' : 'Compile failed.'); return; }
      const runner = new AVRRunner(res.hex);
      runnerRef.current = runner;
      setStatus('running');
      lastRef.current = performance.now();
      const loop = () => {
        const r = runnerRef.current;
        if (!r) return;
        const now = performance.now();
        const dtMs = Math.min(16, now - lastRef.current);
        lastRef.current = now;
        r.setInput('D', 2, !pressedRef.current); // pull-up: high = released
        r.runCycles(Math.round(CYCLES_PER_MS * dtMs));
        setLed13(r.isHigh('B', 5));
        setLed9(r.isHigh('B', 1));
        setSerial(r.serial);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof CompilerError ? e.message : 'Something went wrong compiling your sketch.');
    }
  };

  const running = status === 'running';

  return (
    <div className="ohmlet-rise">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Simulator · Arduino code</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">Run real code.</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-ink bg-ohmlet-gold px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-press-sm">
          <Zap className="h-3.5 w-3.5" /> Real AVR firmware
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm font-semibold text-ohmlet-ink-soft">
        Your sketch is compiled with the real Arduino toolchain and executed cycle-accurately on an emulated Uno. The pins drive the board below.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* editor */}
        <div className="overflow-hidden rounded-[1.6rem] border-[3px] border-ohmlet-ink bg-[#1e1e1e] shadow-press">
          <div className="flex items-center gap-2 border-b-2 border-black/40 bg-[#252526] px-3 py-2.5">
            <button onClick={run}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-ohmlet-ink px-3.5 text-xs font-black shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none ${running ? 'bg-ohmlet-red text-white' : 'bg-ohmlet-gold text-ohmlet-ink'}`}>
              {status === 'compiling' ? <Loader2 className="h-4 w-4 animate-spin" /> : running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {status === 'compiling' ? 'Compiling…' : running ? 'Stop' : 'Compile & Run'}
            </button>
            <span className="font-mono text-xs font-bold text-slate-400">sketch.ino</span>
          </div>
          <Suspense fallback={<div className="flex h-[360px] items-center justify-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
            <MonacoEditor height="360px" defaultLanguage="cpp" value={code} onChange={(v) => setCode(v ?? '')} theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, tabSize: 2, padding: { top: 12 } }} />
          </Suspense>
          {(errors.length > 0 || (status === 'error' && message)) && (
            <div className="max-h-32 overflow-auto border-t-2 border-black/40 bg-[#2d1416] px-4 py-2.5 font-mono text-xs text-[#ff8a7a]">
              {message && <div className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {message}</div>}
              {errors.map((e, i) => <div key={i}>{e.line ? `line ${e.line}: ` : ''}{e.message}</div>)}
            </div>
          )}
        </div>

        {/* board + serial */}
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-[1.6rem] border-[3px] border-ohmlet-ink bg-white shadow-press">
            <Board led13={led13} led9={led9} pressed={pressed} onPress={setPressed} running={running} />
            <div className="flex items-start gap-3 border-t-2 border-ohmlet-line bg-ohmlet-ink px-5 py-3.5 text-white">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ohmlet-gold"><Cpu className="h-4 w-4 text-ohmlet-ink" /></span>
              <p className="text-sm font-semibold leading-snug [&_b]:text-ohmlet-gold">
                {running ? <>Live. Pin 13 {led13 ? <>is <b>HIGH</b> — LED on at <b>{ledMa.toFixed(1)} mA</b></> : 'is LOW'}. Hold the button to pull pin 2 LOW.</>
                  : <>Hit <b>Compile &amp; Run</b> to build your sketch and watch the real firmware drive the board.</>}
              </p>
            </div>
          </div>
          <div className="rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-4 shadow-soft">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Serial monitor</h3>
            <pre className="mt-2 h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-ohmlet-ink px-3 py-2 font-mono text-xs leading-relaxed text-[#84cc30]">{serial || (running ? '' : '— nothing yet —')}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const Board: React.FC<{ led13: boolean; led9: boolean; pressed: boolean; onPress: (p: boolean) => void; running: boolean }> = ({ led13, led9, pressed, onPress, running }) => (
  <svg viewBox="0 0 480 260" className="block w-full"
    style={{ background: 'linear-gradient(0deg,rgba(20,32,30,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(20,32,30,.03) 1px,transparent 1px)', backgroundSize: '20px 20px' }}>
    {/* the board */}
    <rect x={40} y={70} width={400} height={130} rx={14} fill="#0c6b5e" stroke="#14201e" strokeWidth={2.5} />
    <rect x={56} y={86} width={70} height={44} rx={5} fill="#0a4a41" stroke="#083c35" strokeWidth={2} />
    <text x={91} y={112} textAnchor="middle" fontSize={11} fontWeight={800} fill="#cfe9e3">UNO</text>
    {/* pin-13 LED */}
    <g transform="translate(190,50)">
      <circle cx={0} cy={0} r={20} fill="#facc2e" opacity={led13 ? 0.85 : 0} />
      <circle cx={0} cy={0} r={11} fill={led13 ? '#ffe08a' : '#7c8b88'} stroke="#14201e" strokeWidth={2} />
      <line x1={0} y1={11} x2={0} y2={70} stroke="#14201e" strokeWidth={3} />
      <text x={0} y={-26} textAnchor="middle" fontSize={11} fontWeight={800} fill="#14201e">pin 13</text>
    </g>
    {/* pin-9 LED */}
    <g transform="translate(300,50)">
      <circle cx={0} cy={0} r={20} fill="#549cf0" opacity={led9 ? 0.8 : 0} />
      <circle cx={0} cy={0} r={11} fill={led9 ? '#bcd8fb' : '#7c8b88'} stroke="#14201e" strokeWidth={2} />
      <line x1={0} y1={11} x2={0} y2={70} stroke="#14201e" strokeWidth={3} />
      <text x={0} y={-26} textAnchor="middle" fontSize={11} fontWeight={800} fill="#14201e">pin 9</text>
    </g>
    {/* pin-2 button */}
    <g transform="translate(400,210)">
      <line x1={0} y1={-12} x2={0} y2={-60} stroke="#14201e" strokeWidth={3} />
      <text x={0} y={36} textAnchor="middle" fontSize={11} fontWeight={800} fill="#14201e">pin 2</text>
      <circle cx={0} cy={0} r={22} fill={pressed ? '#e8db11' : '#f1f5f9'} stroke="#14201e" strokeWidth={2.5} />
      <circle cx={0} cy={0} r={13} fill={pressed ? '#cbb800' : '#cdd6d3'} stroke="#14201e" strokeWidth={2} />
      <rect x={-26} y={-26} width={52} height={52} rx={10} fill="transparent" className="cursor-pointer"
        onMouseDown={() => onPress(true)} onMouseUp={() => onPress(false)} onMouseLeave={() => onPress(false)}
        onTouchStart={(e) => { e.preventDefault(); onPress(true); }} onTouchEnd={() => onPress(false)} />
    </g>
  </svg>
);
