import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue,
  withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { flush, track } from '../services/analytics';
import { goBack } from '../services/nav';
import { SafetyAck } from '../components/SafetyAck';
import { acceptSafety, hasAcceptedSafety } from '../services/gates';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useChildSafe } from '../hooks/useChildSafe';
import { useLiveBridge, type MicPermission, type Stage, type Transcript } from '../hooks/useLiveBridge';
import { componentHandoff, inventoryHandoff, useKitCheck } from '../hooks/useKitCheck';
import { usePlan } from '../hooks/usePlan';
import { bumpMetric, loadProgress, saveProgress } from '../services/progress';
import {
  buildIntro, buildSwitch, getBuilds, rememberBuild, rememberedBuild, type Build,
} from '../services/builds';
import { BuildPicker } from '../components/build/BuildPicker';
import { BuildSlot } from '../components/build/BuildSlot';
import { KitCheckSheet } from '../components/build/KitCheckSheet';
import { liveBridgeWsUrl } from '../services/config';
import { colors, font, radius, space, type, curve } from '../theme/tokens';

const STAGES: Array<{ id: Stage; label: string }> = [
  { id: 'inventory', label: 'Parts' },
  { id: 'wiring', label: 'Wiring' },
  { id: 'code', label: 'Code' },
  { id: 'test', label: 'Test' },
];

/** How many lines the overlay draws. The hook keeps more; this is what fits. */
const VISIBLE_LINES = 40;

/**
 * One line of the session transcript. Three roles, three different shapes: the
 * tutor speaks in full-width lines against a gold rule, the learner's own turns
 * are right-aligned gold chips, and status notes are quiet centred captions.
 * Reading who said what has to be instant over a moving camera feed.
 */
function TranscriptLine({ entry }: { entry: Transcript }) {
  if (entry.role === 'system') {
    return (
      <Text style={s.lineSystem} accessibilityLabel={`Session status: ${entry.text}`}>
        {entry.text}
      </Text>
    );
  }
  if (entry.role === 'user') {
    return (
      <Text style={s.lineUser} accessibilityLabel={`You said: ${entry.text}`}>
        {entry.text}
      </Text>
    );
  }
  return (
    <View style={s.agentRow}>
      <View style={s.agentRule} />
      <Text style={s.lineAgent} accessibilityLabel={`Tutor said: ${entry.text}`}>
        {entry.text}
      </Text>
    </View>
  );
}

/**
 * The microphone glyph, drawn rather than borrowed: a capsule, the pickup arc
 * under it and the stand, on the same 24 unit grid and 2.2 stroke as everything
 * in components/icons.tsx, so it sits beside them without looking imported.
 */
function MicGlyph({ size = 22, color, muted = false }: { size?: number; color: string; muted?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.9a2.9 2.9 0 0 1 2.9 2.9v5.4a2.9 2.9 0 0 1-5.8 0V5.8A2.9 2.9 0 0 1 12 2.9z"
        fill={color}
      />
      <Path
        d="M6.2 11.1a5.8 5.8 0 0 0 11.6 0"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path d="M12 16.9v4.2" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      {muted && (
        <Path d="M4.4 3.6 19.6 20.4" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      )}
    </Svg>
  );
}

/**
 * The voice control. Round where every other control on this screen is a
 * rectangle, because it is the one the product is actually about: the learner
 * talks, the tutor answers, and typing is the fallback underneath it.
 *
 * Three states, three readings. Off is an outline. Listening fills gold and
 * breathes a ring outwards so a learner glancing up from the breadboard can
 * tell at a distance that it is still hearing them. Refused is a struck-through
 * mic that opens the settings page rather than a prompt the OS will not show
 * again.
 */
