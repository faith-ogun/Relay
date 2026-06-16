import React, { Suspense, lazy, useState } from 'react';
import { ArrowRight, Boxes, Lightbulb, Loader2, MousePointerClick, RotateCcw } from 'lucide-react';
import { SANDBOX_PRESETS, type SandboxPreset } from '../../sandboxPresets';

// Three.js is heavy (~1MB) — only load it when the learner opens the sandbox.
const Sandbox = lazy(() => import('../../Sandbox'));

/**
 * SandboxView — the 3D breadboard playground (beta). A pre-flight gate sets
 * expectations, then mounts the live Three.js sandbox. Users can start from a
 * blank board or load a preset build.
 */

export const SandboxView: React.FC = () => {
  const [launched, setLaunched] = useState(false);
  const [preset, setPreset] = useState<SandboxPreset | null>(null);

  if (launched) {
    return (
      <div className="ohmlet-rise">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tight">3D Sandbox</h1>
            <span className="rounded-full bg-ohmlet-blue-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-ohmlet-blue-deep">Beta</span>
          </div>
          <button
            onClick={() => setLaunched(false)}
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-white px-4 py-2 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
          >
            <RotateCcw className="h-4 w-4" /> Exit sandbox
          </button>
        </div>
        <div className="overflow-hidden rounded-[1.6rem] border-[3px] border-ohmlet-ink shadow-press">
          <Suspense
            fallback={
              <div className="flex h-[480px] items-center justify-center gap-3 bg-ohmlet-cream text-ohmlet-ink-soft">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-bold">Loading the 3D workbench…</span>
              </div>
            }
          >
            <Sandbox dark={false} t={{}} preset={preset} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="ohmlet-rise mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-ohmlet-ink-soft">Sandbox</p>
        <span className="rounded-full bg-ohmlet-blue-soft px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-ohmlet-blue-deep">Beta</span>
      </div>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.02em] md:text-4xl">A 3D breadboard with no risk of magic smoke.</h1>
      <p className="mt-3 max-w-xl text-lg font-semibold leading-relaxed text-ohmlet-ink-soft">
        Drag components onto a real breadboard, wire them up, and write the sketch, all in the browser. Perfect for trying
        an idea before you touch the hardware.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { icon: MousePointerClick, title: 'Place & wire', desc: 'Drag parts, run jumpers, rotate the board.' },
          { icon: Lightbulb, title: 'Live logic', desc: 'See the circuit respond as you change it.' },
          { icon: Boxes, title: 'Preset builds', desc: 'Load a known-good circuit to study it.' },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="rounded-2xl border-2 border-ohmlet-line bg-white p-4 shadow-soft">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ohmlet-ink bg-ohmlet-blue-soft text-ohmlet-blue-deep">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-black">{f.title}</p>
              <p className="text-xs font-semibold text-ohmlet-ink-soft">{f.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Beta note */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-ohmlet-blue/40 bg-ohmlet-blue-soft p-4">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ohmlet-blue text-white">
          <Boxes className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-semibold text-ohmlet-ink">
          The sandbox is in beta. It runs entirely in your browser, so heavier builds may push your machine. We are
          adding more components and simulation depth every week.
        </p>
      </div>

      {/* Launch options */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => {
            setPreset(null);
            setLaunched(true);
          }}
          className="group rounded-[1.4rem] border-[2.5px] border-ohmlet-ink bg-ohmlet-gold p-5 text-left shadow-press transition-all hover:translate-y-[3px] hover:shadow-none"
        >
          <p className="text-base font-black">Start from a blank board</p>
          <p className="mt-1 text-sm font-semibold text-ohmlet-ink/70">Build whatever you like from scratch.</p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-black">Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </button>

        {Object.values(SANDBOX_PRESETS).map((p) => (
          <button
            key={p.name}
            onClick={() => {
              setPreset(p);
              setLaunched(true);
            }}
            className="group rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-5 text-left shadow-soft transition-transform hover:-translate-y-1"
          >
            <p className="text-base font-black">{p.name}</p>
            <p className="mt-1 text-sm font-semibold text-ohmlet-ink-soft">Load this build pre-wired to explore it.</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-black text-ohmlet-blue-deep">Load preset <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </button>
        ))}
      </div>
    </div>
  );
};
