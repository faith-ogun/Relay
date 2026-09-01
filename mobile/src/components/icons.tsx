import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors } from '../theme/theme';

// ── Drawn icons ──
//
// Five places used an emoji as an icon: a heart, a lock, a speech bubble and a
// close cross. An emoji is not an icon. It renders in the system font, so its
// weight, colour and optical size are outside our control, it looks different on
// every OS version, and it never matches the stroke weight of anything drawn
// beside it. That is most of why a screen reads as unfinished.
//
// All of these are drawn on a 24-unit grid with a 2.2 stroke, so they sit
// consistently next to each other and inherit colour like any other element.

interface Props { size?: number; color?: string; filled?: boolean }

export const Heart: React.FC<Props> = ({ size = 20, color: colorProp, filled = true }) => {
  const colors = useColors();
  const color = colorProp ?? colors.red;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 10.9-8.5 10.9z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const InfinityMark: React.FC<Props> = ({ size = 20, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.goldText;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 12c-2-2.7-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.3 6-4Zm0 0c2 2.7 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.3-6 4Z"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const Lock: React.FC<Props> = ({ size = 18, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.inkSoft;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Rect x={5.5} y={10.5} width={13} height={9.5} rx={2.5} fill={color} />
      <Circle cx={12} cy={15.2} r={1.7} fill={colors.surface} />
    </Svg>
  );
};

export const Comment: React.FC<Props> = ({ size = 18, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.inkSoft;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 13.5z"
        fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round"
      />
    </Svg>
  );
};

/**
 * Send.
 *
 * Replaces a literal "↑" that two screens were using as a button face. A text
 * arrow inherits the font, so it sat off-centre, ignored the icon sizing every
 * neighbouring control obeyed, and shifted between iOS versions. Drawn, it is
 * the same weight as Close and Comment beside it.
 */
export const Send: React.FC<Props> = ({ size = 20, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.white;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 19V6.5M12 5l-5.5 5.5M12 5l5.5 5.5" fill="none" stroke={color}
            strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export const Close: React.FC<Props> = ({ size = 20, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke={color}
            strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
};

/**
 * Chevron.
 *
 * Replaces a literal "›" that the Profile rows were using as their affordance,
 * for the same reason `Send` replaced "↑": a text arrow inherits the font, so
 * it sat a pixel or two off the vertical centre of every row it terminated, it
 * ignored icon sizing, and at font.black it was heavier than anything else on
 * the row.
 */
export const Chevron: React.FC<Props> = ({ size = 18, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.inkMute;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke={color}
            strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

// ── Profile row marks ──
//
// One per destination in the YOU list, plus one per section heading. A settings
// list with no marks is the single loudest "rudimentary" tell there is: every
// row has identical DNA, so the eye has nothing to land on and the list reads as
// a text dump. Each of these is the OBJECT the row leads to rather than a
// decorative bullet, so the mark is doing wayfinding, not filling space.

/** 3D twins: an isometric box, which is what a twin is. */
export const Cube: React.FC<Props> = ({ size = 22, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.8 20.5 7.6v8.8L12 21.2 3.5 16.4V7.6z" fill="none" stroke={color}
            strokeWidth={2.1} strokeLinejoin="round" />
      <Path d="M3.5 7.6 12 12.4l8.5-4.8M12 12.4v8.8" fill="none" stroke={color}
            strokeWidth={2.1} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
};

/** Plan: a cell with charge in it. The plan IS an allowance that depletes, and
 *  a battery says that in a way a price tag or a card never does. */
export const Battery: React.FC<Props> = ({ size = 22, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.6} y={7} width={15.4} height={10} rx={3} fill="none" stroke={color} strokeWidth={2.1} />
      <Path d="M20.9 10.3v3.4" stroke={color} strokeWidth={2.8} strokeLinecap="round" />
      <Path d="M6.6 10.6v2.8M10.3 10.6v2.8" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
};

/** Your build record: a page with a seal on it. The record is a credential, and
 *  the seal is the part that says somebody checked. */
export const Certificate: React.FC<Props> = ({ size = 22, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M16.6 12.4V4.6a2 2 0 0 0-2-2H5.6a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h4.2"
            fill="none" stroke={color} strokeWidth={2.1} strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M7 7.2h6.2M7 10.8h4" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
      <Circle cx={16.4} cy={15.2} r={3.5} fill="none" stroke={color} strokeWidth={2.1} />
      <Path d="M14.2 18.1 13.5 22l2.9-1.6 2.9 1.6-.7-3.9" fill="none" stroke={color}
            strokeWidth={2.1} strokeLinejoin="round" />
    </Svg>
  );
};

/** Interview Mode: the microphone you answer into. */
export const Mic: React.FC<Props> = ({ size = 22, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={8.9} y={2.5} width={6.2} height={11.2} rx={3.1} fill="none" stroke={color} strokeWidth={2.1} />
      <Path d="M5.4 11.1a6.6 6.6 0 0 0 13.2 0" fill="none" stroke={color}
            strokeWidth={2.1} strokeLinecap="round" />
      <Path d="M12 17.7v3.4M9 21.1h6" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  );
};

/** Ohmlet Labs: a flask, because what is in there is still being mixed. */
export const Flask: React.FC<Props> = ({ size = 22, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9.6 2.9v5.6l-5 8.7a2.6 2.6 0 0 0 2.3 3.9h10.2a2.6 2.6 0 0 0 2.3-3.9l-5-8.7V2.9"
            fill="none" stroke={color} strokeWidth={2.1} strokeLinejoin="round" />
      <Path d="M8.4 2.9h7.2" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
      <Path d="M7.1 14.1h9.8" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
      <Circle cx={13.4} cy={17.4} r={1.2} fill={color} />
    </Svg>
  );
};

/** Account and privacy: a shield with a keyhole. The `Lock` above already means
 *  "you have not earned this yet", so privacy needs its own mark or the two
 *  meanings collide. */
export const Shield: React.FC<Props> = ({ size = 22, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.6 20 5.5v6.2c0 4.6-3.3 8.3-8 9.7-4.7-1.4-8-5.1-8-9.7V5.5z"
            fill="none" stroke={color} strokeWidth={2.1} strokeLinejoin="round" />
      <Circle cx={12} cy={10.6} r={1.9} fill={color} />
      <Path d="M12 12.3v2.7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
};

/** The ACHIEVEMENTS heading. A medal on a ribbon, distinct from `Certificate`
 *  below it: one is a thing you won, the other a thing you can prove. */
export const Medal: React.FC<Props> = ({ size = 16, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.inkMute;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8.2 2.6 11 8.4M15.8 2.6 13 8.4" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
      <Circle cx={12} cy={15} r={6.2} fill="none" stroke={color} strokeWidth={2.1} />
      <Circle cx={12} cy={15} r={2} fill={color} />
    </Svg>
  );
};

/** The YOU heading. */
export const Person: React.FC<Props> = ({ size = 16, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.inkMute;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={7.8} r={3.9} fill="none" stroke={color} strokeWidth={2.1} />
      <Path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0" fill="none" stroke={color}
            strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  );
};

/** The APPEARANCE heading. A disc lit on one side: the one mark that means
 *  light and dark at once, which is what the control underneath it chooses
 *  between. */
export const Contrast: React.FC<Props> = ({ size = 16, color: colorProp }) => {
  const colors = useColors();
  const color = colorProp ?? colors.inkMute;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.6} fill="none" stroke={color} strokeWidth={2.1} />
      <Path d="M12 3.4a8.6 8.6 0 0 1 0 17.2z" fill={color} />
    </Svg>
  );
};

// ── Stat art, drawn ──
//
// The other two icons in the Profile stat block are painted bitmaps
// (assets/stats/xp.png and streak.png). These two have no bitmap, and a 2.1
// stroke monochrome glyph beside a gold hexagon and a red flame would read as
// two different products in one card, so they are drawn in the PAINTED
// language instead of the line language above: chunky near-black outline, flat
// brand fills, and a real component somewhere in the picture.
//
// Three things were copied off the bitmaps deliberately:
//
//   1. A 48 grid, not 24. The painted set carries interior detail (circuit
//      traces on the coin, a resistor for the flame's mouth) and 24 units is
//      not enough room to place a component without it turning to mush.
//   2. `colors.slab` for the outline. The bitmaps' outline is black and STAYS
//      black in dark mode, because a bitmap cannot move; `slab` is the palette's
//      near-black in both themes, so the drawn pair sits in the same ink as its
//      painted neighbours instead of flipping to near-white beside them.
//      `colors.ink` would have inverted, which is right for a line glyph and
//      wrong for a member of this set.
//   3. `colors.white` for the light faces, for the same reason: white in the
//      painted set is baked, and ChallengeArt paints the mascot in fixed white
//      on both themes for exactly this reason.
//
// Both take `dim`, matching StatStrip: a stat at zero is flattened rather than
// greyed, so a spent stat reads as spent without becoming a different picture.

interface StatGlyphProps { size?: number; dim?: boolean }

/**
 * Built: two breadboards, the finished one underneath, with a resistor seated
 * across the rails of the one on top.
 *
 * Two boards rather than one because the number beside it is a COUNT, and a
 * count icon should depict more than one of the thing. The breadboard is the
 * object every Ohmlet build happens on, so it is the only honest picture of
 * "builds finished" that is not a check mark, and the check mark is already
 * taken by the daily goal.
 *
 * The resistor is the thread through the painted set: it crosses the base of
 * the XP coin and forms the flame's mouth. Repeating it here is what makes this
 * a member of the family rather than a neighbour of it.
 *
 * The board on top is blue and the one behind it gold. Drawn the other way
 * round, with a white board on top, the icon went pale beside the coin and the
 * flame, and on a dark card the white slab was the brightest thing in the
 * plate; the gold behind ties it to the set, and the blue face is the one hue
 * the other three stats do not already own.
 */
export const BuiltGlyph: React.FC<StatGlyphProps> = ({ size = 40, dim }) => {
  const colors = useColors();
  const edge = {
    stroke: colors.slab,
    strokeWidth: 3.2,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  const holes = [17, 23, 29, 35];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" opacity={dim ? 0.38 : 1}>
      {/* the one already finished, showing over the shoulder of the new one */}
      <Rect x={6} y={8} width={32} height={18} rx={5} fill={colors.gold} {...edge} />
      {/* the board on the bench, face up */}
      <Rect x={10} y={16} width={32} height={24} rx={5} fill={colors.blue} {...edge} />
      {holes.map((x) => <Circle key={`t${x}`} cx={x} cy={22.5} r={1.5} fill={colors.slab} />)}
      {holes.map((x) => <Circle key={`b${x}`} cx={x} cy={35.5} r={1.5} fill={colors.slab} />)}
      {/* leads bent into the rails, then the body over them */}
      <Path d="M15 29h5M32 29h5" stroke={colors.slab} strokeWidth={2.2} strokeLinecap="round" />
      <Rect
        x={19} y={26.4} width={14} height={5.2} rx={2.4}
        fill={colors.gold} stroke={colors.slab} strokeWidth={2.2}
      />
      <Path d="M23.4 27.4v3.2M28.6 27.4v3.2" stroke={colors.red} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
};

/**
 * Live minutes left: a stopwatch with what is left of the sweep still gold, and
 * a bolt where the hand should be.
 *
 * A plain clock face would have been the generic answer and it would also have
 * been the wrong one: this is not the time, it is a budget that runs down. The
 * gold arc is the part that has not been spent, which is the whole meaning of
 * the number beside it, and it is gold because minutes are the thing the plan
 * buys.
 *
 * The bolt is red rather than gold on purpose. Red is already what LIVE means
 * in this icon set: the Live tab is a camera with a red beacon lit on top of
 * it. So the mark reads as live time rather than as a second XP coin, which is
 * the confusion a gold bolt in a dial would have caused two tiles along.
 */
export const MinutesGlyph: React.FC<StatGlyphProps> = ({ size = 40, dim }) => {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" opacity={dim ? 0.38 : 1}>
      {/* crown and stem, which is what makes it a stopwatch and not a clock */}
      <Rect x={20.5} y={2.6} width={7} height={5} rx={2.2} fill={colors.slab} />
      <Rect x={22} y={6.4} width={4} height={8} rx={1.6} fill={colors.slab} />
      <Circle
        cx={24} cy={28.5} r={15}
        fill={colors.white} stroke={colors.slab} strokeWidth={3.2}
      />
      {/* What is left of the sweep, running clockwise from noon. The gap is
          the meaning: a closed gold ring would be a bezel, and a bezel says
          nothing about how much of anything is left. */}
      <Path
        d="M24 17A11.5 11.5 0 1 1 12.68 30.5"
        fill="none" stroke={colors.gold} strokeWidth={3.2} strokeLinecap="round"
      />
      <Path
        d="M25.66 21.97 19.58 30.06h3.96l-1.2 5.89 6.54-8.46h-4.05z"
        fill={colors.red} stroke={colors.slab} strokeWidth={2.2} strokeLinejoin="round"
      />
    </Svg>
  );
};
