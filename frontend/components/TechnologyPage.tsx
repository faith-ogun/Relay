import React from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Camera,
  Check,
  Cloud,
  Cpu,
  Database,
  FileText,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type IconType = React.ComponentType<{ className?: string }>;

interface TechnologyPageProps {
  onNavigate: (route: 'landing' | 'mission' | 'technology' | 'relay-app') => void;
}

const systemLayers: Array<{ title: string; body: string; icon: IconType }> = [
  {
    title: 'Bench context',
    body: 'Relay connects camera, voice, and session state so guidance stays tied to the physical build.',
    icon: Camera,
  },
  {
    title: 'Session orchestration',
    body: 'A live coordination layer decides when to explain, verify wiring, generate guidance, and switch surfaces.',
    icon: BrainCircuit,
  },
  {
    title: 'Microcontroller workflow',
    body: 'The product is designed for breadboards and microcontrollers broadly. Arduino is one example, not the boundary.',
    icon: Cpu,
  },
  {
    title: 'Practice surfaces',
    body: 'Circuit diagrams, serial feedback, interactive lessons, and sandbox tools stay close to the build.',
    icon: Database,
  },
];

const architectureSteps = [
  {
    number: '01',
    title: 'Capture',
    body: 'Bring live bench video, audio, and user intent into the same session context.',
  },
  {
    number: '02',
    title: 'Guide',
    body: 'Respond with tutoring, next-step instruction, and correction when a part or pin choice is off.',
  },
  {
    number: '03',
    title: 'Practice',
    body: 'Keep the learner moving with circuit diagrams, serial feedback, lessons, and sandbox tools.',
  },
  {
    number: '04',
    title: 'Revisit',
    body: 'Use community, progress tracking, and supporting surfaces to keep learning after the build step.',
  },
] as const;

export const TechnologyPage: React.FC<TechnologyPageProps> = ({ onNavigate }) => {
  return (
    <div className="px-6 pb-24 pt-10 text-white md:pt-16">
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-white/45">Technology</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.05em] md:text-7xl">
              Real-time guidance for hardware that stays grounded in the actual build.
            </h1>
            <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-white/70 md:text-2xl">
              Relay combines live multimodal input, session orchestration, microcontroller-aware workflows, circuit
              diagrams, serial feedback, a sandbox with code editing, and community-facing learning surfaces.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/45">What this page covers</p>
            <div className="mt-5 grid gap-3">
              {[
                'How Relay observes and reasons about a physical electronics bench.',
                'How tutoring, correction, diagrams, serial feedback, and sandbox tools connect.',
                'Why the workflow is meant for breadboards and microcontrollers broadly, not just one board family.',
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#f3e515]" />
                  <p className="text-sm font-medium leading-relaxed text-white/70">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {systemLayers.map((layer) => {
            const Icon = layer.icon;

            return (
              <article
                key={layer.title}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3e515] text-black">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-2xl font-black tracking-tight">{layer.title}</h2>
                <p className="mt-3 text-base font-medium leading-relaxed text-white/65">{layer.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl rounded-[2.5rem] border border-white/10 bg-black/20 p-8 shadow-[0_26px_80px_rgba(0,0,0,0.28)] md:p-12">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-white/45">Architecture flow</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              One learning session, multiple connected layers.
            </h2>
            <p className="mt-5 text-lg font-medium leading-relaxed text-white/70">
              The important part is continuity. Bench context, tutoring, practice tools, and review should all belong
              to the same session instead of being split across disconnected tools.
            </p>
          </div>

          <div className="grid gap-4">
            {architectureSteps.map((step) => (
              <div key={step.number} className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-black text-sm font-black">
                    {step.number}
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{step.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-white/65">{step.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl rounded-[2.5rem] border border-white/10 bg-white/5 p-8 md:p-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-white/45">Grounding and continuity</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Designed to be helpful without feeling untethered.</h2>
            <div className="mt-6 grid gap-4">
              {[
                {
                  title: 'Verification before confidence',
                  body: 'Relay should confirm what is physically present before acting overly certain about the next step.',
                  icon: ShieldCheck,
                },
                {
                  title: 'Explainable tutoring',
                  body: 'Guidance should tell the learner what changed and why, not just issue commands.',
                  icon: MessageSquare,
                },
                {
                  title: 'Cloud-backed continuity',
                  body: 'Session coordination can live in the cloud while progress, community state, and adaptive history persist.',
                  icon: Cloud,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-[1.7rem] border border-white/10 bg-black/20 p-5">
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

          <div className="rounded-[2rem] border border-white/10 bg-[#f3e515] p-7 text-black">
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-black/50">Visible surfaces</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight">What the learner can actually use in the product.</h2>
            <div className="mt-6 space-y-4">
              {[
                { title: 'Serial monitor during run stage', icon: Cpu },
                { title: 'Interactive circuit diagrams in the learning flow', icon: FileText },
                { title: '3D sandbox with an editable sketch', icon: Database },
                { title: 'Community feed with likes and comments', icon: MessageSquare },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/65 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-[#f3e515]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-black">{item.title}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-[1.7rem] border border-black/10 bg-white/50 p-5">
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm font-medium leading-relaxed text-black/75">
                  The copy on this page stays anchored to the surfaces that are visibly present in the app today.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate('mission')}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-[#f2f2f2]"
          >
            Read the mission
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
