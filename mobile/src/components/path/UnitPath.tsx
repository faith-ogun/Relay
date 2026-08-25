import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path as SvgPath, Rect } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
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

const CARD_H = 76;
const CHECK_H = 84;
const GAP = 44;
const TILE = 52;

type Item =
  | { kind: 'lesson'; id: string; skillId: string; title: string; icon?: string; index: number }
  | { kind: 'checkpoint'; id: string; skillId: string; title: string; icon?: string };

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
}> = ({ unit, completed, onStart }) => {
  const { width } = useWindowDimensions();
  const W = Math.max(280, width - space.lg * 2);
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
      // finishes and the next begins.
      out.push({ kind: 'checkpoint', id: `check:${skill.id}`, skillId: skill.id, title: skill.title, icon: skill.icon });
    });
    return out;
  }, [unit]);

  const placed = useMemo<Placed[]>(() => {
    let y = 0;
    let side = 0;
    return items.map((item) => {
      if (item.kind === 'checkpoint') {
        const p: Placed = { item, x: (W - Math.round(W * 0.82)) / 2, y, w: Math.round(W * 0.82), h: CHECK_H };
        y += CHECK_H + GAP;
        // A checkpoint spans the middle, so the side alternation restarts after
        // it rather than carrying a half-step through.
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

  // Unlocking is sequential: the next thing is open, everything past it is not.
  // A checkpoint opens only when its whole skill is cleared.
  const unlocked = useMemo(() => {
    const set = new Set<string>();
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
  }, [items, completed]);

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

  const accent = ACCENT[unit.accent] ?? colors.gold;

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
            entering={FadeInDown.delay(stagger(i, 34, 10)).springify().damping(18)}
            style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h }}
          >
            {p.item.kind === 'checkpoint' ? (
              <Checkpoint title={p.item.title} icon={p.item.icon} done={done} accent={accent} />
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

const Checkpoint: React.FC<{ title: string; icon?: string; done: boolean; accent: string }> = ({
  title, icon, done, accent,
}) => (
  <View
    style={[c.card, done && { borderColor: colors.goldPlate, backgroundColor: colors.goldSoft }]}
    accessibilityLabel={`Checkpoint: ${title} ${done ? 'cleared' : 'not yet reached'}`}
  >
    <View style={[c.ring, done && { backgroundColor: accent, borderColor: colors.ink }]}>
      <SkillGlyph name={icon} size={22} color={done ? colors.ink : colors.inkMute} />
    </View>
    <View style={c.body}>
      <Text style={c.kicker}>{done ? 'CHECKPOINT CLEARED' : 'CHECKPOINT'}</Text>
      <Text style={c.title} numberOfLines={1}>{title}</Text>
    </View>
    {done && <View style={c.tick}><Tick size={15} /></View>}
  </View>
);

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

const c = StyleSheet.create({
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.inkFaint,
    borderRadius: 999, ...curve, paddingHorizontal: 12, ...elevation.card,
  },
  ring: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.inkFaint, borderWidth: 2, borderColor: colors.inkMute,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  kicker: { fontFamily: font.black, fontSize: 9, letterSpacing: 2, color: colors.inkSoft },
  title: { fontFamily: font.black, fontSize: type.small, color: colors.ink, marginTop: 1 },
  tick: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.greenDeep,
    alignItems: 'center', justifyContent: 'center',
  },
});
