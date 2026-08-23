import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { flush, track } from '../services/analytics';
import { goBack } from '../services/nav';
import { SafetyAck } from '../components/SafetyAck';
import { acceptSafety, hasAcceptedSafety } from '../services/gates';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useLiveBridge, type Stage } from '../hooks/useLiveBridge';
import { usePlan } from '../hooks/usePlan';
import { bumpMetric, loadProgress, saveProgress } from '../services/progress';
import { liveBridgeWsUrl } from '../services/config';
import { colors, font, radius, space, type } from '../theme/tokens';

const STAGES: Array<{ id: Stage; label: string }> = [
  { id: 'inventory', label: 'Parts' },
  { id: 'wiring', label: 'Wiring' },
  { id: 'code', label: 'Code' },
  { id: 'test', label: 'Test' },
];

export default function LiveTutor() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const sessionId = useRef(`live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;
  const [stage, setStage] = useState<Stage>('inventory');
  const [draft, setDraft] = useState('');
  const { canGoLive, minutesRemaining, unlimited, plan, loading: planLoading } = usePlan();

  const live = useLiveBridge({
    wsUrl: liveBridgeWsUrl(),
    userId: user?.uid ?? '',
    sessionId,
  });

  // Give the hook a way to pull one frame from the preview.
  useEffect(() => {
    live.registerFrameGrabber(async () => {
      try {
        const shot = await cameraRef.current?.takePictureAsync({
          base64: true, quality: 0.5, skipProcessing: true, shutterSound: false,
        });
        return shot?.base64 ?? null;
      } catch {
        return null;   // a dropped frame must never end the session
      }
    });
    return () => live.registerFrameGrabber(null);
  }, [live]);

  // The safety acknowledgement gates the FIRST live session, before the camera
  // and microphone are asked for. Shown once per uid, not per device: on a
  // shared phone the next person has not seen it.
  const [safetyOpen, setSafetyOpen] = useState(false);
  const pendingStart = useRef(false);

  const beginSession = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    await live.connect();
    live.setCamOn(true);
  }, [permission, requestPermission, live]);

  const start = useCallback(async () => {
    if (user?.uid && !(await hasAcceptedSafety(user.uid))) {
      pendingStart.current = true;
      setSafetyOpen(true);
      return;
    }
    await beginSession();
  }, [user?.uid, beginSession]);

  const onAcceptSafety = useCallback(async () => {
    if (user?.uid) await acceptSafety(user.uid);
    setSafetyOpen(false);
    if (pendingStart.current) {
      pendingStart.current = false;
      await beginSession();
    }
  }, [user?.uid, beginSession]);

  const connected = live.state === 'connected';
  const connecting = live.state === 'connecting';

  // Count a live session once it genuinely connects, not when the button is
  // pressed — a refused or failed connection is not a session.
  const counted = useRef(false);
  useEffect(() => {
    if (!connected || counted.current || !user?.uid) return;
    counted.current = true;
    // Fired here, not on the button, for the reason the counter is here: a
    // refused or failed connection is not a session, and counting one would
    // overstate activation.
    track('live_session_start', { stage });
    startedAt.current = Date.now();
    void (async () => {
      const p = await loadProgress(user.uid);
      await saveProgress(user.uid, bumpMetric(p, 'liveSessions'));
    })();
  }, [connected, user?.uid, stage]);

  // Length is the signal that separates "opened it" from "used it". Recorded on
  // unmount so it covers leaving the screen as well as ending deliberately.
  const startedAt = useRef<number | null>(null);
  useEffect(() => () => {
    if (startedAt.current === null) return;
    track('live_session_end', {
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    });
    void flush();
  }, []);

  const changeStage = (next: Stage) => {
    setStage(next);
    live.sendStage(next);
  };

  // ── Out of live budget ──
  // The server enforces this at the socket too; showing it here means a learner
  // finds out before the camera opens rather than after.
  if (!connected && !connecting && !planLoading && !canGoLive) {
    return (
      <View style={s.preflight}>
        <Pressable onPress={() => goBack('/home')} style={s.backLink}>
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>
        <Text style={s.eyebrow}>LIVE TUTOR</Text>
        <Text style={s.title}>That's this month's bench time.</Text>
        <Text style={s.body}>
          Your lessons, path and progress all stay open, and live time resets at the start of next
          month. More time is available on a paid plan.
        </Text>
        <Button label="See plans" onPress={() => router.push('/plans')} style={{ marginTop: space.lg }} />
      </View>
    );
  }

  // ── Pre-flight ──
  if (!connected && !connecting) {
    return (
      <View style={s.preflight}>
        <Pressable onPress={() => goBack('/home')} style={s.backLink}>
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>

        <Text style={s.eyebrow}>LIVE TUTOR</Text>
        <Text style={s.title}>Put your bench in frame.</Text>
        <Text style={s.body}>
          The tutor watches your board through the camera and talks you through the build. Prop your
          phone where it can see the breadboard, then start.
        </Text>

        {!live.micSupported && (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>Voice isn't on in this preview build</Text>
            <Text style={s.noticeBody}>
              Streaming your microphone needs the full app rather than Expo Go. The camera and the
              tutor both work now — type your questions and it replies out loud.
            </Text>
          </View>
        )}

        {!planLoading && (
          <Text style={s.budget}>
            {unlimited
              ? 'Unlimited live time on your plan.'
              : `${minutesRemaining ?? 0} minutes of live time left this month on ${plan === 'free' ? 'the Free plan' : `the ${plan} plan`}.`}
          </Text>
        )}

        {!!live.error && <Text style={s.error}>{live.error}</Text>}

        <Button label="Start the session" onPress={start} style={{ marginTop: space.lg }} />

        {/* Mounted here as well as in the live view: "Start the session" lives in
            this pre-flight return, which exits before the live render, so a modal
            mounted only there would never appear. */}
        <SafetyAck
          visible={safetyOpen}
          onAccept={onAcceptSafety}
          onCancel={() => { pendingStart.current = false; setSafetyOpen(false); }}
        />
      </View>
    );
  }

  // ── Live ──
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.stage}>
        {live.camOn ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.camOff]}>
            <Text style={s.camOffText}>Camera off</Text>
          </View>
        )}

        {/* Stage selector floats over the feed rather than stealing space from it. */}
        <View style={s.stageBar}>
          {STAGES.map((st) => {
            const active = st.id === stage;
            return (
              <Pressable
                key={st.id}
                onPress={() => changeStage(st.id)}
                style={[s.chip, active && s.chipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{st.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {connecting && (
          <View style={s.connecting}>
            <ActivityIndicator color={colors.gold} />
            <Text style={s.connectingText}>Waking the tutor…</Text>
          </View>
        )}

        {/* Transcript sits at the bottom of the feed, glass over video. */}
        <ScrollView style={s.transcript} contentContainerStyle={{ padding: space.md }}>
          {live.transcripts.slice(-6).map((t) => (
            <Text key={t.id} style={[s.line, t.role === 'user' ? s.lineUser : s.lineAgent]}>
              {t.text}
            </Text>
          ))}
        </ScrollView>
      </View>

      <View style={s.controls}>
        <View style={s.askRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask the tutor…"
            placeholderTextColor={colors.inkSoft}
            style={s.input}
            accessibilityLabel="Ask the tutor"
            onSubmitEditing={() => { live.sendText(draft, stage); setDraft(''); }}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => { live.sendText(draft, stage); setDraft(''); }}
            disabled={!draft.trim()}
            style={[s.send, !draft.trim() && s.sendOff]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Text style={s.sendText}>↑</Text>
          </Pressable>
        </View>

        <View style={s.buttonRow}>
          <Pressable onPress={() => live.setCamOn(!live.camOn)} style={s.ctrl} accessibilityRole="button">
            <Text style={s.ctrlText}>{live.camOn ? 'Camera off' : 'Camera on'}</Text>
          </Pressable>
          <Pressable onPress={() => void live.sendFrame()} style={s.ctrl} accessibilityRole="button">
            <Text style={s.ctrlText}>Look now</Text>
          </Pressable>
          <Pressable
            onPress={() => { live.disconnect(); goBack('/home'); }}
            style={[s.ctrl, s.ctrlEnd]}
            accessibilityRole="button"
          >
            <Text style={[s.ctrlText, s.ctrlEndText]}>End</Text>
          </Pressable>
        </View>
      </View>

      <SafetyAck
        visible={safetyOpen}
        onAccept={onAcceptSafety}
        onCancel={() => { pendingStart.current = false; setSafetyOpen(false); }}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.ink },
  preflight: { flex: 1, backgroundColor: colors.cream, padding: space.lg, paddingTop: space.xxl * 1.2 },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  body: { fontFamily: font.semibold, fontSize: type.body, color: colors.inkSoft, marginTop: space.md, lineHeight: 22 },
  notice: {
    marginTop: space.lg, backgroundColor: colors.blueSoft, borderWidth: 2,
    borderColor: colors.blueDeep, borderRadius: radius.md, padding: space.md,
  },
  noticeTitle: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  noticeBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4, lineHeight: 20 },
  error: { fontFamily: font.bold, fontSize: type.small, color: colors.red, marginTop: space.md },
  budget: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft, marginTop: space.lg },

  stage: { flex: 1, backgroundColor: colors.ink },
  camOff: { alignItems: 'center', justifyContent: 'center' },
  camOffText: { fontFamily: font.bold, fontSize: type.body, color: 'rgba(255,255,255,0.5)' },
  stageBar: {
    position: 'absolute', top: space.xxl * 1.2, left: space.md, right: space.md,
    flexDirection: 'row', gap: 6, justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.ink },
  chipText: { fontFamily: font.black, fontSize: type.meta, color: colors.white, letterSpacing: 0.5 },
  chipTextActive: { color: colors.ink },
  connecting: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  connectingText: { fontFamily: font.bold, fontSize: type.small, color: colors.white },
  transcript: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: 190,
    backgroundColor: 'rgba(20,24,31,0.55)',
  },
  line: { fontFamily: font.semibold, fontSize: type.small, lineHeight: 20, marginBottom: 6 },
  lineAgent: { color: colors.white },
  lineUser: { color: colors.gold, textAlign: 'right' },

  controls: { backgroundColor: colors.cream, padding: space.md, paddingBottom: space.xl, gap: space.sm },
  askRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: font.semibold, fontSize: type.body, color: colors.ink,
  },
  send: {
    width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.gold,
    borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
  sendText: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  buttonRow: { flexDirection: 'row', gap: space.sm },
  ctrl: {
    flex: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.md,
    backgroundColor: colors.white, paddingVertical: 11, alignItems: 'center',
  },
  ctrlText: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  ctrlEnd: { backgroundColor: colors.red, borderColor: colors.ink },
  ctrlEndText: { color: colors.white },
});
