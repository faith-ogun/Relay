import React from 'react';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Camera,
  Check,
  ChevronRight,
  Cloud,
  Code2,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  MessageSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

type IconType = React.ComponentType<{ className?: string }>;

interface HomeProps {
  onNavigate: (route: 'landing' | 'mission' | 'technology' | 'relay-app') => void;
}

const uiStyles = `
@keyframes relay-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.relay-marquee { animation: relay-marquee 24s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .relay-marquee { animation: none !important; }
}
`;

const capabilityPills = [
  {
    title: 'See + Sense',
    body: 'Live camera and voice context tied to the build in front of you.',
  },
  {
    title: 'Guide + Correct',
    body: 'Clear feedback when a wire, part, or assumption needs to change.',
  },
  {
    title: 'Practice + Review',
    body: 'Circuit diagrams, sandbox tools, and the community tab extend the learning loop.',
  },
] as const;

const flowNodes: Array<{ title: string; body: string; icon: IconType }> = [
  {
    title: 'Bench',
    body: 'Breadboard, parts, and board context',
    icon: Camera,
  },
  {
    title: 'Guidance',
    body: 'Voice, feedback, and correction in-session',
    icon: Sparkles,
  },
  {
    title: 'Practice',
    body: 'Circuit diagrams, sandbox tools, and community surfaces',
    icon: FileText,
  },
] as const;

const steps: Array<{ number: string; title: string; body: string; icon: IconType; tone: 'dark' | 'light' }> = [
  {
    number: '01',
    title: 'Show the Bench',
    body: 'Relay watches your breadboard, components, and hands in real time so the session starts from what is physically in front of you.',
    icon: Camera,
    tone: 'dark',
  },
  {
    number: '02',
    title: 'Build With Guidance',
    body: 'Natural voice tutoring with interruption handling, step-by-step wiring checks, and instant correction when a part or pin is wrong.',
    icon: MessageSquare,
    tone: 'light',
  },
  {
    number: '03',
    title: 'Keep Practicing',
    body: 'Relay extends the learning loop with chat context, lessons, circuit diagrams, serial feedback, and sandbox tools.',
    icon: FileText,
    tone: 'dark',
  },
];

const artifactCards: Array<{ title: string; body: string; icon: IconType; color: string }> = [
  {
    title: 'Live Tutor Session',
    body: 'Voice + vision-guided assembly with real-time verification and correction loops.',
    icon: Mic,
    color: 'bg-black text-white',
  },
  {
    title: 'Sandbox + Code Editor',
    body: 'A 3D breadboard playground with component placement, wiring tools, simulation, and an editable sketch.',
    icon: Code2,
    color: 'bg-white text-black',
  },
  {
    title: 'Interactive Lessons',
    body: 'Diagram-based exercises help learners identify parts, trace wiring, and spot mistakes.',
    icon: BarChart3,
    color: 'bg-[#fffbe2] text-black',
  },
  {
    title: 'Community Feed',
    body: 'Browse builds, like posts, and join comment threads inside the learning workspace.',
    icon: Sparkles,
    color: 'bg-white text-black',
  },
] as const;

const techCards: Array<{ title: string; body: string; icon: IconType }> = [
  {
    title: 'Realtime Multimodal Session',
    body: 'Continuous audio + video context instead of turn-by-turn text prompting.',
    icon: BrainCircuit,
  },
  {
    title: 'Cloud Orchestration',
    body: 'Agent runtime with stateful session coordination and tool routing.',
    icon: Cloud,
  },
  {
    title: 'Practice Surfaces',
    body: 'Circuit diagrams, serial feedback, interactive lessons, and sandbox tools stay close to the build.',
    icon: Database,
  },
  {
    title: 'Community + Progress State',
    body: 'Posts, comments, lesson progress, and adaptive history are carried across sessions.',
    icon: ShieldCheck,
  },
] as const;

const comparisonRows = [
  ['Build guidance', 'Static tutorial video', 'Live voice + vision tutor'],
  ['Error detection', 'You notice mistakes later', 'Real-time part and pin correction'],
  ['Practice tools', 'Separate simulator and diagrams', 'Sandbox, circuit diagrams, lessons, and serial monitor'],
  ['Community context', 'Watch alone', 'Community feed with likes and comments'],
  ['Experience', 'Fragmented tools', 'Single guided session'],
] as const;

const marqueeItems = [
  'VOICE',
  'VISION',
  'WIRING CHECKS',
  'INTERACTIVE LESSONS',
  'SERIAL MONITOR',
  '3D SANDBOX',
  'CIRCUIT DIAGRAMS',
  'COMMUNITY FEED',
] as const;