function MicControl({
  listening, armed, permission, onPress,
}: {
  /** Capture is running: the tutor can hear the room right now. */
  listening: boolean;
  /** The learner has turned it on. It may not be capturing yet, mid-connect. */
  armed: boolean;
  permission: MicPermission;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  const denied = permission === 'denied';

  useEffect(() => {
    if (!listening || reduced) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [listening, reduced, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.6 }],
  }));

  const glyphColor = denied ? colors.red : armed ? colors.goldText : colors.ink;

  return (
    <View style={s.micWrap}>
      {listening && <Animated.View pointerEvents="none" style={[s.micRing, ring]} />}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.mic,
          armed && s.micLive,
          armed && !listening && s.micWaiting,
          denied && s.micDenied,
          pressed && s.micPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: listening }}
        accessibilityLabel={
          denied
            ? 'Microphone blocked. Open settings'
            : listening
              ? 'Stop talking to the tutor'
              : armed
                ? 'Microphone on, waiting for the tutor'
                : 'Talk to the tutor'
        }
        accessibilityHint={
          denied
            ? 'Opens your phone settings so you can allow Ohmlet to use the microphone'
            : armed
              ? 'Turns the microphone off. You can still type.'
              : 'Turns the microphone on so the tutor can hear you'
        }
      >
        <MicGlyph color={glyphColor} muted={denied} />
      </Pressable>
    </View>
  );
}

