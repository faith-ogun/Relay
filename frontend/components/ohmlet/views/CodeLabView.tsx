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

const DEFAULT_SKETCH = `// Read the knob on A0, fade the LED on pin 9, and use the button.
// Pin 13 LED  ·  Pin 9 LED (PWM)  ·  A0 knob  ·  Pin 2 button

void setup() {
  pinMode(13, OUTPUT);
  pinMode(9, OUTPUT);          // pin 9 is PWM-capable
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  int knob = analogRead(A0);              // 0..1023 from the knob
  analogWrite(9, knob / 4);               // fade pin 9 (0..255)
  digitalWrite(13, digitalRead(2) == LOW); // hold the button to light pin 13
  Serial.println(knob);
  delay(30);
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
  const [bright9, setBright9] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [pot, setPot] = useState(512);

  const runnerRef = useRef<AVRRunner | null>(null);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);
  const pressedRef = useRef(false);
  const potRef = useRef(512);
  useEffect(() => { pressedRef.current = pressed; }, [pressed]);
  useEffect(() => { potRef.current = pot; }, [pot]);

  const stop = () => { cancelAnimationFrame(rafRef.current); runnerRef.current = null; setStatus((s) => (s === 'running' ? 'idle' : s)); setLed13(false); setBright9(0); };
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
        r.setInput('D', 2, !pressedRef.current);        // pull-up: high = released
        r.setAnalog(0, (potRef.current / 1023) * 5);     // A0 knob → voltage
        const [d13, d9] = r.runFrame(Math.round(CYCLES_PER_MS * dtMs), [['B', 5], ['B', 1]]);
        setLed13(d13 > 0.5);
        setBright9(d9);                                   // pin 9 duty = LED brightness
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
            <Board led13={led13} bright9={bright9} pressed={pressed} onPress={setPressed} pot={pot} />
            <div className="flex items-center gap-3 border-t-2 border-ohmlet-line bg-ohmlet-cream px-4 py-2.5">
              <span className="whitespace-nowrap text-xs font-black uppercase tracking-wide text-ohmlet-ink-soft">A0 knob</span>
              <input type="range" min={0} max={1023} value={pot} onChange={(e) => setPot(+e.target.value)} className="w-full accent-ohmlet-gold-deep" />
              <span className="w-10 text-right text-xs font-black tabular-nums text-ohmlet-ink">{pot}</span>
            </div>
            <div className="flex items-start gap-3 border-t-2 border-ohmlet-line bg-ohmlet-ink px-5 py-3.5 text-white">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ohmlet-gold"><Cpu className="h-4 w-4 text-ohmlet-ink" /></span>
              <p className="text-sm font-semibold leading-snug [&_b]:text-ohmlet-gold">
                {running ? <>Live. Pin 13 {led13 ? <>is <b>HIGH</b> ({ledMa.toFixed(1)} mA)</> : 'is LOW'}; pin 9 sits at <b>{Math.round(bright9 * 100)}%</b> brightness from the knob. Hold the button for pin 2.</>
                  : <>Hit <b>Compile &amp; Run</b> to build your sketch and watch the real firmware drive the board — knob, PWM and all.</>}
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

const Board: React.FC<{ led13: boolean; bright9: number; pressed: boolean; onPress: (p: boolean) => void; pot: number }> = ({ led13, bright9, pressed, onPress, pot }) => {
  const a = (pot / 1023 - 0.5) * 1.5 * Math.PI; // knob wiper angle, ±135°
  return (
    <svg viewBox="0 0 480 260" className="block w-full"
      style={{ background: 'linear-gradient(0deg,rgba(20,32,30,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(20,32,30,.03) 1px,transparent 1px)', backgroundSize: '20px 20px' }}>
      <rect x={40} y={70} width={400} height={120} rx={14} fill="#0c6b5e" stroke="#14201e" strokeWidth={2.5} />
      <rect x={56} y={84} width={66} height={42} rx={5} fill="#0a4a41" stroke="#083c35" strokeWidth={2} />
      <text x={89} y={109} textAnchor="middle" fontSize={11} fontWeight={800} fill="#cfe9e3">UNO</text>
      {/* pin-13 LED (digital) */}
      <g transform="translate(190,48)">
        <circle cx={0} cy={0} r={20} fill="#facc2e" opacity={led13 ? 0.85 : 0} />
        <circle cx={0} cy={0} r={11} fill={led13 ? '#ffe08a' : '#7c8b88'} stroke="#14201e" strokeWidth={2} />
        <line x1={0} y1={11} x2={0} y2={68} stroke="#14201e" strokeWidth={3} />
        <text x={0} y={-26} textAnchor="middle" fontSize={11} fontWeight={800} fill="#14201e">pin 13</text>
      </g>
      {/* pin-9 LED (PWM brightness) */}
      <g transform="translate(290,48)">
        <circle cx={0} cy={0} r={20} fill="#549cf0" opacity={(bright9 * 0.85).toFixed(2)} />
        <circle cx={0} cy={0} r={11} fill={bright9 > 0.04 ? '#bcd8fb' : '#7c8b88'} stroke="#14201e" strokeWidth={2} />
        <line x1={0} y1={11} x2={0} y2={68} stroke="#14201e" strokeWidth={3} />
        <text x={0} y={-26} textAnchor="middle" fontSize={11} fontWeight={800} fill="#14201e">pin 9 · {Math.round(bright9 * 100)}%</text>
      </g>
      {/* A0 potentiometer */}
      <g transform="translate(80,228)">
        <line x1={0} y1={-20} x2={0} y2={-58} stroke="#14201e" strokeWidth={3} />
        <text x={0} y={32} textAnchor="middle" fontSize={11} fontWeight={800} fill="#14201e">A0</text>
        <circle cx={0} cy={0} r={20} fill="#f1f5f9" stroke="#14201e" strokeWidth={2.5} />
        <line x1={0} y1={0} x2={Math.sin(a) * 14} y2={-Math.cos(a) * 14} stroke="#14201e" strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* pin-2 button */}
      <g transform="translate(400,228)">
        <line x1={0} y1={-20} x2={0} y2={-58} stroke="#14201e" strokeWidth={3} />
        <text x={0} y={32} textAnchor="middle" fontSize={11} fontWeight={800} fill="#14201e">pin 2</text>
        <circle cx={0} cy={0} r={20} fill={pressed ? '#e8db11' : '#f1f5f9'} stroke="#14201e" strokeWidth={2.5} />
        <circle cx={0} cy={0} r={12} fill={pressed ? '#cbb800' : '#cdd6d3'} stroke="#14201e" strokeWidth={2} />
        <rect x={-24} y={-24} width={48} height={48} rx={10} fill="transparent" className="cursor-pointer"
          onMouseDown={() => onPress(true)} onMouseUp={() => onPress(false)} onMouseLeave={() => onPress(false)}
          onTouchStart={(e) => { e.preventDefault(); onPress(true); }} onTouchEnd={() => onPress(false)} />
      </g>
    </svg>
  );
};
