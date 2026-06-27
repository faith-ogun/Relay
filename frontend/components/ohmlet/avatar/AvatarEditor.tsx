import React, { useState } from 'react';
import { Check, Lock, Shuffle, X } from 'lucide-react';
import { OhmletAvatar } from './OhmletAvatar';
import {
  defaultAvatar, LOCKED_PROPS, OPTIONS,
  type OhmletAvatarConfig, type OhmletProp,
} from './avatarConfig';
import { useDialog } from '../../../hooks/useDialog';

// ── AvatarEditor (#avatar) ──
//
// A live-preview editor: category tabs over a big preview, each category a grid of
// option swatches that update the avatar instantly. Brand-constrained colours keep
// every avatar on-palette. Ohmlet props (lab cosmetics) can be earned; locked ones
// show their requirement rather than a broken empty swatch.

interface AvatarEditorProps {
  initial: OhmletAvatarConfig;
  /** Earned Ohmlet props; others render locked. Omit to allow all (v1). */
  unlocked?: Set<OhmletProp>;
  onSave: (config: OhmletAvatarConfig) => void;
  onClose: () => void;
}

type Tab = 'face' | 'hair' | 'eyes' | 'features' | 'outfit' | 'props';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'features', label: 'Features' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'props', label: 'Lab gear' },
];

