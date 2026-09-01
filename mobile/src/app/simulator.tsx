import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppTabs } from '../components/AppTabs';
import { Button } from '../components/Button';
import { UnoBoard } from '../components/UnoBoard';
import { CircuitTab } from '../components/sim/CircuitTab';
import { CircuitBuilder } from '../components/sim/CircuitBuilder';
import { SandboxTab } from '../components/sim/SandboxTab';
import { LockableScrollView } from '../components/ScrollLock';
import { SimTabs, type SimTab } from '../components/sim/SimTabs';
import { AVRRunner, UNO_PIN, measureThroughput, type Port } from '../sim/avr';
import { compileSketch, compilerConfigured, type Diagnostic } from '../services/compiler';
import { track } from '../services/analytics';
import { font, radius, space, type, curve } from '../theme/tokens';
import { makeStyles, useColors } from '../theme/theme';

const STARTER = `// Blink the on-board LED, then fade pin 9.
void setup() {
  pinMode(13, OUTPUT);
  pinMode(9, OUTPUT);
  Serial.begin(9600);
  Serial.println("Ohmlet simulator ready");
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
  analogWrite(9, 64);   // a quarter brightness
}
`;

const PINS = Array.from({ length: 14 }, (_, i) => i);
const SAMPLE: Array<[Port, number]> = PINS.map((p) => UNO_PIN[p]).filter(Boolean) as Array<[Port, number]>;

/**
 * The simulator: a learner's real Arduino sketch, compiled by avr-gcc on our
 * service and executed on the phone by AVR8js. Not an animation of what the
 * code would do, the actual firmware running cycle by cycle.
 *
 * The frame budget is derived from a measurement taken on this device, not from
 * an assumed clock. React Native runs Hermes rather than V8, and a tight
 * interpreter loop is where they differ most, so a fixed 16 MHz budget would
 * freeze a frame on a slower phone. The measured speed is shown rather than
 * hidden: a learner watching a blink that is not quite one second deserves to
 * know why.
 */
