import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path as SvgPath, Rect } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Lock } from '../icons';
import { SkillGlyph } from './SkillGlyph';
import type { CurriculumUnit } from '../../services/curriculum';
import { colors, curve, font, radius, space, type } from '../../theme/tokens';
import { elevation } from '../../theme/elevation';
import { stagger } from '../../theme/motion';

/**
 * A unit as a winding path rather than a list.
 *
 * A unit holds 11-14 lessons. Rendered as a list under plain headings, that is a
 * wall of identical rows and the skill grouping is read rather than felt. Laid
 * along a path with a checkpoint at every skill boundary, the same 12 lessons
 * become three or four short stretches, and where you are is visible without
 * counting.
 *
 * Nodes alternate sides and are joined by a cubic that bows through the middle,
 * with a resistor drawn on the wire — the brand's own component doing the job a
 * decorative dot would otherwise do. The exact midpoint of a symmetric cubic is
 * just the average of its endpoints, so the resistor needs no curve sampling.
 *
 * Node identity comes from the skill's AUTHORED icon. It deliberately does not
 * come from a lesson "type": all 142 lessons share essentially the same step mix
 * (true/false in 100% of them, multiple choice in 99%, draw in 95%), so a
 * per-lesson type label would be a distinction invented in the renderer rather
 * than one the curriculum actually makes.
 */

// Units whose path has already made its entrance this session. Reanimated's
// `entering` fires on MOUNT, and expo-router unmounts Home when a lesson is
// pushed — so every return from a lesson replayed the whole staggered reveal.
// Charming once, a tic by the fourth time. The set is module-level rather than
// state because it has to outlive the component that is being remounted.
const entered = new Set<string>();

// Mirrors backend/live-bridge/app/checkpoints.py, which pays per STEP rather
// than per lesson so that splitting a lesson into shorter sessions cannot
// change what the work is worth. Display only — the server computes the grant
// and owns the claim, so a client that got this wrong would show the wrong
// number, not pay the wrong amount.
const XP_PER_STEP = 0.5;

const CARD_H = 76;
const CHECK_H = 96;
const FILM_H = 84;
const GAP = 44;
const TILE = 52;

type Item =
  | { kind: 'lesson'; id: string; skillId: string; title: string; icon?: string; index: number }
  | { kind: 'checkpoint'; id: string; skillId: string; title: string; icon?: string }
  | { kind: 'film'; id: string; skillId: string; title: string };

