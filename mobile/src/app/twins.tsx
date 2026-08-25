import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../services/nav';
import { Button } from '../components/Button';
import { TwinViewer } from '../components/TwinViewer';
import {
  fetchTwinModel, listTwins, shareLink, shareTwin, unshareTwin, type Twin,
} from '../services/twins';
import { colors, font, radius, space, type, curve } from '../theme/tokens';
import { elevation } from '../theme/elevation';

export default function Twins() {
  const [twins, setTwins] = useState<Twin[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<Twin | null>(null);
  const [model, setModel] = useState<ArrayBuffer | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    const res = await listTwins();
    if (res.ok) { setTwins(res.data); setProblem(null); }
    else { setTwins([]); setProblem(res.message); }
  }, []);

  useEffect(() => { void load(); }, [load]);

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

  if (twins === null) {
    return <View style={s.center}><ActivityIndicator color={colors.goldDeep} /></View>;
  }

  // ── Detail ──
  if (open) {
    return (
      <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
        <Pressable onPress={() => setOpen(null)} style={s.backLink}>
          <Text style={s.backText}>‹ All twins</Text>
        </Pressable>

        {loadingModel ? (
          <View style={[s.viewerPlaceholder]}><ActivityIndicator color={colors.gold} /></View>
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
          >
            <Text style={s.quietText}>Stop sharing</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  // ── List ──
  return (
    <ScrollView style={s.flex} contentContainerStyle={s.scroll}>
      <Pressable onPress={() => goBack('/home')} style={s.backLink}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>
      <Text style={s.eyebrow}>3D TWINS</Text>
      <Text style={s.title}>Everything you've built.</Text>
      <Text style={s.sub}>
        Finish a build in a live session and it becomes a model you can spin, keep and share.
      </Text>

      {problem ? (
        <View style={s.notice}>
          <Text style={s.noticeTitle}>Twins aren't available yet</Text>
          <Text style={s.noticeBody}>{problem}</Text>
        </View>
      ) : twins.length === 0 ? (
        <View style={s.notice}>
          <Text style={s.noticeTitle}>No twins yet</Text>
          <Text style={s.noticeBody}>
            Run a live session, finish the build, and capture it. The twin appears here.
          </Text>
        </View>
      ) : (
        twins.map((t) => (
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
        ))
      )}
    </ScrollView>
  );
}

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
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    borderWidth: 2.5, borderColor: colors.ink, borderRadius: radius.lg, ...curve,
    padding: space.md, marginBottom: space.sm, ...elevation.card,
  },
  cardTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  chevron: { fontFamily: font.black, fontSize: type.title, color: colors.inkSoft },
  notice: {
    backgroundColor: colors.blueSoft, borderWidth: 2, borderColor: colors.blueDeep,
    borderRadius: radius.md, ...curve, padding: space.lg,
  },
  noticeTitle: { fontFamily: font.black, fontSize: type.body, color: colors.ink },
  noticeBody: { fontFamily: font.semibold, fontSize: type.small, color: colors.inkSoft, marginTop: 4, lineHeight: 20 },
  quiet: { marginTop: space.md, alignItems: 'center', paddingVertical: space.sm },
  quietText: { fontFamily: font.bold, fontSize: type.small, color: colors.inkSoft },
});