export default function Simulator() {
  const colors = useColors();
  const s = useS();
  // Three ways into the same idea: write the code, turn the circuit, build it
  // on a board. They were one screen showing a single Arduino, which made the
  // simulator look like a code runner rather than a bench.
  const [tab, setTab] = useState<SimTab>('code');
  const [source, setSource] = useState(STARTER);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Diagnostic[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [duty, setDuty] = useState<number[]>(PINS.map(() => 0));
  const [serial, setSerial] = useState('');
  const [speed, setSpeed] = useState<number | null>(null);

  const runner = useRef<AVRRunner | null>(null);
  const frame = useRef<ReturnType<typeof setInterval> | null>(null);

  // Measured once. Cheap, and everything below depends on it being real.
  useEffect(() => {
    try {
      setSpeed(measureThroughput());
    } catch {
      setSpeed(null);
    }
  }, []);

  const stop = useCallback(() => {
    if (frame.current) { clearInterval(frame.current); frame.current = null; }
    setRunning(false);
  }, []);

  // A running simulation must not outlive the screen.
  useEffect(() => () => { if (frame.current) clearInterval(frame.current); }, []);

  const run = async () => {
    stop();
    setBusy(true); setErrors([]); setNote(null); setSerial('');
    const result = await compileSketch(source);
    setBusy(false);

    if (!result.ok) {
      if (result.reason === 'compile') {
        setErrors(result.errors);
        setNote(result.errors.length ? null : 'The sketch did not compile.');
      } else {
        setNote(
          result.reason === 'offline'
            ? 'You appear to be offline. Compiling needs a connection; the simulation itself runs on your phone.'
            : result.reason === 'auth'
              ? 'Sign in to compile a sketch.'
              : 'The compiler is busy right now. Try again in a moment.',
        );
      }
      return;
    }

    track('sketch_compile', { flashBytes: result.flashBytes, ramBytes: result.ramBytes });
    setNote(`${result.flashBytes} bytes of flash, ${result.ramBytes} bytes of RAM.`);

    const r = new AVRRunner(result.hex);
    runner.current = r;
    setRunning(true);
    track('simulator_open', {});

    // 20 frames a second, each carrying whatever this device can actually do in
    // 50 ms. Capped at real time so a fast phone does not race ahead of the
    // wall clock and make delay(500) finish early.
    const perFrame = Math.min(
      Math.round((speed ?? 4_000_000) * 0.05),
      Math.round(16_000_000 * 0.05),
    );
    frame.current = setInterval(() => {
      try {
        const d = r.runFrame(perFrame, SAMPLE);
        setDuty(d);
        if (r.serial) setSerial(r.serial.slice(-1200));
      } catch {
        stop();
        setNote('The sketch stopped unexpectedly.');
      }
    }, 50);
  };

  const factor = speed ? speed / 16_000_000 : null;

  if (tab === 'circuit') {
    return (
      <AppTabs active="practice">
        <SimTabs value={tab} onChange={setTab} />
        <CircuitTab />
      </AppTabs>
    );
  }

  if (tab === 'sandbox') {
    return (
      <AppTabs active="practice">
        <SimTabs value={tab} onChange={setTab} />
        <SandboxTab />
      </AppTabs>
    );
  }

  if (tab === 'build') {
    return (
      <AppTabs active="practice">
        <SimTabs value={tab} onChange={setTab} />
        {/* The builder renders a plain View with no scroller of its own, and its
            drag gestures refuse termination, so it sits inside this one without
            the two fighting over a vertical drag. */}
        <LockableScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.kicker}>BUILD</Text>
          <Text style={s.title}>Wire it yourself.</Text>
          <Text style={s.body}>
            Tap a pin, then tap another to join them. Everything you build is solved as you
            go, including the mistakes, which are the useful part.
          </Text>
          <CircuitBuilder style={{ marginTop: space.md }} />
        </LockableScrollView>
      </AppTabs>
    );
  }

  return (
    <AppTabs active="practice">
      <SimTabs value={tab} onChange={setTab} />
      <ScrollView style={s.flex} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.kicker}>SIMULATOR</Text>
        <Text style={s.title}>Run it without the hardware.</Text>
        <Text style={s.body}>
          Your sketch is compiled by the same toolchain a real Uno uses, then executed here
          instruction by instruction. No board required.
        </Text>

        <UnoBoard duty={duty} running={running} />

        {factor !== null && (
          <Text style={s.speed}>
            {factor >= 0.95
              ? 'Running at full speed on this device.'
              : `Running at about ${Math.round(factor * 100)}% of a real Uno on this device.`}
          </Text>
        )}

        <View style={s.actions}>
          <Button
            label={busy ? 'Compiling…' : running ? 'Restart' : 'Compile and run'}
            onPress={() => void run()}
            disabled={busy || !compilerConfigured()}
          />
          {running && (
            <Pressable onPress={stop} style={s.stop} accessibilityRole="button">
              <Text style={s.stopText}>Stop</Text>
            </Pressable>
          )}
        </View>

        {busy && <ActivityIndicator color={colors.goldDeep} style={{ marginTop: space.sm }} />}
        {!!note && <Text style={s.note}>{note}</Text>}

        {errors.length > 0 && (
          <View style={s.errors}>
            <Text style={s.errorsTitle}>The compiler said:</Text>
            {errors.slice(0, 6).map((e, i) => (
              <Text key={i} style={s.errorLine}>
                {e.line ? `Line ${e.line}: ` : ''}{e.message}
              </Text>
            ))}
          </View>
        )}

        <Text style={s.section}>YOUR SKETCH</Text>
        <TextInput
          value={source}
          onChangeText={setSource}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          style={s.editor}
          accessibilityLabel="Arduino sketch"
        />

        {!!serial && (
          <>
            <Text style={s.section}>SERIAL MONITOR</Text>
            <View style={s.serial}>
              <Text style={s.serialText}>{serial}</Text>
            </View>
          </>
        )}

        {!compilerConfigured() && (
          <Text style={s.note}>The compile service is not reachable from this build.</Text>
        )}
      </ScrollView>
    </AppTabs>
  );
}

const useS = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.body, color: colors.blueDeep },
  kicker: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 2.5, color: colors.blueDeep },
  title: { fontFamily: font.black, fontSize: type.title, color: colors.ink, marginTop: 6, letterSpacing: -0.6 },
  body: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.sm, marginBottom: space.md, lineHeight: 20,
  },
  speed: {
    fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft,
    marginTop: space.sm, textAlign: 'center',
  },
  actions: { marginTop: space.md, gap: space.sm },
  stop: { alignSelf: 'center', paddingVertical: space.sm },
  stopText: { fontFamily: font.bold, fontSize: type.small, color: colors.red },
  note: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: space.sm, lineHeight: 19 },
  errors: {
    marginTop: space.md, borderWidth: 2.5, borderColor: colors.red, borderRadius: radius.md, ...curve,
    backgroundColor: colors.redSoft, padding: space.md, gap: 4,
  },
  errorsTitle: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  errorLine: { fontFamily: font.regular, fontSize: type.meta, color: colors.ink, lineHeight: 17 },
  section: {
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 2,
    color: colors.inkSoft, marginTop: space.xl, marginBottom: space.sm,
  },
  editor: {
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.md, ...curve, backgroundColor: colors.surface,
    padding: space.md, minHeight: 240, textAlignVertical: 'top',
    fontFamily: 'Menlo', fontSize: 12, color: colors.ink, lineHeight: 18,
  },
  serial: {
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.md, ...curve,
    backgroundColor: colors.slab, padding: space.md, minHeight: 90,
  },
  serialText: { fontFamily: 'Menlo', fontSize: 11, color: '#9fe870', lineHeight: 16 },
}));
