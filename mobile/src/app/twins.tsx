import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { goBack } from '../services/nav';
import { Button } from '../components/Button';
import { TwinViewer } from '../components/TwinViewer';
import { useAuth } from '../hooks/useAuth';
import { bumpMetric, loadProgress, saveProgress } from '../services/progress';
import {
  fetchTwinModel, generateTwin, listTwins, probeTwins, shareLink, shareTwin,
  unavailableReason, unavailableTitle, unshareTwin,
  type Twin, type TwinAvailability,
} from '../services/twins';
import { colors, font, radius, space, type, curve } from '../theme/tokens';
import { elevation } from '../theme/elevation';

/** Where the capture flow has got to. `idle` covers "not capturing". */
type CapturePhase = 'idle' | 'shooting' | 'generating' | 'error' | 'quota';

/** A frame that has been taken but not yet sent. */
interface PendingShot {
  uri: string;
  base64: string;
}

export default function Twins() {
  const { user } = useAuth();
  const [twins, setTwins] = useState<Twin[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<Twin | null>(null);
  const [model, setModel] = useState<ArrayBuffer | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [sharing, setSharing] = useState(false);

  // `null` while the probe is in flight. The screen must not promise capture
  // before it knows the 3D service is there to capture into.
  const [availability, setAvailability] = useState<TwinAvailability | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, setPending] = useState<PendingShot | null>(null);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [captureError, setCaptureError] = useState('');
  const [rechecking, setRechecking] = useState(false);

  const load = useCallback(async () => {
    const res = await listTwins();
    if (res.ok) { setTwins(res.data); setProblem(null); }
    else { setTwins([]); setProblem(res.message); }
  }, []);

  // The probe answer is cached for the app run, so without a way to ask again a
  // learner whose connection dropped once is told the 3D service is down until
  // they kill the app. Offered only where the answer can change: a build with no
  // reporter URL will answer the same every time, and a button that cannot help
  // is worse than no button.
  const recheck = useCallback(async () => {
    setRechecking(true);
    const state = await probeTwins(true);
    setAvailability(state);
    if (state === 'ready') await load();
    setRechecking(false);
  }, [load]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const state = await probeTwins();
      if (alive) setAvailability(state);
    })();
    void load();
    return () => { alive = false; };
  }, [load]);

  // Load the mesh only when a twin is opened: they are multi-megabyte, and
  // fetching all of them to render a list would be wasteful and slow.
  useEffect(() => {
    if (!open) { setModel(null); return; }
    let alive = true;
    setLoadingModel(true);
    void fetchTwinModel(open.id)
      .then((buf) => alive && setModel(buf))
      .finally(() => alive && setLoadingModel(false));
    return () => { alive = false; };
  }, [open]);

  const doShare = async (twin: Twin) => {
    setSharing(true);
    const id = twin.shared && twin.shareId ? twin.shareId : await shareTwin(twin.id);
    setSharing(false);
    if (!id) return;
    const url = shareLink(id);
    try {
      await Share.share({ message: `I built this on Ohmlet: ${url}`, url });
    } catch { /* the user dismissed the sheet */ }
    await load();
  };

  // ── Capture ──

  const beginCapture = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setCaptureError(
          'Ohmlet needs the camera to photograph your build. You can turn it on in Settings.',
        );
        setPhase('error');
        return;
      }
    }
    setCaptureError('');
    setPhase('idle');
    setTitle('');
    setCameraOpen(true);
  }, [permission, requestPermission]);

  const shoot = useCallback(async () => {
    setPhase('shooting');
    try {
      // quality 0.6 keeps a bench photo well inside the reporter's 8 MB cap
      // while holding enough detail for the mesh to pick up component shapes.
      const shot = await cameraRef.current?.takePictureAsync({
        base64: true, quality: 0.6, skipProcessing: true, shutterSound: false,
      });
      if (!shot?.base64) throw new Error('no frame');
      setPending({ uri: shot.uri, base64: shot.base64 });
      setCameraOpen(false);
      setPhase('idle');
    } catch {
      setCameraOpen(false);
      setCaptureError('That photo did not come through. Try once more.');
      setPhase('error');
    }
  }, []);

  const confirmShot = useCallback(async () => {
    if (!pending) return;
    setPhase('generating');
    const res = await generateTwin(pending.base64, { title: title.trim() || undefined });

    if (!res.ok) {
      setCaptureError(res.message);
      setPhase(res.reason === 'quota' ? 'quota' : 'error');
      return;
    }

    setPending(null);
    setTitle('');
    setPhase('idle');

    // The twin exists, so the achievement counter moves. Credited here, on a
    // twin the service confirmed, rather than on the button: a failed or
    // quota-blocked attempt is not a twin.
    if (user?.uid) {
      const progress = await loadProgress(user.uid);
      await saveProgress(user.uid, bumpMetric(progress, 'twins'));
    }

    await load();
    if (res.data.status === 'ready') setOpen(res.data);
  }, [pending, title, user?.uid, load]);

  const dismissCapture = useCallback(() => {
    setPending(null);
    setTitle('');
    setCaptureError('');
    setPhase('idle');
  }, []);

  const canCapture = availability === 'ready';

  if (twins === null || availability === null) {
    return <View style={s.center}><ActivityIndicator color={colors.goldDeep} /></View>;
  }

  // ── Detail ──
  if (open) {
    return (
      <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
        <Pressable onPress={() => setOpen(null)} style={s.backLink} accessibilityRole="button">
          <Text style={s.backText}>‹ All twins</Text>
        </Pressable>

        {loadingModel ? (
          <View style={s.viewerPlaceholder}><ActivityIndicator color={colors.gold} /></View>
        ) : (
          <TwinViewer model={model} height={340} />
        )}

        <Text style={s.detailTitle}>{open.title}</Text>
        <Text style={s.meta}>
          {open.createdAt ? new Date(open.createdAt).toLocaleDateString() : 'Recently'}
          {open.sizeBytes ? ` · ${(open.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ''}
        </Text>

        {!model && !loadingModel && (
          <Text style={s.warn}>
            The model file could not be loaded. It may still be generating, or the 3D service may be
            unavailable.
          </Text>
        )}

        <Button
          label={sharing ? 'One moment…' : open.shared ? 'Share link again' : 'Share this build'}
          onPress={() => void doShare(open)}
          disabled={sharing}
          style={{ marginTop: space.lg }}
        />
        {open.shared && open.shareId && (
          <Pressable
            onPress={async () => { await unshareTwin(open.id); await load(); setOpen(null); }}
            style={s.quiet}
            accessibilityRole="button"
          >
            <Text style={s.quietText}>Stop sharing</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  // ── List ──
  return (
    <View style={s.flex}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Pressable onPress={() => goBack('/home')} style={s.backLink} accessibilityRole="button">
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>
        <Text style={s.eyebrow}>3D TWINS</Text>
        <Text style={s.title}>Everything you've built.</Text>
        <Text style={s.sub}>
          {canCapture
            ? 'Photograph a finished build and it becomes a model you can spin, keep and share.'
            : 'Finished builds become models you can spin, keep and share.'}
        </Text>

        {/* Availability comes first: a learner should not read an instruction
            and then discover it was never going to work. */}
        {!canCapture ? (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>{unavailableTitle(availability)}</Text>
            <Text style={s.noticeBody}>{unavailableReason(availability)}</Text>
            {availability !== 'unconfigured' && (
              <Pressable
                onPress={() => void recheck()}
                disabled={rechecking}
                style={s.quiet}
                accessibilityRole="button"
                accessibilityLabel="Check again whether the 3D service is answering"
              >
                <Text style={s.linkText}>{rechecking ? 'Checking…' : 'Try again'}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            onPress={() => void beginCapture()}
            style={({ pressed }) => [s.capture, pressed && s.capturePressed]}
            accessibilityRole="button"
            accessibilityLabel="Capture a build and turn it into a 3D twin"
          >
            <View style={s.captureIcon}><ScanIcon /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.captureTitle}>Capture a build</Text>
              <Text style={s.captureSub}>Point the camera at your finished circuit.</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        )}

        {/* A failure from the last attempt belongs next to the button that
            started it, not inside a sheet the learner has already dismissed. */}
        {(phase === 'error' || phase === 'quota') && !pending && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{captureError}</Text>
            {phase === 'quota' ? (
              <Pressable onPress={() => router.push('/plans')} style={s.quiet} accessibilityRole="button">
                <Text style={s.linkText}>See plans</Text>
              </Pressable>
            ) : (
              <Pressable onPress={dismissCapture} style={s.quiet} accessibilityRole="button">
                <Text style={s.linkText}>Dismiss</Text>
              </Pressable>
            )}
          </View>
        )}

        {problem && canCapture && (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>Couldn't load your twins</Text>
            <Text style={s.noticeBody}>{problem}</Text>
          </View>
        )}

        {twins.length === 0 && !problem && (
          <View style={s.notice}>
            <Text style={s.noticeTitle}>No twins yet</Text>
            <Text style={s.noticeBody}>
              {canCapture
                ? 'Finish a build, photograph it, and the model appears here.'
                : 'When this is switched on, your finished builds will appear here as 3D models.'}
            </Text>
          </View>
        )}

        {twins.map((t) => (
          <Pressable
            key={t.id}
            style={s.card}
            onPress={() => t.status === 'ready' && setOpen(t)}
            disabled={t.status !== 'ready'}
            accessibilityRole="button"
            accessibilityLabel={`${t.title}, ${t.status}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t.title}</Text>
              <Text style={s.meta}>
                {t.status === 'ready'
                  ? t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Ready'
                  : t.status === 'processing' ? 'Still generating…' : 'Generation failed'}
                {t.shared ? ' · shared' : ''}
              </Text>
            </View>
            {t.status === 'ready' && <Text style={s.chevron}>›</Text>}
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Viewfinder ── */}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={s.cameraRoot}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          <View style={s.cameraHint} pointerEvents="none">
            <Text style={s.cameraHintText}>
              Get the whole board in frame, lit from the front.
            </Text>
          </View>
          <View style={s.cameraBar}>
            <Pressable
              onPress={() => { setCameraOpen(false); setPhase('idle'); }}
              style={s.cameraCancel}
              accessibilityRole="button"
            >
              <Text style={s.cameraCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void shoot()}
              disabled={phase === 'shooting'}
              style={({ pressed }) => [s.shutter, pressed && s.shutterPressed]}
              accessibilityRole="button"
              accessibilityLabel="Take the photo"
            >
              {phase === 'shooting'
                ? <ActivityIndicator color={colors.ink} />
                : <View style={s.shutterCore} />}
            </Pressable>
            {/* Balances the cancel button so the shutter sits centred. */}
            <View style={s.cameraCancel} />
          </View>
        </View>
      </Modal>

      {/* ── Review and name ── */}
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        onRequestClose={() => phase !== 'generating' && dismissCapture()}
      >
        <KeyboardAvoidingView
          style={s.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.sheet}>
            {pending && (
              <Image source={{ uri: pending.uri }} style={s.preview} contentFit="cover" transition={160} />
            )}

            {phase === 'generating' ? (
              <View style={s.generating}>
                <ActivityIndicator color={colors.goldDeep} />
                <Text style={s.generatingTitle}>Sculpting your 3D twin</Text>
                <Text style={s.generatingBody}>
                  Turning your build into a model you can spin. This takes a few moments.
                </Text>
              </View>
            ) : (
              <View style={s.sheetBody}>
                <Text style={s.sheetTitle}>Name this build</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Light-activated alarm"
                  placeholderTextColor={colors.inkMute}
                  style={s.input}
                  maxLength={120}
                  returnKeyType="done"
                  accessibilityLabel="What did you build?"
                />

                {phase === 'error' && <Text style={s.errorText}>{captureError}</Text>}
                {phase === 'quota' && (
                  <>
                    <Text style={s.errorText}>{captureError}</Text>
                    <Pressable onPress={() => router.push('/plans')} style={s.quiet} accessibilityRole="button">
                      <Text style={s.linkText}>See plans</Text>
                    </Pressable>
                  </>
                )}

                <Button
                  label={phase === 'error' ? 'Try again' : 'Make the 3D twin'}
                  onPress={() => void confirmShot()}
                  style={{ marginTop: space.md }}
                />
                <Pressable
                  onPress={() => { dismissCapture(); void beginCapture(); }}
                  style={s.quiet}
                  accessibilityRole="button"
                >
                  <Text style={s.quietText}>Retake the photo</Text>
                </Pressable>
                <Pressable onPress={dismissCapture} style={s.quiet} accessibilityRole="button">
                  <Text style={s.quietText}>Not now</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/** A lens over a board: the capture affordance, drawn rather than borrowed. */
const ScanIcon: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path
      d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16"
      stroke={colors.ink}
      strokeWidth={2.2}
      strokeLinecap="round"
      fill="none"
    />
    <Circle cx={12} cy={12} r={3.4} stroke={colors.ink} strokeWidth={2.2} fill="none" />
  </Svg>
);

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  scroll: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  backLink: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  backText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
  eyebrow: { fontFamily: font.black, fontSize: type.meta, letterSpacing: 3, color: colors.inkSoft, marginTop: space.md },
  title: { fontFamily: font.black, fontSize: type.display, color: colors.ink, letterSpacing: -0.8, marginTop: 4 },
  sub: { fontFamily: font.bold, fontSize: type.body, color: colors.inkSoft, marginTop: space.sm, marginBottom: space.lg, lineHeight: 22 },
  viewerPlaceholder: {
    height: 340, backgroundColor: colors.ink, borderRadius: 18, ...curve,
    alignItems: 'center', justifyContent: 'center',
  },
  detailTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: space.md },
  meta: { fontFamily: font.semibold, fontSize: type.meta, color: colors.inkSoft, marginTop: 2 },
  warn: { fontFamily: font.semibold, fontSize: type.small, color: colors.red, marginTop: space.sm, lineHeight: 20 },

  // The capture row is the one gold thing on the screen, and structurally
  // unlike the twin cards below it: an action, not a record.
  capture: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.gold, borderWidth: 3, borderColor: colors.ink,
    borderRadius: radius.lg, ...curve, padding: space.md, marginBottom: space.lg,
    ...elevation.lifted,
  },
  capturePressed: { transform: [{ translateY: 2 }] },
  captureIcon: {
    width: 42, height: 42, borderRadius: radius.sm, ...curve,
    backgroundColor: colors.goldSoft, borderWidth: 2, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  captureTitle: { fontFamily: font.black, fontSize: type.bodyLg, color: colors.goldText },
  captureSub: { fontFamily: font.semibold, fontSize: type.small, color: colors.goldText, marginTop: 1 },

  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, ...curve,
    padding: space.md, marginBottom: space.sm, ...elevation.card,
  },
  cardTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  chevron: { fontFamily: font.black, fontSize: type.title, color: colors.inkSoft },
  notice: {
    backgroundColor: colors.blueSoft, borderWidth: 2, borderColor: colors.blueDeep,
    borderRadius: radius.md, ...curve, padding: space.lg, marginBottom: space.md,
  },
  noticeTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  noticeBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4, lineHeight: 20 },
  errorBox: {
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.red,
    borderRadius: radius.md, ...curve, padding: space.md, marginBottom: space.md,
  },
  errorText: { fontFamily: font.bold, fontSize: type.small, color: colors.red, lineHeight: 20, marginTop: space.sm },
  linkText: { fontFamily: font.black, fontSize: type.small, color: colors.ink, textDecorationLine: 'underline' },
  quiet: { marginTop: space.md, alignItems: 'center', paddingVertical: space.sm },
  quietText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },

  // ── Viewfinder ──
  cameraRoot: { flex: 1, backgroundColor: colors.ink },
  cameraHint: { position: 'absolute', top: space.xxl, left: space.lg, right: space.lg, alignItems: 'center' },
  cameraHintText: {
    fontFamily: font.bold, fontSize: type.small, color: colors.white, textAlign: 'center',
    backgroundColor: 'rgba(20,24,31,0.55)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, ...curve, overflow: 'hidden',
  },
  cameraBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl,
    backgroundColor: 'rgba(20,24,31,0.55)',
  },
  cameraCancel: { width: 72, paddingVertical: space.sm },
  cameraCancelText: { fontFamily: font.bold, fontSize: type.body, color: colors.white },
  shutter: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: colors.gold,
    borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  shutterCore: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.goldDeep },

  // ── Review sheet ──
  sheetBackdrop: {
    flex: 1, backgroundColor: 'rgba(20,24,31,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: space.lg,
  },
  sheet: {
    width: '100%', maxWidth: 420, backgroundColor: colors.white,
    borderWidth: 3, borderColor: colors.ink, borderRadius: radius.xl, ...curve,
    overflow: 'hidden', ...elevation.overlay,
  },
  preview: { width: '100%', height: 200, backgroundColor: colors.ink },
  sheetBody: { padding: space.lg },
  sheetTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink },
  input: {
    marginTop: space.sm, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md, ...curve,
    backgroundColor: colors.cream, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: font.bold, fontSize: type.body, color: colors.ink,
  },
  generating: { padding: space.xl, alignItems: 'center', gap: space.sm },
  generatingTitle: { fontFamily: font.black, fontSize: type.heading, color: colors.ink, marginTop: space.sm },
  generatingBody: {
    fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft,
    textAlign: 'center', lineHeight: 20,
  },
});
