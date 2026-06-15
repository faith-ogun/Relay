import React from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Cpu,
  FileText,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type IconType = React.ComponentType<{ className?: string }>;

interface MissionPageProps {
  onNavigate: (route: 'landing' | 'mission' | 'technology' | 'relay-app') => void;
}

const missionPillars: Array<{ title: string; body: string; icon: IconType }> = [
  {
    title: 'Teach the why',
    body: 'Relay should explain what each component and pin is doing, not just provide a list of steps to copy.',
    icon: MessageSquare,
  },
  {
    title: 'Keep hardware tangible',
    body: 'The learning loop stays grounded in the actual breadboard, components, and microcontroller on the desk.',
    icon: Camera,
  },
  {
    title: 'Make mistakes useful',
    body: 'Fast correction turns wrong parts, loose wires, and bad assumptions into teachable moments instead of dead ends.',
    icon: ShieldCheck,
  },
];

const learnerOutcomes = [
  'Place and identify common components with more confidence.',
  'Understand how program logic connects to physical circuit behavior.',
  'Debug beginner breadboard builds without getting stuck for hours.',
  'Transfer core concepts across different microcontroller platforms.',
] as const;

export const MissionPage: React.FC<MissionPageProps> = ({ onNavigate }) => {
  return (
    <div className="px-6 pb-24 pt-10 text-black md:pt-16">
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-black/45">Mission</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.05em] text-black md:text-7xl">
              Teach electronics in a world already shaped by AI.
            </h1>
            <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-black/70 md:text-2xl">
              Relay exists to help people understand circuits as they build them. The goal is not to hide the hardware
              behind automation. The goal is to make breadboards, sensors, wiring, and microcontroller logic easier to
              learn, easier to debug, and easier to talk about.
            </p>
          </div>

          <div className="rounded-[2rem] border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-black/45">Why it matters</p>
            <div className="mt-5 space-y-4">
              {[
                'Electronics literacy should be more accessible, not more intimidating.',
                'AI should help learners form mental models instead of skipping the understanding step.',
                'Hardware skills should transfer beyond one kit, one board, or one tutorial.',
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-black/10 bg-[#fffbe2] px-4 py-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-black" />
                  <p className="text-sm font-medium leading-relaxed text-black/75">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl">
        <div className="grid gap-5 md:grid-cols-3">
          {missionPillars.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <article
                key={pillar.title}
                className="rounded-[2rem] border-2 border-black bg-white p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-[#f3e515]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-2xl font-black tracking-tight text-black">{pillar.title}</h2>
                <p className="mt-3 text-base font-medium leading-relaxed text-black/70">{pillar.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl rounded-[2.5rem] border-2 border-black bg-white p-8 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] md:p-12">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-black/45">What learners should leave with</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-black md:text-5xl">
              Confidence that survives outside the demo.
            </h2>
            <p className="mt-5 text-lg font-medium leading-relaxed text-black/70">
              Relay should help someone move from “I copied a tutorial” to “I understand what the circuit is doing, and
              I can try the next variation myself.”
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {learnerOutcomes.map((item) => (
              <div key={item} className="rounded-[1.7rem] border border-black/10 bg-[#fffbe2] p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black shadow-sm">
                  <Check className="h-4 w-4" />
                </div>
                <p className="mt-4 text-base font-semibold leading-relaxed text-black/80">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl rounded-[2.5rem] border-2 border-black bg-black p-8 text-white shadow-[10px_10px_0px_0px_rgba(243,229,21,0.45)] md:p-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-white/45">Approach</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">AI should support understanding, not replace it.</h2>
            <p className="mt-5 max-w-3xl text-lg font-medium leading-relaxed text-white/70">
              That means grounding each session in the real bench setup, keeping explanations clear, and surrounding the
              live build with tools people can use to keep practicing afterward.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              {
                title: 'Grounded in the bench',
                body: 'The system should reason from the hardware in front of the learner, not a detached prompt.',
                icon: Camera,
              },
              {
                title: 'Transferable knowledge',
                body: 'Arduino can be part of the story, but the concepts should make sense across other boards too.',
                icon: Cpu,
              },
              {
                title: 'Support practice after the conversation',
                body: 'Serial feedback, circuit diagrams, lessons, and sandbox tools should help learners keep working after the live guidance step.',
                icon: FileText,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f3e515] text-black">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black">{item.title}</h3>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-white/65">{item.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate('technology')}
            className="inline-flex items-center gap-2 rounded-full bg-[#f3e515] px-5 py-3 text-sm font-black text-black transition hover:bg-[#e5d70e]"
          >
            Explore the technology
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/5"
          >
            Back to home
          </button>
        </div>
      </section>
    </div>
  );
};
