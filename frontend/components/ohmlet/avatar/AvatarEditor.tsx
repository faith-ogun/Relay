import React, { useState } from 'react';
import { Check, Lock, Shuffle, X } from 'lucide-react';
import { OhmletAvatar } from './OhmletAvatar';
import { defaultAvatar, LABELS, LOCKED_GEAR, OPTIONS, type OhmletAvatarConfig } from './avatarConfig';
import { useDialog } from '../../../hooks/useDialog';

// ── AvatarEditor ──
//
// A live-preview editor: category tabs over a big preview; each category a grid of
// option swatches that update instantly. Wide inclusive palettes, neutral labels
// for every option (no gendered wording), and four stackable lab-gear slots.

interface AvatarEditorProps {
  initial: OhmletAvatarConfig;
  /** Earned lab-gear ids; others render locked. Omit to allow all. */
  unlocked?: Set<string>;
  onSave: (config: OhmletAvatarConfig) => void;
  onClose: () => void;
}

type Tab = 'skin' | 'face' | 'hair' | 'eyes' | 'features' | 'glasses' | 'outfit' | 'gear';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'skin', label: 'Skin' },
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'features', label: 'Features' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'gear', label: 'Lab gear' },
];

const GEAR_LABELS: Record<string, string> = {
  hardHat: 'Hard hat',
  earDefenders: 'Ear defenders',
  goggles: 'Goggles',
  mask: 'Face mask',
  labCoat: 'Lab coat',
};

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ initial, unlocked, onSave, onClose }) => {
  const [cfg, setCfg] = useState<OhmletAvatarConfig>(initial);
  const [tab, setTab] = useState<Tab>('skin');
  const panelRef = useDialog<HTMLDivElement>(onClose);
  const set = (patch: Partial<OhmletAvatarConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const isUnlocked = (id: string) => !unlocked || unlocked.has(id);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto">
      <div className="fixed inset-0 bg-ohmlet-ink/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-editor-title"
          className="relative w-full max-w-2xl overflow-hidden rounded-[1.75rem] border-2 border-ohmlet-ink bg-white shadow-press motion-safe:animate-[ohmlet-scale-in_220ms_cubic-bezier(0.34,1.56,0.64,1)]"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ohmlet-focus-ring absolute right-3 top-3 z-10 rounded-full bg-white/85 p-1.5 text-ohmlet-ink/70 backdrop-blur transition-colors hover:bg-white hover:text-ohmlet-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>

          <div className="grid gap-0 sm:grid-cols-[auto_1fr]">
            {/* Preview */}
            <div className="flex flex-col items-center gap-4 border-b-2 border-ohmlet-ink bg-ohmlet-cream p-6 sm:border-b-0 sm:border-r-2">
              <h2 id="avatar-editor-title" className="text-sm font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Your avatar</h2>
              <OhmletAvatar config={cfg} size={168} ring />
              <button
                type="button"
                onClick={() => set({ ...defaultAvatar(`${Math.random()}`), headGear: null, eyeGear: null, faceGear: null, neckGear: null })}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-ohmlet-line bg-white px-3 py-1.5 text-xs font-black text-ohmlet-ink transition-colors hover:border-ohmlet-ink"
              >
                <Shuffle className="h-3.5 w-3.5" /> Surprise me
              </button>
            </div>

            {/* Controls */}
            <div className="flex min-w-0 flex-col">
              <div className="flex gap-1 overflow-x-auto border-b-2 border-ohmlet-line px-3 pt-3">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-extrabold transition-colors ${
                      tab === t.id ? 'bg-ohmlet-gold text-ohmlet-ink' : 'text-ohmlet-ink-soft hover:text-ohmlet-ink'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="max-h-[46vh] min-h-[230px] flex-1 overflow-y-auto p-4">
                {tab === 'skin' && (
                  <>
                    <Swatches label="Skin tone" values={OPTIONS.faceColor} active={cfg.faceColor} onPick={(faceColor) => set({ faceColor })} />
                    <Swatches label="Background" values={OPTIONS.bgColor} active={cfg.bgColor} onPick={(bgColor) => set({ bgColor })} />
                    <Choices label="Background fade" options={[['solid', 'Solid'], ['grad', 'Gradient']]} active={cfg.isGradient ? 'grad' : 'solid'} onPick={(v) => set({ isGradient: v === 'grad' })} />
                  </>
                )}
                {tab === 'face' && (
                  <>
                    <Choices label="Face shape" options={OPTIONS.sex.map((s) => [s, LABELS.sex[s]])} active={cfg.sex} onPick={(sex) => set({ sex: sex as 'man' | 'woman' })} />
                    <Choices label="Ears" options={OPTIONS.earSize.map((s) => [s, LABELS.earSize[s]])} active={cfg.earSize} onPick={(earSize) => set({ earSize: earSize as 'small' | 'big' })} />
                  </>
                )}
                {tab === 'hair' && (
                  <>
                    <Choices label="Style" options={OPTIONS.hairStyle.map((s) => [s, LABELS.hairStyle[s]])} active={cfg.hairStyle} onPick={(hairStyle) => set({ hairStyle: hairStyle as OhmletAvatarConfig['hairStyle'] })} />
                    <Swatches label="Hair colour" values={OPTIONS.hairColor} active={cfg.hairColor} onPick={(hairColor) => set({ hairColor })} />
                    <Choices label="Headwrap" options={OPTIONS.hatStyle.map((s) => [s, LABELS.hatStyle[s]])} active={cfg.hatStyle} onPick={(hatStyle) => set({ hatStyle: hatStyle as OhmletAvatarConfig['hatStyle'] })} />
                    {cfg.hatStyle !== 'none' && (
                      <Swatches label="Headwrap colour" values={OPTIONS.hatColor} active={cfg.hatColor} onPick={(hatColor) => set({ hatColor })} />
                    )}
                  </>
                )}
                {tab === 'eyes' && (
                  <>
                    <Choices label="Eyes" options={OPTIONS.eyeStyle.map((s) => [s, LABELS.eyeStyle[s]])} active={cfg.eyeStyle} onPick={(eyeStyle) => set({ eyeStyle: eyeStyle as OhmletAvatarConfig['eyeStyle'] })} />
                    <Choices label="Brows" options={OPTIONS.eyeBrowStyle.map((s) => [s, LABELS.eyeBrowStyle[s]])} active={cfg.eyeBrowStyle} onPick={(eyeBrowStyle) => set({ eyeBrowStyle: eyeBrowStyle as OhmletAvatarConfig['eyeBrowStyle'] })} />
                  </>
                )}
                {tab === 'features' && (
                  <>
                    <Choices label="Nose" options={OPTIONS.noseStyle.map((s) => [s, LABELS.noseStyle[s]])} active={cfg.noseStyle} onPick={(noseStyle) => set({ noseStyle: noseStyle as OhmletAvatarConfig['noseStyle'] })} />
                    <Choices label="Mouth" options={OPTIONS.mouthStyle.map((s) => [s, LABELS.mouthStyle[s]])} active={cfg.mouthStyle} onPick={(mouthStyle) => set({ mouthStyle: mouthStyle as OhmletAvatarConfig['mouthStyle'] })} />
                  </>
                )}
                {tab === 'glasses' && (
                  <Choices label="Glasses" options={OPTIONS.glassesStyle.map((s) => [s, LABELS.glassesStyle[s]])} active={cfg.glassesStyle} onPick={(glassesStyle) => set({ glassesStyle: glassesStyle as OhmletAvatarConfig['glassesStyle'] })} />
                )}
                {tab === 'outfit' && (
                  <>
                    <Choices label="Top" options={OPTIONS.shirtStyle.map((s) => [s, LABELS.shirtStyle[s]])} active={cfg.shirtStyle} onPick={(shirtStyle) => set({ shirtStyle: shirtStyle as OhmletAvatarConfig['shirtStyle'] })} />
                    <Swatches label="Top colour" values={OPTIONS.shirtColor} active={cfg.shirtColor} onPick={(shirtColor) => set({ shirtColor })} />
                  </>
                )}
                {tab === 'gear' && (
                  <>
                    <GearRow label="Headgear" options={[null, 'hardHat', 'earDefenders']} active={cfg.headGear ?? null} isUnlocked={isUnlocked} onPick={(g) => set({ headGear: g as OhmletAvatarConfig['headGear'] })} />
                    <GearRow label="Eye protection" options={[null, 'goggles']} active={cfg.eyeGear ?? null} isUnlocked={isUnlocked} onPick={(g) => set({ eyeGear: g as OhmletAvatarConfig['eyeGear'] })} />
                    <GearRow label="Face" options={[null, 'mask']} active={cfg.faceGear ?? null} isUnlocked={isUnlocked} onPick={(g) => set({ faceGear: g as OhmletAvatarConfig['faceGear'] })} />
                    <GearRow label="Coat" options={[null, 'labCoat']} active={cfg.neckGear ?? null} isUnlocked={isUnlocked} onPick={(g) => set({ neckGear: g as OhmletAvatarConfig['neckGear'] })} />
                    <p className="mt-1 text-xs font-semibold text-ohmlet-ink-soft">Lab gear stacks: wear a hard hat, goggles, and a coat together.</p>
                  </>
                )}
              </div>

              <div className="flex gap-2.5 border-t-2 border-ohmlet-line p-4">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl border-2 border-ohmlet-ink bg-white px-4 py-2.5 text-sm font-extrabold text-ohmlet-ink transition-all hover:-translate-y-0.5 active:translate-y-0">
                  Cancel
                </button>
                <button type="button" onClick={() => onSave(cfg)} className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-4 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none">
                  <Check className="h-4 w-4" strokeWidth={2.5} /> Save avatar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-5">
    <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-ohmlet-ink-soft">{label}</p>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

const Swatches: React.FC<{ label: string; values: string[]; active?: string; onPick: (v: string) => void }> = ({ label, values, active, onPick }) => (
  <Row label={label}>
    {values.map((c) => (
      <button
        key={c}
        type="button"
        aria-label={c}
        onClick={() => onPick(c)}
        className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${active === c ? 'border-ohmlet-ink ring-2 ring-ohmlet-gold ring-offset-1' : 'border-ohmlet-line'}`}
        style={{ background: c }}
      />
    ))}
  </Row>
);

const Choices: React.FC<{ label: string; options: (readonly [string, string])[] | string[][]; active?: string; onPick: (v: string) => void }> = ({ label, options, active, onPick }) => (
  <Row label={label}>
    {(options as string[][]).map(([v, l]) => (
      <button
        key={v}
        type="button"
        onClick={() => onPick(v)}
        className={`rounded-xl border-2 px-3 py-1.5 text-xs font-black transition-all ${active === v ? 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink' : 'border-ohmlet-line text-ohmlet-ink hover:border-ohmlet-ink'}`}
      >
        {l}
      </button>
    ))}
  </Row>
);

const GearRow: React.FC<{ label: string; options: (string | null)[]; active: string | null; isUnlocked: (id: string) => boolean; onPick: (v: string | null) => void }> = ({ label, options, active, isUnlocked, onPick }) => (
  <Row label={label}>
    {options.map((g) => {
      if (g === null) {
        return (
          <button key="none" type="button" onClick={() => onPick(null)} className={`rounded-xl border-2 px-3 py-1.5 text-xs font-black transition-all ${active === null ? 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink' : 'border-ohmlet-line text-ohmlet-ink hover:border-ohmlet-ink'}`}>
            None
          </button>
        );
      }
      const locked = !isUnlocked(g);
      return (
        <button
          key={g}
          type="button"
          disabled={locked}
          onClick={() => onPick(g)}
          title={locked ? LOCKED_GEAR[g]?.requirement : undefined}
          className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-black transition-all ${
            active === g ? 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink' : locked ? 'border-ohmlet-line bg-ohmlet-cream text-ohmlet-ink-soft/70' : 'border-ohmlet-line text-ohmlet-ink hover:border-ohmlet-ink'
          }`}
        >
          {locked && <Lock className="h-3 w-3" />}
          {GEAR_LABELS[g] || g}
        </button>
      );
    })}
  </Row>
);