const architectureLayers: Array<{ title: string; body: string; icon: IconType; bullets: string[] }> = [
  {
    title: 'Bench Client',
    body: 'Captures the live workspace so guidance stays connected to the hardware in view.',
    icon: Camera,
    bullets: ['Webcam + mic capture', 'Voice controls', 'Build-state awareness'],
  },
  {
    title: 'Session Orchestrator',
    body: 'Maintains context across the whole build instead of treating each prompt as isolated.',
    icon: BrainCircuit,
    bullets: ['Live context management', 'Tutoring decisions', 'Progress tracking'],
  },
  {
    title: 'Guidance Engine',
    body: 'Explains next steps, catches wiring issues, and helps produce guidance from session context.',
    icon: MessageSquare,
    bullets: ['Step explanations', 'Wiring correction', 'Prompted guidance'],
  },
  {
    title: 'Learning Surfaces',
    body: 'Adds diagrams, sandbox tools, and community features around the live build session.',
    icon: Database,
    bullets: ['Circuit diagrams', 'Sandbox + editor', 'Community feed'],
  },
] as const;

const HeroFlow: React.FC = () => {
  return (
    <div className="mt-16 w-full max-w-4xl overflow-hidden rounded-[2.4rem] border-[3px] border-black bg-white p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] md:p-8">
      <div className="flex flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.26em] text-black/50">Relay flow</p>
        <p className="text-sm font-medium text-black/60">From physical build to supported practice</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
        {flowNodes.map((node, index) => {
          const Icon = node.icon;
          const isLast = index === flowNodes.length - 1;

          return (
            <React.Fragment key={node.title}>
              <div className="rounded-[1.8rem] border-2 border-black bg-[#fffbe2] p-5 text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-[#f3e515]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-black tracking-tight text-black">{node.title}</h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-black/70">{node.body}</p>
              </div>

              {!isLast && (
                <div className="hidden items-center justify-center md:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-white text-black">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div className="w-full">
      <style>{uiStyles}</style>

      <section id="home" className="px-6 pt-10 pb-16 md:pt-16 md:pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/55 px-5 py-2 backdrop-blur-sm">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-bold uppercase tracking-[0.22em] text-black/75">
                AI-guided electronics learning
              </span>
            </div>

            <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.05em] text-black md:text-7xl">
              Build and understand circuits with live AI guidance.
            </h1>

            <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-black/75 md:text-2xl">
              Relay helps learners explore breadboards, components, and microcontrollers in real time, with voice,
              vision, correction, and practice tools that support the build.
            </p>

            <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
              {capabilityPills.map((pill) => (
                <div
                  key={pill.title}
                  className="rounded-2xl border-2 border-black bg-white/70 p-4 text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <p className="text-sm font-black">{pill.title}</p>
                  <p className="mt-1 text-sm font-medium text-black/65">{pill.body}</p>
                </div>
              ))}
            </div>

            <HeroFlow />
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y-4 border-black bg-black text-[#f3e515]">
        <div className="relay-marquee flex min-w-max items-center gap-6 px-6 py-5 text-xl font-black tracking-tight md:text-2xl">
          {[...marqueeItems, ...marqueeItems].map((item, index) => (
            <div key={`${item}-${index}`} className="inline-flex items-center gap-4">
              <span>{item}</span>
              <span className="h-2 w-2 rounded-full bg-[#f3e515]" />
            </div>
          ))}
        </div>
      </section>

      <section id="mission" className="bg-[#f3e515] px-6 py-24 text-black">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-black/60">Mission</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-7xl">
              Teach electronics with grounded AI guidance.
            </h2>
            <p className="mt-5 text-lg font-medium text-black/70 md:text-2xl">
              Relay is built to help people understand components, wiring, and simple code while they build. In the
              age of AI, that understanding should become easier to access, not easier to skip.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              const dark = step.tone === 'dark';

              return (
                <article
                  key={step.number}
                  className={`relative overflow-hidden rounded-[2rem] border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
                    dark ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  <div className={`absolute top-6 right-6 text-6xl font-black ${dark ? 'text-white/10' : 'text-black/10'}`}>
                    {step.number}
                  </div>
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-black ${
                      dark ? 'bg-[#f3e515] text-black' : 'bg-black text-[#f3e515]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-6 text-2xl font-black tracking-tight">{step.title}</h3>
                  <p className={`mt-3 text-base font-medium leading-relaxed ${dark ? 'text-white/75' : 'text-black/70'}`}>
                    {step.body}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-16 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-black/50">Learning Surface</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
                Built for learning, not just one-off demos.
              </h2>
              <p className="mt-4 text-lg font-medium text-black/65 md:text-xl">
                Relay combines the live build experience with tools that learners can actually navigate while they work.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('mission')}
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 font-bold text-white hover:bg-black/85"
            >
              Read Mission
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {artifactCards.map((card, index) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className={`${card.color} rounded-[1.7rem] border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${
                    index % 2 === 0 ? 'md:-rotate-[1deg]' : 'md:rotate-[1deg]'
                  } hover:rotate-0 transition-transform`}
                >
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black ${
                      card.color.includes('bg-black') ? 'bg-[#f3e515] text-black' : 'bg-black text-[#f3e515]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-2xl font-black tracking-tight">{card.title}</h3>
                  <p className={`mt-3 text-base font-medium leading-relaxed ${card.color.includes('bg-black') ? 'text-white/75' : 'text-black/70'}`}>
                    {card.body}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-[2rem] border-2 border-black bg-[#fffbe2] p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-6 w-6" />
                <h3 className="text-2xl font-black tracking-tight md:text-3xl">Designed for teachable bench builds</h3>
              </div>
              <p className="mt-4 text-lg font-medium leading-relaxed text-black/70">
                Relay works best when the circuit responds clearly on camera, produces readable data, and gives the
                learner obvious moments where explanation and correction matter.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Breadboard workflow', 'Sensor input', 'Visible feedback', 'Live correction', 'Reviewable practice'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1 rounded-full border-2 border-black bg-white px-3 py-1 text-sm font-bold">
                    <Check className="h-3.5 w-3.5" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border-2 border-black bg-black p-7 text-white shadow-[8px_8px_0px_0px_rgba(243,229,21,0.4)]">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-[#f3e515]" />
                <h3 className="text-2xl font-black tracking-tight md:text-3xl">What Relay feels like</h3>
              </div>
              <ul className="mt-5 space-y-3 text-base font-medium text-white/80">
                <li className="flex gap-3"><Check className="mt-0.5 h-5 w-5 text-[#f3e515]" />Interruptions handled naturally while building</li>
                <li className="flex gap-3"><Check className="mt-0.5 h-5 w-5 text-[#f3e515]" />Visual correction when a wire, part, or pin is wrong</li>
                <li className="flex gap-3"><Check className="mt-0.5 h-5 w-5 text-[#f3e515]" />One workspace brings together live help, lessons, diagrams, and sandbox tools</li>
                <li className="flex gap-3"><Check className="mt-0.5 h-5 w-5 text-[#f3e515]" />Clear enough for students, serious enough for demos</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="technology" className="relative overflow-hidden border-y-4 border-white/10 bg-black px-6 py-24 text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '34px 34px' }}
        />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f3e515] px-4 py-2 text-sm font-bold text-black">
                <Cpu className="h-4 w-4" />
                Technology
              </div>
              <h2 className="mt-6 text-4xl font-black leading-[0.92] tracking-tight md:text-7xl">
                Real-time guidance.
                <span className="block text-[#f3e515]">Grounded practice tools.</span>
              </h2>
              <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-white/70 md:text-2xl">
                Relay pairs a live multimodal session with orchestration, circuit diagrams, serial feedback, lessons,
                and sandbox tooling so the experience stays grounded while you build.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {techCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <div key={card.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3e515] text-black">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-lg font-black leading-tight">{card.title}</p>
                          <p className="mt-2 text-sm leading-relaxed text-white/65">{card.body}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-[540px] rounded-[2rem] border-2 border-white/15 bg-[#0b0b0b] p-6 shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
                <div className="rounded-[1.5rem] border border-white/10 bg-[#111] p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold uppercase tracking-wide text-white/60">Relay Architecture</p>
                    <button
                      type="button"
                      onClick={() => onNavigate('technology')}
                      className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white/75 hover:bg-white/10"
                    >
                      Full page
                      <ChevronRight className="h-3.5 w-3.5 text-[#f3e515]" />
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    {architectureLayers.map((layer) => {
                      const Icon = layer.icon;

                      return (
                        <div key={layer.title} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f3e515] text-black">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="text-base font-black">{layer.title}</h3>
                              <p className="mt-2 text-sm leading-relaxed text-white/65">{layer.body}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {layer.bullets.map((bullet) => (
                                  <span key={bullet} className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/75">
                                    {bullet}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why-relay" className="bg-[#f3e515] px-6 py-24 text-black">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-black/60">Why Relay</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                A better learning loop than static tutorials.
              </h2>
              <p className="mt-5 max-w-2xl text-lg font-medium leading-relaxed text-black/70">
                Relay is meant to close the gap between watching electronics content and actually understanding your own
                build while your hands are on the breadboard.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {['Voice tutoring', 'Live correction', 'Build context', 'Practice tools'].map((item) => (
                  <span key={item} className="rounded-full border-2 border-black bg-white px-3 py-1 text-sm font-bold">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="grid grid-cols-3 border-b-2 border-black bg-black px-5 py-4 text-sm font-black uppercase tracking-wide text-[#f3e515]">
                <span>Category</span>
                <span>Typical flow</span>
                <span>Relay</span>
              </div>

              <div>
                {comparisonRows.map(([label, typical, relay]) => (
                  <div key={label} className="grid grid-cols-3 border-b border-black/10 px-5 py-4 text-sm last:border-b-0">
                    <div className="font-black text-black">{label}</div>
                    <div className="pr-4 text-black/65">{typical}</div>
                    <div className="font-medium text-black/80">{relay}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
