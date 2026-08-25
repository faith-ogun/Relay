import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme/tokens';

/**
 * The twelve skill glyphs, drawn rather than imported.
 *
 * The curriculum already authors an icon name per skill (`Zap`, `Gauge`,
 * `Trophy`...), which is real, human-chosen variety — unlike lesson "types",
 * which do not exist: every one of the 142 lessons has essentially the same step
 * mix, so a derived type label would be a distinction we invented. Skill icons
 * are what honestly differentiates one stretch of the path from the next.
 *
 * Stroke-based at 24x24 to match src/components/icons.tsx, so a glyph dropped
 * into a node tile sits at the same optical weight as the rest of the app.
 */

interface P { size?: number; color?: string }

const S = ({ size = 22, children }: { size?: number; children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">{children}</Svg>
);

const stroke = (color: string) => ({
  fill: 'none' as const,
  stroke: color,
  strokeWidth: 2.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

const Trophy: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Path d="M7 4h10v5a5 5 0 0 1-10 0z" {...stroke(color)} />
    <Path d="M7 5.5H4.5V7a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3" {...stroke(color)} />
    <Path d="M12 14v3.5M8.5 20h7" {...stroke(color)} />
  </S>
);

const Gauge: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Path d="M3.6 17a9 9 0 1 1 16.8 0" {...stroke(color)} />
    <Path d="M12 15.5 16 9.5" {...stroke(color)} />
    <Circle cx={12} cy={16.5} r={1.6} fill={color} />
  </S>
);

const Zap: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Path d="M13.5 2.5 5.5 13.5h5L9.5 21.5l8.5-11.5h-5.2z" {...stroke(color)} />
  </S>
);

const Cpu: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Rect x={6} y={6} width={12} height={12} rx={2.5} {...stroke(color)} />
    <Rect x={9.75} y={9.75} width={4.5} height={4.5} rx={1} {...stroke(color)} />
    <Path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" {...stroke(color)} />
  </S>
);

const Wrench: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Path d="M15.2 4.3a4.6 4.6 0 0 0-5.9 5.9L4 15.5V20h4.5l5.3-5.3a4.6 4.6 0 0 0 5.9-5.9l-2.8 2.8-2.8-.7-.7-2.8z" {...stroke(color)} />
  </S>
);

const Lightbulb: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Path d="M9 15.5a6 6 0 1 1 6 0c-.6.5-.9 1.1-1 1.9H10c-.1-.8-.4-1.4-1-1.9z" {...stroke(color)} />
    <Path d="M10 20.5h4" {...stroke(color)} />
  </S>
);

const Binary: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Rect x={3.5} y={3.5} width={6} height={7.5} rx={3} {...stroke(color)} />
    <Path d="M15.5 11V3.5h-2M13.5 11h4" {...stroke(color)} />
    <Rect x={14.5} y={13} width={6} height={7.5} rx={3} {...stroke(color)} />
    <Path d="M7.5 20.5V13h-2M5.5 20.5h4" {...stroke(color)} />
  </S>
);

const Clock: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Circle cx={12} cy={12} r={8.5} {...stroke(color)} />
    <Path d="M12 7v5.2l3.2 2" {...stroke(color)} />
  </S>
);

const Microchip: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Rect x={7} y={5} width={10} height={14} rx={2} {...stroke(color)} />
    <Path d="M7 8.5H4M7 12H4M7 15.5H4M20 8.5h-3M20 12h-3M20 15.5h-3" {...stroke(color)} />
    <Circle cx={10} cy={8} r={1} fill={color} />
  </S>
);

const Cog: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Circle cx={12} cy={12} r={3.2} {...stroke(color)} />
    <Path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" {...stroke(color)} />
  </S>
);

const Radar: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Circle cx={12} cy={12} r={8.5} {...stroke(color)} />
    <Circle cx={12} cy={12} r={4.5} {...stroke(color)} />
    <Path d="M12 12 18 6.5" {...stroke(color)} />
    <Circle cx={12} cy={12} r={1.4} fill={color} />
  </S>
);

const Bot: React.FC<P> = ({ size, color = colors.ink }) => (
  <S size={size}>
    <Rect x={4.5} y={8} width={15} height={11} rx={3} {...stroke(color)} />
    <Path d="M12 4.5V8" {...stroke(color)} />
    <Circle cx={12} cy={3.4} r={1.4} {...stroke(color)} />
    <Path d="M2.5 12.5v3M21.5 12.5v3" {...stroke(color)} />
    <Circle cx={9.2} cy={12.8} r={1.2} fill={color} />
    <Circle cx={14.8} cy={12.8} r={1.2} fill={color} />
    <Path d="M9.5 15.8h5" {...stroke(color)} />
  </S>
);

const GLYPHS = {
  Trophy, Gauge, Zap, Cpu, Wrench, Lightbulb,
  Binary, Clock, Microchip, Cog, Radar, Bot,
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** The authored icon for a skill. Falls back to Zap, which is the brand mark and
 *  never looks like a missing asset. */
export const SkillGlyph: React.FC<{ name?: string } & P> = ({ name, ...rest }) => {
  const Cmp = (name && GLYPHS[name as GlyphName]) || Zap;
  return <Cmp {...rest} />;
};
