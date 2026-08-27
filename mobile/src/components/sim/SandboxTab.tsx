import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Sandbox3D, pinDriveFromDuty, starterBuild,
  type PartKind, type PlacedPart, type SandboxTool, type Wire,
} from '../sandbox3d';
import { LockableScrollView } from '../ScrollLock';
import { colors, curve, font, radius, space, tabular, type } from '../../theme/tokens';
import { elevation } from '../../theme/elevation';

/**
 * The 3D breadboard.
 *
 * Sandbox3D is fully controlled on purpose: it renders what it is given and
 * reports taps, so the board's contents live here where they can be saved,
 * shared or handed to a lesson later. A component that owned its own state would
 * make all three of those a rewrite.
 */

const PALETTE: { kind: PartKind; label: string }[] = [
  { kind: 'led', label: 'LED' },
  { kind: 'resistor', label: 'Resistor' },
  { kind: 'ldr', label: 'Photocell' },
  { kind: 'capacitor', label: 'Capacitor' },
  { kind: 'pushbutton', label: 'Button' },
  { kind: 'buzzer', label: 'Buzzer' },
  { kind: 'transistor', label: 'Transistor' },
];

export const SandboxTab: React.FC = () => {
  const starter = useMemo(() => starterBuild(), []);
  const [parts, setParts] = useState<PlacedPart[]>(starter.parts);
  const [wires, setWires] = useState<Wire[]>(starter.wires);
  const [tool, setTool] = useState<SandboxTool>('select');
  const [pending, setPending] = useState<PartKind | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [light, setLight] = useState(0.7);
  const nextId = useRef(0);

  // pinDriveFromDuty is indexed BY PIN, so the array is sparse by design:
  // a pin present at 0 is driven LOW, a pin absent is an input and floats.
  // The starter board drives its alarm from D9, so that is the one that matters.
  const drive = useMemo(() => {
    const duty: number[] = [];
    duty[9] = 1;
    duty[13] = 1;
    return pinDriveFromDuty(duty);
  }, []);

  // The starter board is the LDR alarm from the curriculum, so the sandbox opens
  // on something that already works rather than an empty grid. An empty board is
  // the least useful thing to hand someone who has not built one before.
  const reset = useCallback(() => {
    const fresh = starterBuild();
    setParts(fresh.parts);
    setWires(fresh.wires);
    setSelected(null);
  }, []);

  const place = useCallback((hole: string, kind: PartKind) => {
    nextId.current += 1;
    setParts((p) => [...p, { id: `${kind}-${nextId.current}`, kind, anchor: hole }]);
    setTool('select');
    setPending(null);
  }, []);

  const erase = useCallback((id: string) => {
    setParts((p) => p.filter((x) => x.id !== id));
    setWires((w) => w.filter((x) => x.id !== id));
    setSelected(null);
  }, []);

  return (
    <LockableScrollView contentContainerStyle={s.scroll}>
      <View style={s.kickerRow}>
        <Text style={s.kicker}>SANDBOX</Text>
        {/* The web sandbox carries a Beta mark next to its kicker and its
            heading, because the simulation is still growing and a learner is
            owed that before they trust a result. The phone said nothing at
            all. Same meaning, mobile shapes: a bordered blue plate rather
            than the web's soft pill, since every chip in this app is plated. */}
        <View style={s.beta}>
          <Text style={s.betaText}>BETA</Text>
        </View>
      </View>
      <Text style={s.title}>Build it on a board.</Text>
      <Text style={s.body}>
        A real breadboard, with the strips and rails wired the way a real one is. Drag to
        orbit, pinch to zoom. Hold a finger on the board and it names the hole you are
        over, so you can slide onto the right one before you let go. Everything you place
        is solved, so the LED lights because current is reaching it.
      </Text>

      <View style={s.stage}>
        <Sandbox3D
          parts={parts}
          wires={wires}
          tool={tool}
          pendingKind={pending}
          selectedId={selected}
          running
          ambientLight={light}
          pinDrive={drive}
          quality="auto"
          height={340}
          onPlacePart={place}
          onMovePart={(id, hole) =>
            setParts((p) => p.map((x) => (x.id === id ? { ...x, anchor: hole } : x)))}
          onSelect={setSelected}
          onErase={erase}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {PALETTE.map((p) => {
          const on = tool === 'place' && pending === p.kind;
          return (
            <Pressable
              key={p.kind}
              onPress={() => {
                if (on) { setTool('select'); setPending(null); return; }
                setTool('place');
                setPending(p.kind);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityHint="Then tap a hole on the board"
              style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.chipPressed]}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Light is the input the starter board actually responds to, so it is the
          one control worth surfacing: cover the photocell and the alarm fires. */}
      <View style={s.controlCard}>
        <View style={s.controlHead}>
          <Text style={s.controlLabel}>Light on the photocell</Text>
          <Text style={s.controlValue}>{Math.round(light * 100)}%</Text>
        </View>
        <View style={s.lightRow}>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <Pressable
              key={v}
              onPress={() => setLight(v)}
              accessibilityRole="button"
              style={({ pressed }) => [s.step, light === v && s.stepOn, pressed && s.chipPressed]}
            >
              <Text style={[s.stepText, light === v && s.stepTextOn]}>
                {v === 0 ? 'Dark' : v === 1 ? 'Bright' : `${Math.round(v * 100)}%`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={reset} style={s.reset} accessibilityRole="button">
        <Text style={s.resetText}>Reset the board</Text>
      </Pressable>
    </LockableScrollView>
  );
};

const s = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft },
  beta: {
    backgroundColor: colors.blueSoft,
    borderWidth: 2, borderColor: colors.blue,
    borderRadius: 999, ...curve,
    paddingHorizontal: 8, paddingVertical: 1,
  },
  betaText: {
    fontFamily: font.black, fontSize: type.meta, color: colors.blueDeep, letterSpacing: 1.4,
  },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -1, marginTop: 4 },
  body: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft, marginTop: space.sm, lineHeight: 20 },
  stage: {
    marginTop: space.md, borderRadius: radius.lg, ...curve, overflow: 'hidden',
    borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.white, ...elevation.card,
  },
  chips: { gap: 8, paddingVertical: space.md, paddingRight: space.lg },
  chip: {
    borderWidth: 2, borderColor: colors.line, borderRadius: 999, ...curve,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipPressed: { transform: [{ scale: 0.97 }] },
  chipText: { fontFamily: font.black, fontSize: type.small, color: colors.inkSoft },
  chipTextOn: { color: colors.white },
  controlCard: {
    backgroundColor: colors.goldSoft, borderWidth: 2.5, borderColor: colors.goldPlate,
    borderRadius: radius.lg, ...curve, padding: space.md,
  },
  controlHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  controlLabel: { fontFamily: font.black, fontSize: type.small, color: colors.goldText },
  controlValue: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, ...tabular },
  lightRow: { flexDirection: 'row', gap: 6, marginTop: space.sm },
  step: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: radius.sm, ...curve, backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.goldPlate,
  },
  stepOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  stepText: { fontFamily: font.black, fontSize: type.meta, color: colors.goldText },
  stepTextOn: { color: colors.white },
  reset: { marginTop: space.lg, alignSelf: 'center', paddingVertical: space.sm },
  resetText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
