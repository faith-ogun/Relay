import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors } from '../../theme/theme';

/**
 * The mark for one build, drawn rather than imported.
 *
 * The backend serves an icon NAME per build (`Zap`, `Camera`, `BrainCircuit`...)
 * exactly as it serves one per curriculum skill, because a React component
 * cannot cross the wire and the authored choice is worth keeping: it is what
 * tells one build apart from the next at a glance, and it is the same mark the
 * web shows on the same build, so the two surfaces agree.
 *
 * Same 24x24 grid and 2.1 stroke as src/components/icons.tsx and
 * path/SkillGlyph.tsx, so a build mark sits at the same optical weight as
 * everything drawn beside it.
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

const Zap: React.FC<P> = ({ size, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <S size={size}>
      <Path d="M13.5 2.5 5.5 13.5h5L9.5 21.5l8.5-11.5h-5.2z" {...stroke(color)} />
    </S>
  );
};

const Sparkles: React.FC<P> = ({ size, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <S size={size}>
      <Path d="M11 3.5c.9 3.6 1.9 4.6 5.5 5.5-3.6.9-4.6 1.9-5.5 5.5-.9-3.6-1.9-4.6-5.5-5.5 3.6-.9 4.6-1.9 5.5-5.5z" {...stroke(color)} />
      <Path d="M17.5 15c.4 1.7.9 2.2 2.5 2.6-1.6.4-2.1.9-2.5 2.6-.4-1.7-.9-2.2-2.5-2.6 1.6-.4 2.1-.9 2.5-2.6z" {...stroke(color)} />
    </S>
  );
};

const Camera: React.FC<P> = ({ size, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <S size={size}>
      <Path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h2L9 4.5h6l1.5 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" {...stroke(color)} />
      <Circle cx={12} cy={12.5} r={3.4} {...stroke(color)} />
    </S>
  );
};

const Gamepad2: React.FC<P> = ({ size, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <S size={size}>
      <Path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 3.6l.7 3.6A2.7 2.7 0 0 1 19 18.5c-1 0-1.7-.5-2.4-1.2L15.4 16H8.6l-1.2 1.3c-.7.7-1.4 1.2-2.4 1.2a2.7 2.7 0 0 1-2.6-3.3l.7-3.6A4.5 4.5 0 0 1 7.5 8z" {...stroke(color)} />
      <Path d="M6.6 11.5v2.2M5.5 12.6h2.2" {...stroke(color)} />
      <Circle cx={16} cy={12} r={1.1} fill={color} />
      <Circle cx={18.2} cy={13.8} r={1.1} fill={color} />
    </S>
  );
};

const BrainCircuit: React.FC<P> = ({ size, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <S size={size}>
      <Path d="M12 4.2a3.2 3.2 0 0 0-5.7 2 3 3 0 0 0-1 5 3.1 3.1 0 0 0 1.6 4.6 3.1 3.1 0 0 0 5.1 1.9z" {...stroke(color)} />
      <Path d="M12 4.2v13.5M12 8h2.8M12 13.2h3.6" {...stroke(color)} />
      <Circle cx={16.4} cy={8} r={1.7} {...stroke(color)} />
      <Circle cx={17.4} cy={13.2} r={1.7} {...stroke(color)} />
      <Path d="M19.1 13.2h1.9M18.1 8h2.9" {...stroke(color)} />
    </S>
  );
};

const Play: React.FC<P> = ({ size, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <S size={size}>
      <Path d="M8.5 5.6 18.6 12 8.5 18.4z" {...stroke(color)} />
    </S>
  );
};

const GLYPHS = { Zap, Sparkles, Camera, Gamepad2, BrainCircuit, Play } as const;

export type BuildGlyphName = keyof typeof GLYPHS;

/** The authored mark for a build. Falls back to the bolt, which is the brand
 *  mark and never reads as a missing asset, so a build added server-side before
 *  this app knows its icon still renders as a finished thing. */
export const BuildGlyph: React.FC<{ name?: string } & P> = ({ name, ...rest }) => {
  const Cmp = (name && GLYPHS[name as BuildGlyphName]) || Zap;
  return <Cmp {...rest} />;
};