const PROP_LABEL: Record<OhmletProp, string> = { goggles: 'Safety goggles', boltBand: 'Bolt headband', visor: 'AR visor' };

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ initial, unlocked, onSave, onClose }) => {
  const [cfg, setCfg] = useState<OhmletAvatarConfig>(initial);
  const [tab, setTab] = useState<Tab>('face');
  const panelRef = useDialog<HTMLDivElement>(onClose);

  const set = (patch: Partial<OhmletAvatarConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const isUnlocked = (p: OhmletProp) => !unlocked || unlocked.has(p);

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
                onClick={() => set(defaultAvatar(`${Math.random()}`))}
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

              <div className="max-h-[44vh] min-h-[220px] flex-1 overflow-y-auto p-4">
                {tab === 'face' && (
                  <>
                    <Row label="Skin">
                      {OPTIONS.faceColor.map((c) => (
                        <ColorSwatch key={c} color={c} active={cfg.faceColor === c} onClick={() => set({ faceColor: c })} />
                      ))}
                    </Row>
                    <Row label="Build">
                      <Choice active={cfg.sex === 'man'} onClick={() => set({ sex: 'man' })}>Type A</Choice>
                      <Choice active={cfg.sex === 'woman'} onClick={() => set({ sex: 'woman' })}>Type B</Choice>
                    </Row>
                    <Row label="Ears">
                      {OPTIONS.earSize.map((e) => (
                        <Choice key={e} active={cfg.earSize === e} onClick={() => set({ earSize: e })}>{e}</Choice>
                      ))}
                    </Row>
                    <Row label="Background">
                      {OPTIONS.bgColor.map((c) => (
                        <ColorSwatch key={c} color={c} active={cfg.bgColor === c} onClick={() => set({ bgColor: c })} />
                      ))}
                    </Row>
                  </>
                )}
                {tab === 'hair' && (
                  <>
                    <Row label="Style">
                      {OPTIONS.hairStyle.map((h) => (
                        <Choice key={h} active={cfg.hairStyle === h} onClick={() => set({ hairStyle: h })}>{h}</Choice>
                      ))}
                    </Row>
                    <Row label="Colour">
                      {OPTIONS.hairColor.map((c) => (
                        <ColorSwatch key={c} color={c} active={cfg.hairColor === c} onClick={() => set({ hairColor: c })} />
                      ))}
                    </Row>
                    <Row label="Hat">
                      {OPTIONS.hatStyle.map((h) => (
                        <Choice key={h} active={cfg.hatStyle === h} onClick={() => set({ hatStyle: h })}>{h}</Choice>
                      ))}
                    </Row>
                  </>
                )}
                {tab === 'eyes' && (
                  <>
                    <Row label="Eyes">
                      {OPTIONS.eyeStyle.map((e) => (
                        <Choice key={e} active={cfg.eyeStyle === e} onClick={() => set({ eyeStyle: e })}>{e}</Choice>
                      ))}
                    </Row>
                    <Row label="Brows">
                      {OPTIONS.eyeBrowStyle.map((e) => (
                        <Choice key={e} active={cfg.eyeBrowStyle === e} onClick={() => set({ eyeBrowStyle: e })}>{e}</Choice>
                      ))}
                    </Row>
                    <Row label="Glasses">
                      {OPTIONS.glassesStyle.map((g) => (
                        <Choice key={g} active={cfg.glassesStyle === g} onClick={() => set({ glassesStyle: g })}>{g}</Choice>
                      ))}
                    </Row>
                  </>
                )}
                {tab === 'features' && (
                  <>
                    <Row label="Nose">
                      {OPTIONS.noseStyle.map((n) => (
                        <Choice key={n} active={cfg.noseStyle === n} onClick={() => set({ noseStyle: n })}>{n}</Choice>
                      ))}
                    </Row>
                    <Row label="Mouth">
                      {OPTIONS.mouthStyle.map((m) => (
                        <Choice key={m} active={cfg.mouthStyle === m} onClick={() => set({ mouthStyle: m })}>{m}</Choice>
                      ))}
                    </Row>
                  </>
                )}
                {tab === 'outfit' && (
                  <>
                    <Row label="Top">
                      {OPTIONS.shirtStyle.map((s) => (
                        <Choice key={s} active={cfg.shirtStyle === s} onClick={() => set({ shirtStyle: s })}>{s}</Choice>
                      ))}
                    </Row>
                    <Row label="Colour">
                      {OPTIONS.shirtColor.map((c) => (
                        <ColorSwatch key={c} color={c} active={cfg.shirtColor === c} onClick={() => set({ shirtColor: c })} />
                      ))}
                    </Row>
                  </>
                )}
                {tab === 'props' && (
                  <Row label="Ohmlet lab gear">
                    <Choice active={!cfg.prop} onClick={() => set({ prop: null })}>None</Choice>
                    {(['goggles', 'boltBand', 'visor'] as OhmletProp[]).map((p) => {
                      const locked = !isUnlocked(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={locked}
                          onClick={() => set({ prop: p })}
                          title={locked ? LOCKED_PROPS[p].requirement : PROP_LABEL[p]}
                          className={`relative inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-black transition-all ${
                            cfg.prop === p
                              ? 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink'
                              : locked
                                ? 'border-ohmlet-line bg-ohmlet-cream text-ohmlet-ink-soft/70'
                                : 'border-ohmlet-line text-ohmlet-ink hover:border-ohmlet-ink'
                          }`}
                        >
                          {locked && <Lock className="h-3 w-3" />}
                          {PROP_LABEL[p]}
                        </button>
                      );
                    })}
                  </Row>
                )}
              </div>

              <div className="flex gap-2.5 border-t-2 border-ohmlet-line p-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border-2 border-ohmlet-ink bg-white px-4 py-2.5 text-sm font-extrabold text-ohmlet-ink transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onSave(cfg)}
                  className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ohmlet-ink bg-ohmlet-gold px-4 py-2.5 text-sm font-black text-ohmlet-ink shadow-press-sm transition-all hover:-translate-y-0.5 hover:bg-ohmlet-gold-deep active:translate-y-0 active:shadow-none"
                >
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

const ColorSwatch: React.FC<{ color: string; active: boolean; onClick: () => void }> = ({ color, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={color}
    className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${active ? 'border-ohmlet-ink ring-2 ring-ohmlet-gold ring-offset-1' : 'border-ohmlet-line'}`}
    style={{ background: color }}
  />
);

const Choice: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border-2 px-3 py-1.5 text-xs font-black capitalize transition-all ${
      active ? 'border-ohmlet-ink bg-ohmlet-gold text-ohmlet-ink' : 'border-ohmlet-line text-ohmlet-ink hover:border-ohmlet-ink'
    }`}
  >
    {children}
  </button>
);