export default function LiveTutor() {
  const { user, loading: authLoading } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const transcriptRef = useRef<ScrollView>(null);
  const sessionId = useRef(`live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;
  const [stage, setStage] = useState<Stage>('inventory');
  const [draft, setDraft] = useState('');
  const { canGoLive, minutesRemaining, unlimited, plan, loading: planLoading } = usePlan();
  // Child mode is inert unless EXPO_PUBLIC_OHMLET_CHILD_MODE is on: useChildSafe
  // returns false for everyone while the flag is off. `resolved` is the half
  // that matters for the microphone: until the age question has an answer,
  // nobody knows whether a minor is holding the phone, so nothing opens.
  const { childSafe, resolved: childSafeResolved } = useChildSafe();

  // Step 2 of the loop. Declared before the socket because the socket's
  // background frame heartbeat has to stand down while the shutter is in use:
  // two takePictureAsync calls at once on the same preview is one of them
  // failing, and the one that fails would be the learner's kit check.
  const kit = useKitCheck(cameraRef);
  const kitBusy = kit.phase === 'capturing' || kit.phase === 'checking';

  const live = useLiveBridge({
    wsUrl: liveBridgeWsUrl(),
    userId: user?.uid ?? '',
    sessionId,
    childSafe,
    childSafeResolved,
    // undefined keeps the hook's own default rather than restating it here.
    visionIntervalMs: kitBusy ? 0 : undefined,
  });

  // ── Step 1 of the loop: what are we building ──
  //
  // The library is served, not bundled (services/builds.ts), so this screen has
  // to be honest about all three states it can be in: still loading, loaded, and
  // unreachable with nothing cached. The last one must not lock a learner out of
  // a live session, because an open bench session is still a session; it only
  // costs them the kit check, which has nothing to check against.
  const [catalogue, setCatalogue] = useState<Build[]>([]);
  const [build, setBuild] = useState<Build | null>(null);
  const [buildsLoading, setBuildsLoading] = useState(true);
  const [libraryUnreachable, setLibraryUnreachable] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadBuilds = useCallback(async () => {
    setBuildsLoading(true);
    // The refresh callback re-resolves the chosen build from the new copy, so a
    // corrected parts list reaches a session that is already open.
    const loaded = user?.uid
      ? await getBuilds((fresh) => {
          setCatalogue(fresh.builds);
          setBuild((prev) => (prev ? fresh.builds.find((b) => b.id === prev.id) ?? prev : prev));
        })
      : null;
    if (loaded) {
      setCatalogue(loaded.builds);
      const remembered = await rememberedBuild(loaded);
      // A learner who came back to the same build should not have to pick it
      // again, but a choice made while this was in flight wins.
      setBuild((prev) => prev ?? remembered);
    }
    setLibraryUnreachable(!loaded);
    setBuildsLoading(false);
  }, [user?.uid]);

  // Not while auth is still resolving. The request needs a token, and running it
  // a moment early would answer "unreachable" and flash the empty state at a
  // learner whose library is sitting on the device.
  useEffect(() => {
    if (authLoading) return;
    void loadBuilds();
  }, [authLoading, loadBuilds]);

  // Step 1 is not optional while there is a library to choose from. When there
  // is not one yet (first run with no signal) the session still starts; it just
  // starts without a kit check, which would have nothing to check against.
  const mustPickBuild = !buildsLoading && catalogue.length > 0 && !build;

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
    // Both permission sheets belong to this one press. Asking for the
    // microphone later, mid-build, puts a system dialog in front of a learner
    // whose hands are on the board.
    //
    // Not for a minor. Child mode's rule is that a minor's microphone opens
    // only under their own hand on the mic control, so a child-safe session
    // starts camera-and-text and waits to be asked. Same rule while the age
    // question is still resolving, because nobody knows yet which it is.
    if (live.micSupported && childSafeResolved && !childSafe) {
      await live.enableMic();
    }
    await live.connect();
    live.setCamOn(true);
  }, [permission, requestPermission, live, childSafe, childSafeResolved]);

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

  // ── The build, and telling the tutor about it ──
  //
  // A build the tutor does not know about is a dropdown, not step 1. The choice
  // opens the session, and changing it mid-session is said out loud too, so the
  // guidance follows the learner rather than the other way round.
  const introSent = useRef(false);

  useEffect(() => {
    // A dropped socket is a new agent session, not a pause in this one: the
    // server rebuilds its stage from the default on every connection, and a
    // reconnect can land on a different Cloud Run instance whose session store
    // has never heard of this learner. useLiveBridge re-sends the stage for
    // that reason; the build has to travel with it, or the tutor comes back
    // confidently guiding a build nobody has told it about.
    if (!connected) {
      introSent.current = false;
      return;
    }
    if (introSent.current || !build) return;
    introSent.current = true;
    live.sendText(buildIntro(build), stage);
  }, [connected, build, live, stage]);

  const chooseBuild = useCallback((next: Build) => {
    setPickerOpen(false);
    const same = build?.id === next.id;
    setBuild(next);
    void rememberBuild(next.id);

    if (!connected) return;                       // the effect above will open with it
    if (same && introSent.current) return;        // nothing has changed to tell anyone
    // A build chosen inside a session that began without one is still the
    // opening line, not a change of plan.
    const opening = !introSent.current;
    introSent.current = true;
    live.sendText(opening ? buildIntro(next) : buildSwitch(next), stage);
  }, [build, connected, live, stage]);

  // ── Step 2 of the loop: the camera kit check ──
  // (the hook itself is declared above, with the socket that shares its camera)
  const [kitOpen, setKitOpen] = useState(false);
  const [toldTutor, setToldTutor] = useState(false);

  const runKitCheck = useCallback(() => {
    if (!build) return;
    setToldTutor(false);
    setKitOpen(true);
    void kit.checkInventory(build.parts, build.title);
  }, [build, kit]);

  const runIdentify = useCallback(() => {
    setToldTutor(false);
    setKitOpen(true);
    void kit.identify();
  }, [kit]);

  const retryKit = useCallback(() => {
    setToldTutor(false);
    void kit.retry();
  }, [kit]);

  const closeKit = useCallback(() => {
    setKitOpen(false);
    setToldTutor(false);
    kit.reset();
  }, [kit]);

  // The check belongs to the Parts stage, and only while there is a picture to
  // take. On the Wiring stage it would photograph a half-built board and report
  // half the kit missing, which is worse than not offering it.
  const showKitActions = stage === 'inventory' && live.camOn && kit.available;

  // Hand the verdict to the tutor. This is the whole point of the check: the
  // next thing the tutor says should be about the bench the learner has, not
  // the bench the build assumes. Sent once per result, and only while the
  // socket is up, so the sheet never claims something that did not happen.
  const handedOff = useRef<object | null>(null);
  useEffect(() => {
    if (kit.phase !== 'done' || !connected) return;
    const result = kit.inventory ?? kit.component;
    if (!result || handedOff.current === result) return;
    const message = kit.inventory
      ? inventoryHandoff(kit.inventory, build?.title)
      : kit.component
        ? componentHandoff(kit.component)
        : '';
    if (!message) return;
    handedOff.current = result;
    live.sendText(message, stage);
    setToldTutor(true);
  }, [kit.phase, kit.inventory, kit.component, connected, build?.title, live, stage]);

  // ── Out of live budget ──
  // The server enforces this at the socket too; showing it here means a learner
  // finds out before the camera opens rather than after.
  if (!connected && !connecting && !planLoading && !canGoLive) {
    return (
      <View style={[s.preflight, s.preflightInner]}>
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
      <ScrollView
        style={s.preflight}
        contentContainerStyle={s.preflightInner}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => goBack('/home')} style={s.backLink}>
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>

        <Text style={s.eyebrow}>LIVE TUTOR</Text>
        <Text style={s.title}>Put your bench in frame.</Text>
        <Text style={s.body}>
          The tutor watches your board through the camera and talks you through the build. Prop your
          phone where it can see the breadboard, then start.
        </Text>

        <View style={s.slot}>
          <BuildSlot
            build={build}
            loading={buildsLoading}
            unreachable={libraryUnreachable}
            // Tapping the slot while the library is unreachable tries again in
            // front of the learner, so the picker opens onto a fresh attempt
            // rather than onto the same emptiness.
            onOpen={() => { setPickerOpen(true); if (libraryUnreachable) void loadBuilds(); }}
          />
        </View>

        {!live.micSupported ? (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>Talking back needs the app</Text>
            <Text style={s.noticeBody}>
              In a browser the tutor still watches your bench and answers out loud. To talk to it,
              open Ohmlet on your phone.
            </Text>
          </View>
        ) : live.micPermission === 'denied' ? (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>{"Ohmlet can't hear you"}</Text>
            <Text style={s.noticeBody}>
              Microphone access is turned off, so the session starts camera and text. Turn it on for
              Ohmlet and the tutor can listen while you build.
            </Text>
            <Pressable
              onPress={() => { void Linking.openSettings(); }}
              style={({ pressed }) => [s.noticeAction, pressed && s.overlayPressed]}
              accessibilityRole="button"
              accessibilityLabel="Open settings to allow the microphone"
            >
              <Text style={s.noticeActionText}>Open settings</Text>
            </Pressable>
          </View>
        ) : childSafe ? (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>Tap the mic when you want to talk</Text>
            <Text style={s.noticeBody}>
              Ohmlet only listens when you press the microphone button, and it stops as soon as you
              press it again.
            </Text>
          </View>
        ) : null}

        {!planLoading && (
          <Text style={s.budget}>
            {unlimited
              ? 'Unlimited live time on your plan.'
              : `${minutesRemaining ?? 0} minutes of live time left this month on ${plan === 'free' ? 'the Free plan' : `the ${plan} plan`}.`}
          </Text>
        )}

        {!!live.error && <Text style={s.error}>{live.error}</Text>}

        <Button
          label="Start the session"
          onPress={start}
          disabled={mustPickBuild}
          style={{ marginTop: space.lg }}
        />
        {mustPickBuild && (
          <Text style={s.startHint}>
            Pick a build first, so the tutor knows what you are making and what to look for.
          </Text>
        )}

        {/* Mounted here as well as in the live view: "Start the session" lives in
            this pre-flight return, which exits before the live render, so a modal
            mounted only there would never appear. The same is true of the picker,
            which a learner reaches from both. */}
        <SafetyAck
          visible={safetyOpen}
          onAccept={onAcceptSafety}
          onCancel={() => { pendingStart.current = false; setSafetyOpen(false); }}
        />
        <BuildPicker
          visible={pickerOpen}
          builds={catalogue}
          loading={buildsLoading}
          selectedId={build?.id ?? null}
          ctaLabel="Use this build"
          onChoose={chooseBuild}
          onRetry={() => { void loadBuilds(); }}
          onClose={() => setPickerOpen(false)}
        />
      </ScrollView>
    );
  }

  // ── Live ──
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.stage}>
        {live.camOn ? (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
            {/* A scrim, not decoration: controls sit over a live camera feed
                whose brightness is whatever the learner's bench happens to be,
                so without it white text is legible over a dark board and
                invisible over a lit one. This is the one gradient in the app
                that is doing real work. */}
            <LinearGradient
              colors={['rgba(20,24,31,0.55)', 'transparent', 'rgba(20,24,31,0.75)'] as const}
              locations={[0, 0.35, 1] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </>
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

        {connecting && !live.reconnecting && (
          <View style={s.connecting}>
            <ActivityIndicator color={colors.gold} />
            <Text style={s.connectingText}>Waking the tutor…</Text>
          </View>
        )}

        {/* A dropped socket recovers in place, so it gets a quiet banner rather
            than a full-screen takeover: the camera and the transcript stay put. */}
        {live.reconnecting && (
          <View style={s.reconnect} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={s.reconnectText}>Reconnecting…</Text>
          </View>
        )}

        {/* Everything that sits over the bottom of the feed, in reading order:
            what we are building, what to do about the parts, then what has been
            said. The transcript used to be positioned absolutely on its own,
            which left nowhere for the parts controls to go except on top of it. */}
        <View style={s.bottomStack} pointerEvents="box-none">
          {!!build && (
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [s.buildBar, pressed && s.overlayPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Building the ${build.title}. Change build`}
            >
              <View style={[s.buildDot, { backgroundColor: build.color }]} />
              <Text style={s.buildBarText} numberOfLines={1}>{build.title}</Text>
              <Text style={s.buildBarChange}>CHANGE</Text>
            </Pressable>
          )}

          {showKitActions && (
            <View style={s.kitRow}>
              {!!build && (
                <Pressable
                  onPress={runKitCheck}
                  style={({ pressed }) => [s.kitPrimary, pressed && s.overlayPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Check your parts against the ${build.title}`}
                >
                  <Text style={s.kitPrimaryText}>Check my kit</Text>
                </Pressable>
              )}
              <Pressable
                onPress={runIdentify}
                style={({ pressed }) => [s.kitGhost, pressed && s.overlayPressed]}
                accessibilityRole="button"
                accessibilityLabel="Identify the part you are holding up"
              >
                <Text style={s.kitGhostText}>What's this part?</Text>
              </Pressable>
            </View>
          )}

          <ScrollView
            ref={transcriptRef}
            style={s.transcript}
            contentContainerStyle={s.transcriptInner}
            onContentSizeChange={() => transcriptRef.current?.scrollToEnd({ animated: true })}
            accessibilityLabel="Session transcript"
          >
            {live.transcripts.length === 0 ? (
              <Text style={s.transcriptEmpty}>
                {!connected
                  ? 'Getting the tutor listening.'
                  : live.micOn
                    ? 'Talk to the tutor while you build, or type below. Everything said shows up here.'
                    : 'Point the camera at your board, or ask a question below. What the tutor says shows up here.'}
              </Text>
            ) : (
              live.transcripts
                .slice(-VISIBLE_LINES)
                .map((t) => <TranscriptLine key={t.id} entry={t} />)
            )}
          </ScrollView>
        </View>
      </View>

      <View style={s.controls}>
        <View style={s.askRow}>
          {live.micSupported && (
            <MicControl
              listening={live.micOn}
              armed={live.micIntent}
              permission={live.micPermission}
              onPress={() => {
                if (live.micPermission === 'denied') { void Linking.openSettings(); return; }
                void live.toggleMic();
              }}
            />
          )}
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

      <BuildPicker
        visible={pickerOpen}
        builds={catalogue}
        loading={buildsLoading}
        selectedId={build?.id ?? null}
        ctaLabel="Switch to this build"
        onChoose={chooseBuild}
        onRetry={() => { void loadBuilds(); }}
        onClose={() => setPickerOpen(false)}
      />

      <KitCheckSheet
        visible={kitOpen}
        phase={kit.phase}
        intent={kit.intent ?? 'inventory'}
        inventory={kit.inventory}
        component={kit.component}
        error={kit.error}
        retryable={kit.retryable}
        buildTitle={build?.title}
        toldTutor={toldTutor}
        onRetry={retryKit}
        onClose={closeKit}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.ink },
  // The pre-flight scrolls now that it carries the build: on a small phone the
  // card, the parts line and the plan notice together run past the fold, and a
  // start button below the fold with no way to reach it is the worst outcome.
  preflight: { flex: 1, backgroundColor: colors.cream },
  preflightInner: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  slot: { marginTop: space.lg },
  startHint: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    marginTop: space.sm, textAlign: 'center',
  },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  body: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, marginTop: space.md, lineHeight: 22 },
  notice: {
    marginTop: space.lg, backgroundColor: colors.blueSoft, borderWidth: 2,
    borderColor: colors.blueDeep, borderRadius: radius.md, ...curve, padding: space.md,
  },
  noticeTitle: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  noticeBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4, lineHeight: 20 },
  noticeAction: {
    alignSelf: 'flex-start', marginTop: space.sm,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.blueDeep,
    borderRadius: radius.sm, ...curve,
  },
  noticeActionText: { fontFamily: font.black, fontSize: type.small, color: colors.blueDeep },
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
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, ...curve,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.ink },
  chipText: { fontFamily: font.black, fontSize: type.meta, color: colors.white, letterSpacing: 0.5 },
  chipTextActive: { color: colors.ink },
  connecting: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  connectingText: { fontFamily: font.bold, fontSize: type.small, color: colors.white },
  reconnect: {
    position: 'absolute', top: space.xxl * 1.2 + 46, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, ...curve,
    backgroundColor: 'rgba(20,24,31,0.78)',
  },
  reconnectText: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 0.6, color: colors.white },
  bottomStack: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  overlayPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },

  // Session context, not a control panel: it names the build and gets out of the
  // way. Dark glass so it reads over whatever the bench happens to look like.
  buildBar: {
    alignSelf: 'flex-start', maxWidth: '86%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginLeft: space.md, marginBottom: space.sm,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, ...curve,
    backgroundColor: 'rgba(20,24,31,0.74)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
  },
  buildDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.ink },
  buildBarText: {
    flexShrink: 1, fontFamily: font.black, fontSize: type.meta, color: colors.white, letterSpacing: 0.3,
  },
  buildBarChange: { fontFamily: font.black, fontSize: 9, letterSpacing: 1, color: colors.gold },

  kitRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, marginBottom: space.sm },
  kitPrimary: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.ink,
    borderRadius: radius.md, ...curve,
  },
  kitPrimaryText: { fontFamily: font.black, fontSize: type.small, color: colors.goldText },
  kitGhost: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: 'rgba(20,24,31,0.66)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: radius.md, ...curve,
  },
  kitGhostText: { fontFamily: font.black, fontSize: type.small, color: colors.white },

  transcript: { maxHeight: 190, backgroundColor: 'rgba(20,24,31,0.55)' },
  transcriptInner: { padding: space.md, gap: 8 },
  transcriptEmpty: {
    fontFamily: font.semibold, fontSize: type.small, lineHeight: 20,
    color: 'rgba(255,255,255,0.62)',
  },
  agentRow: { flexDirection: 'row', gap: 9 },
  agentRule: { width: 3, borderRadius: 2, backgroundColor: colors.gold },
  lineAgent: {
    flex: 1, fontFamily: font.bold, fontSize: type.small, lineHeight: 20, color: colors.white,
  },
  lineUser: {
    alignSelf: 'flex-end', maxWidth: '86%', textAlign: 'right',
    fontFamily: font.bold, fontSize: type.small, lineHeight: 20, color: colors.goldText,
    backgroundColor: colors.gold, borderRadius: radius.sm, ...curve,
    paddingHorizontal: 11, paddingVertical: 6, overflow: 'hidden',
  },
  lineSystem: {
    alignSelf: 'center', textAlign: 'center',
    fontFamily: font.black, fontSize: type.meta, letterSpacing: 0.6, lineHeight: 16,
    color: 'rgba(255,255,255,0.66)',
  },

  controls: { backgroundColor: colors.cream, padding: space.md, paddingBottom: space.xl, gap: space.sm },
  askRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },

  // The voice control. Circular against the rounded rectangles either side of
  // it, and the ring lives outside the button so the pulse can grow past the
  // border without the button itself moving.
  micWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  micRing: {
    position: 'absolute', width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.gold,
  },
  mic: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink,
  },
  micLive: { backgroundColor: colors.gold, borderColor: colors.goldPlate },
  // On, but the socket is not carrying it yet. Held back rather than pulsing,
  // so "the tutor can hear you" and "in a moment it can" do not look the same.
  micWaiting: { opacity: 0.55 },
  micDenied: { borderColor: colors.red },
  micPressed: { transform: [{ scale: 0.92 }] },
  input: {
    flex: 1, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: font.bold, fontSize: type.body, color: colors.ink,
  },
  send: {
    width: 46, height: 46, borderRadius: radius.md, ...curve, backgroundColor: colors.gold,
    borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
  sendText: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  buttonRow: { flexDirection: 'row', gap: space.sm },
  ctrl: {
    flex: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.md, ...curve,
    backgroundColor: colors.white, paddingVertical: 11, alignItems: 'center',
  },
  ctrlText: { fontFamily: font.black, fontSize: type.small, color: colors.ink },
  ctrlEnd: { backgroundColor: colors.red, borderColor: colors.ink },
  ctrlEndText: { color: colors.white },
});