interface Placed {
  item: Item;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const UnitPath: React.FC<{
  unit: CurriculumUnit;
  completed: ReadonlySet<string>;
  onStart: (lessonId: string) => void;
  /** Open the film for a skill. Absent on surfaces with no player. */
  onPlayFilm?: (skillId: string, title: string) => void;
  /** Overrides the unit's authored accent. Home colours units by position so
   *  that "the green one" is how a learner remembers where they got to, and the
   *  path has to carry the same colour or the wayfinding breaks at the banner. */
  accent?: string;
  /** A unit whose predecessor is unfinished: every node reads as locked. */
  locked?: boolean;
  /** Width to lay out in. Defaults to the window minus the screen gutter. */
  width?: number;
}> = ({ unit, completed, onStart, onPlayFilm, accent: accentProp, locked = false, width: widthProp }) => {
  const { width } = useWindowDimensions();
  const W = Math.max(240, widthProp ?? width - space.lg * 2);
  const CARD_W = Math.round(W * 0.68);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let n = 0;
    unit.skills.forEach((skill) => {
      skill.lessons.forEach((lesson) => {
        n += 1;
        out.push({
          kind: 'lesson',
          id: lesson.id,
          skillId: skill.id,
          title: lesson.title,
          icon: skill.icon,
          index: n,
        });
      });
      // The boundary is the point of the whole layout: it is where one idea
      // finishes and the next begins. A single-lesson skill gets none —
      // 15 of the 57 skills hold exactly one lesson, and a celebration every
      // other screen is how a reward stops being one. The server applies the
      // same rule, so nothing is drawn that could never pay out.
      if (skill.lessons.length >= 2) {
        out.push({ kind: 'checkpoint', id: `check:${skill.id}`, skillId: skill.id, title: skill.title, icon: skill.icon });
      }
      // After the checkpoint, not before the first lesson. Decided on
      // 2026-08-28 and written down in metadata/decisions: before practice,
      // motion is decoration; after it, motion is what makes a dozen discrete
      // facts cohere into one picture. A learner who has answered eight
      // questions about complete loops has the parts, and watching the current
      // stop when the wire is cut is what assembles them.
      //
      // `hasFilm` is stamped by the curriculum export from what is actually in
      // the bucket. Never inferred from the skill id: doing that put a play
      // button on six skills whose film does not exist.
      if (skill.hasFilm) {
        out.push({ kind: 'film', id: `film:${skill.id}`, skillId: skill.id, title: skill.title });
      }
    });
    return out;
  }, [unit]);

  const placed = useMemo<Placed[]>(() => {
    let y = 0;
    let side = 0;
    return items.map((item) => {
      if (item.kind === 'checkpoint' || item.kind === 'film') {
        // Full width, unlike every lesson node. Spanning the whole column is the
        // cheapest possible signal that this is not another lesson.
        const h = item.kind === 'film' ? FILM_H : CHECK_H;
        const p: Placed = { item, x: 0, y, w: W, h };
        y += h + GAP;
        // A full-width node spans the middle, so the side alternation restarts
        // after it rather than carrying a half-step through.
        side = 0;
        return p;
      }
      const p: Placed = { item, x: side === 0 ? 0 : W - CARD_W, y, w: CARD_W, h: CARD_H };
      y += CARD_H + GAP;
      side = 1 - side;
      return p;
    });
  }, [items, W, CARD_W]);

  const totalH = placed.length ? placed[placed.length - 1].y + placed[placed.length - 1].h : 0;

  // Read once per mount, before the effect below marks it seen, so the first
  // render of a first visit still animates.
  const animate = useRef(!entered.has(unit.id)).current;
  useEffect(() => { entered.add(unit.id); }, [unit.id]);

  // Unlocking is sequential: the next thing is open, everything past it is not.
  // A checkpoint opens only when its whole skill is cleared.
  const unlocked = useMemo(() => {
    const set = new Set<string>();
    if (locked) return set;
    let openNext = true;
    for (const it of items) {
      if (it.kind === 'lesson') {
        if (completed.has(it.id)) { set.add(it.id); continue; }
        if (openNext) { set.add(it.id); openNext = false; }
      } else if (openNext) {
        set.add(it.id);
      }
    }
    return set;
  }, [items, completed, locked]);

  // Matched on skill id, not on title: two skills can be titled the same and a
  // checkpoint that lit up because of another skill's lessons would be a lie
  // about the learner's progress.
  const isDone = (it: Item) =>
    it.kind === 'lesson'
      ? completed.has(it.id)
      : items.some((x) => x.kind === 'lesson' && x.skillId === it.skillId)
        && items
          .filter((x) => x.kind === 'lesson' && x.skillId === it.skillId)
          .every((x) => completed.has(x.id));

  const accent = accentProp ?? ACCENT[unit.accent] ?? colors.gold;

  // The manifest carries no step counts, so a session's steps are approximated
  // from the authored median (8). Only the label uses this; the server sends the
  // real figure with the grant.
  const xpFor = (skillId: string) => {
    const sessions = unit.skills.find((sk) => sk.id === skillId)?.lessons.length ?? 0;
    return Math.max(5, Math.round((sessions * 8 * XP_PER_STEP) / 5) * 5);
  };

  return (
    <View style={{ width: W, height: totalH, alignSelf: 'center' }}>
      {/* The wire, behind everything. One SVG for the whole run rather than a
          view per segment: a hundred tiny absolutely-positioned strips is the
          version of this that janks while scrolling. */}
      <Svg width={W} height={totalH} style={StyleSheet.absoluteFill} pointerEvents="none">
        {placed.slice(0, -1).map((a, i) => {
          const b = placed[i + 1];
          const ax = a.x + a.w / 2;
          const ay = a.y + a.h;
          const bx = b.x + b.w / 2;
          const by = b.y;
          const k = Math.max(18, (by - ay) * 0.55);
          const done = isDone(a.item) && isDone(b.item);
          const midX = (ax + bx) / 2;
          const midY = (ay + by) / 2;
          return (
            <React.Fragment key={a.item.id}>
              <SvgPath
                d={`M${ax} ${ay} C${ax} ${ay + k} ${bx} ${by - k} ${bx} ${by}`}
                stroke={done ? accent : colors.line}
                strokeWidth={7}
                strokeLinecap="round"
                fill="none"
              />
              {/* A resistor on the wire, not a bead. */}
              <Rect
                x={midX - 13} y={midY - 6.5} width={26} height={13} rx={3.5}
                fill={colors.white} stroke={done ? colors.ink : colors.inkMute} strokeWidth={2}
              />
              <Rect x={midX - 7} y={midY - 6.5} width={3} height={13} fill={done ? colors.ink : colors.inkMute} />
              <Rect x={midX - 1.5} y={midY - 6.5} width={3} height={13} fill={done ? accent : colors.inkMute} />
              <Rect x={midX + 4} y={midY - 6.5} width={3} height={13} fill={done ? colors.ink : colors.inkMute} />
            </React.Fragment>
          );
        })}
      </Svg>

      {placed.map((p, i) => {
        const done = isDone(p.item);
        const open = unlocked.has(p.item.id);
        return (
          <Animated.View
            key={p.item.id}
            entering={animate ? FadeInDown.delay(stagger(i, 34, 10)).springify().damping(18) : undefined}
            style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h }}
          >
            {p.item.kind === 'film' ? (
              <FilmNode
                title={p.item.title}
                unlocked={done}
                accent={accent}
                onPress={onPlayFilm ? () => onPlayFilm(p.item.skillId, p.item.title) : undefined}
              />
            ) : p.item.kind === 'checkpoint' ? (
              <Checkpoint title={p.item.title} done={done} xp={xpFor(p.item.skillId)} />
            ) : (
              <LessonNode
                item={p.item}
                done={done}
                open={open}
                accent={accent}
                onPress={() => onStart(p.item.id)}
              />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
};

const ACCENT: Record<string, string> = {
  gold: colors.gold,
  blue: colors.blue,
  green: colors.green,
  red: colors.red,
};

const CHEST = require('../../../assets/brand/checkpoint-chest.png');
const CHEST_OPEN = require('../../../assets/brand/checkpoint-chest-open.png');

const Tick: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <SvgPath d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke={colors.white} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LessonNode: React.FC<{
  item: Extract<Item, { kind: 'lesson' }>;
  done: boolean;
  open: boolean;
  accent: string;
  onPress: () => void;
}> = ({ item, done, open, accent, onPress }) => {
  const current = open && !done;
  return (
    <Pressable
      onPress={open ? onPress : undefined}
      disabled={!open}
      accessibilityRole="button"
      accessibilityLabel={`${item.index}. ${item.title}. ${done ? 'Complete' : open ? 'Next up' : 'Locked'}`}
      style={({ pressed }) => [
        n.card,
        current && { borderColor: colors.ink, ...elevation.lifted },
        !open && n.cardLocked,
        pressed && open && n.pressed,
      ]}
    >
      <View style={[n.tile, done && { backgroundColor: accent }, !open && n.tileLocked]}>
        <SkillGlyph name={item.icon} size={24} color={open ? colors.ink : colors.inkMute} />
      </View>
      <View style={n.body}>
        <Text style={[n.index, !open && n.mutedText]}>{item.index}</Text>
        <Text style={[n.title, !open && n.mutedText]} numberOfLines={2}>{item.title}</Text>
      </View>
      {done && <View style={[n.badge, { backgroundColor: colors.greenDeep }]}><Tick /></View>}
      {!open && <View style={[n.badge, n.badgeLocked]}><Lock size={12} /></View>}
    </Pressable>
  );
};

const Checkpoint: React.FC<{ title: string; done: boolean; xp: number }> = ({ title, done, xp }) => (
  <View
    style={[cp.card, done && cp.cardDone]}
    accessibilityLabel={`Checkpoint: ${title}. ${done ? `Cleared, ${xp} XP` : `Worth ${xp} XP`}`}
  >
    <View style={[cp.chest, done && cp.chestDone]}>
      {/* Closed until it is earned, open once it is. A fixed square with
          contain normalises the two, which have different aspect ratios —
          the open lid makes it taller. */}
      <Image
        source={done ? CHEST_OPEN : CHEST}
        style={[cp.chestArt, !done && cp.chestArtLocked]}
        contentFit="contain"
        transition={done ? 260 : 0}
        accessible={false}
      />
    </View>
    <View style={cp.body}>
      <Text style={cp.kicker}>{done ? 'CHECKPOINT CLEARED' : 'CHECKPOINT'}</Text>
      <Text style={cp.title} numberOfLines={1}>{title}</Text>
      <Text style={[cp.xp, done && cp.xpDone]}>+{xp} XP</Text>
    </View>
    {done ? (
      <View style={cp.tick}><Tick size={16} /></View>
    ) : (
      <View style={cp.pending}><Lock size={14} /></View>
    )}
  </View>
);

/**
 * The film node.
 *
 * Deliberately a different animal from the checkpoint it follows. The checkpoint
 * is a white card with a chest and an XP figure: a reward, and it looks like
 * one. This is ink and glass with a screen on it, because a film is a different
 * kind of thing and two nodes that differ only in their words are two nodes a
 * learner stops reading.
 *
 * The artwork is drawn here rather than painted, in the same vocabulary as the
 * resistors on the wire: a scope screen with a trace across it and a play
 * triangle. If a painted icon arrives to sit beside the chest, this swaps for an
 * Image and nothing else changes.
 *
 * Locked until the skill is cleared, which is the whole placement argument: the
 * film consolidates the practice, so it cannot come first.
 */
const FilmNode: React.FC<{
  title: string;
  unlocked: boolean;
  accent: string;
  onPress?: () => void;
}> = ({ title, unlocked, accent, onPress }) => {
  const body = (
    <>
      <View style={[fm.screen, !unlocked && fm.screenLocked]}>
        <Svg width={38} height={30} viewBox="0 0 38 30">
          {/* The scope face. */}
          <Rect
            x={1.5} y={1.5} width={35} height={27} rx={5}
            fill={unlocked ? colors.ink : 'transparent'}
            stroke={unlocked ? accent : colors.inkMute}
            strokeWidth={2.5}
          />
          {/* A trace across it, so the screen is showing something. */}
          <SvgPath
            d="M6 19 C10 19 10 11 14 11 C18 11 18 19 22 19 C26 19 26 11 30 11 C32 11 32 15 32 15"
            stroke={unlocked ? accent : colors.inkMute}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            opacity={unlocked ? 0.45 : 0.8}
          />
          {/* And the play control on top of it. */}
          <SvgPath
            d="M15.5 9.5 L26 15 L15.5 20.5 Z"
            fill={unlocked ? colors.white : colors.inkMute}
          />
        </Svg>
      </View>
      <View style={fm.body}>
        <Text style={[fm.kicker, !unlocked && fm.kickerLocked]}>
          {unlocked ? 'FILM' : 'FILM LOCKED'}
        </Text>
        <Text style={[fm.title, !unlocked && fm.titleLocked]} numberOfLines={1}>{title}</Text>
        <Text style={[fm.sub, !unlocked && fm.subLocked]} numberOfLines={1}>
          {unlocked ? 'Watch the idea move' : 'Clear this skill to unlock'}
        </Text>
      </View>
      {!unlocked && <View style={fm.lock}><Lock size={14} /></View>}
    </>
  );

  const label = unlocked
    ? `Film: ${title}. Watch the idea move.`
    : `Film for ${title}, locked until the skill is cleared`;

  if (!unlocked || !onPress) {
    return <View style={[fm.card, !unlocked && fm.cardLocked]} accessible accessibilityLabel={label}>{body}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [fm.card, pressed && fm.cardPressed]}
    >
      {body}
    </Pressable>
  );
};

const fm = StyleSheet.create({
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.ink, borderWidth: 2.5, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, paddingHorizontal: space.md, ...elevation.card,
  },
  // Not the ink card drained: an unwatchable film should read as a thing you
  // have not got to, the same way a locked lesson does, rather than as a broken
  // version of the watchable one.
  cardLocked: {
    backgroundColor: colors.cream, borderColor: colors.inkFaint, ...elevation.flush,
  },
  cardPressed: { transform: [{ translateY: 2 }], ...elevation.flush },
  screen: {
    width: 52, height: 44, borderRadius: radius.md, ...curve,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  screenLocked: { backgroundColor: 'transparent' },
  body: { flex: 1, minWidth: 0 },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.8, color: colors.gold },
  kickerLocked: { color: colors.inkMute },
  title: { fontFamily: font.black, fontSize: type.label, color: colors.white, letterSpacing: -0.2 },
  titleLocked: { color: colors.inkSoft },
  sub: { fontFamily: font.semibold, fontSize: type.small, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  // The locked card is cream, so white-at-55% would be an invisible line of
  // text saying how to unlock the thing, which is the one sentence that has to
  // be readable when it is locked.
  subLocked: { color: colors.inkMute },
  lock: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.inkFaint,
    alignItems: 'center', justifyContent: 'center',
  },
});

const n = StyleSheet.create({
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.line,
    borderRadius: radius.lg, ...curve, paddingHorizontal: 10, ...elevation.card,
  },
  cardLocked: { backgroundColor: colors.cream, borderColor: colors.inkFaint, ...elevation.flush },
  pressed: { transform: [{ translateY: 2 }], ...elevation.flush },
  tile: {
    width: TILE, height: TILE, borderRadius: radius.md, ...curve,
    backgroundColor: colors.goldSoft, borderWidth: 2, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  tileLocked: { backgroundColor: colors.inkFaint, borderColor: colors.inkMute },
  body: { flex: 1, minWidth: 0 },
  index: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 1.4, color: colors.inkSoft },
  title: { fontFamily: font.black, fontSize: type.label, color: colors.ink, letterSpacing: -0.2, lineHeight: 18 },
  mutedText: { color: colors.inkMute },
  badge: {
    position: 'absolute', top: -8, right: -8,
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2.5, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeLocked: { backgroundColor: colors.inkFaint, borderColor: colors.cream },
});

const cp = StyleSheet.create({
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.goldSoft,
    borderWidth: 3, borderColor: colors.inkMute,
    borderRadius: radius.lg, ...curve, paddingHorizontal: space.md,
    borderStyle: 'dashed',
    ...elevation.card,
  },
  // Cleared: solid border, full gold, no longer provisional.
  cardDone: {
    backgroundColor: colors.gold, borderColor: colors.ink, borderStyle: 'solid',
    ...elevation.lifted,
  },
  chest: {
    width: 56, height: 56, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.inkMute,
    alignItems: 'center', justifyContent: 'center',
  },
  chestDone: { borderColor: colors.ink },
  chestArt: { width: 44, height: 44 },
  // Drained rather than hidden, so an unearned checkpoint reads as a reward
  // not yet taken rather than as an empty slot.
  chestArtLocked: { opacity: 0.38 },
  body: { flex: 1, minWidth: 0 },
  kicker: { fontFamily: font.black, fontSize: 10, letterSpacing: 2.2, color: colors.goldText },
  title: {
    fontFamily: font.black, fontSize: type.bodyLg, color: colors.ink,
    letterSpacing: -0.3, marginTop: 1,
  },
  xp: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft, marginTop: 2 },
  xpDone: { color: colors.ink },
  tick: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.greenDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  pending: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.inkMute,
    alignItems: 'center', justifyContent: 'center',
  },
});
