import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { getIdToken } from '../services/firebase';
import { pcmToWavBase64, base64ToBytes } from '../services/pcm';

/**
 * The live tutor socket, mobile side. Same protocol as the web client, so it
 * talks to the deployed live-bridge unchanged:
 *
 *   -> {type:'auth', token}          first frame, always
 *   -> {type:'text', text, stage}
 *   -> {type:'image', data, mimeType}
 *   -> {type:'stage', stage}
 *   -> {type:'close'}
 *   <- ADK events with content.parts[] carrying text and inlineData audio
 *
 * MICROPHONE: not streamed yet. Real-time PCM capture needs a native module,
 * which Expo Go cannot load, so the session is camera-and-text until a
 * development build exists. The socket, the audio playback path and the frame
 * loop are all real — only capture is missing, and `micSupported` states that
 * plainly rather than showing a dead button.
 */

export type LiveState = 'idle' | 'connecting' | 'connected' | 'error';
export interface Transcript { id: string; role: 'agent' | 'user' | 'system'; text: string }
export type Stage = 'inventory' | 'wiring' | 'code' | 'test';

interface Options {
  wsUrl: string;
  userId: string;
  sessionId: string;
  /** Milliseconds between background frames. 0 disables the heartbeat. */
  visionIntervalMs?: number;
}

export const micSupported = false;   // see the note above

export function useLiveBridge({ wsUrl, userId, sessionId, visionIntervalMs = 2500 }: Options) {
  const [state, setState] = useState<LiveState>('idle');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [camOn, setCamOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const frameTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set by the screen: returns one base64 JPEG of the current preview.
  const grabFrameRef = useRef<null | (() => Promise<string | null>)>(null);
  const closedByUs = useRef(false);

  const push = useCallback((role: Transcript['role'], text: string) => {
    if (!text.trim()) return;
    setTranscripts((t) => [...t, { id: `${Date.now()}-${t.length}`, role, text }]);
  }, []);

  const registerFrameGrabber = useCallback((fn: null | (() => Promise<string | null>)) => {
    grabFrameRef.current = fn;
  }, []);

  // ── Agent audio ──
  const playAudio = useCallback(async (b64: string) => {
    try {
      const wav = pcmToWavBase64(base64ToBytes(b64));
      // Replace rather than layer: chunks arrive faster than they play, and
      // overlapping them turns speech into noise.
      await soundRef.current?.unloadAsync().catch(() => {});
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${wav}` },
        { shouldPlay: true },
      );
      soundRef.current = sound;
    } catch {
      /* a dropped chunk is better than a crashed session */
    }
  }, []);

  const handleEvent = useCallback((raw: string) => {
    let event: Record<string, unknown>;
    try { event = JSON.parse(raw); } catch { return; }

    // Terminal errors the server sends before closing (consent, budget, auth).
    if (event.type === 'error') {
      const code = String(event.code ?? '');
      const message = String(event.message ?? 'The session could not start.');
      closedByUs.current = true;            // do not auto-reconnect past a refusal
      setError(message);
      setState('error');
      push('system', message);
      if (code) console.warn('[ohmlet-live] refused:', code);
      return;
    }

    const content = event.content as { parts?: Array<Record<string, unknown>> } | undefined;
    if (!content?.parts) return;
    for (const part of content.parts) {
      const inline = (part.inlineData ?? part.inline_data) as { data?: string; mimeType?: string; mime_type?: string } | undefined;
      if (inline?.data) {
        const mime = inline.mimeType ?? inline.mime_type ?? '';
        if (mime.includes('audio') || mime.includes('pcm')) void playAudio(inline.data);
      }
      if (typeof part.text === 'string' && part.text.trim()) push('agent', part.text);
    }
  }, [playAudio, push]);

  // ── Connection ──
  const connect = useCallback(async () => {
    if (wsRef.current) return;
    setState('connecting');
    setError(null);
    closedByUs.current = false;

    const token = await getIdToken();
    if (!token) {
      setError('Please sign in again to start a live session.');
      setState('error');
      return;
    }

    const ws = new WebSocket(`${wsUrl}/ws/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));   // must be the first frame
      setState('connected');
    };
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') handleEvent(e.data);
    };
    ws.onerror = () => {
      setError('Lost the connection to the tutor.');
      setState('error');
    };
    ws.onclose = () => {
      // Only clear the ref if this socket is still the current one, so a stale
      // close cannot orphan a newer connection.
      if (wsRef.current === ws) wsRef.current = null;
      setState((prev) => (prev === 'error' ? prev : 'idle'));
    };
  }, [wsUrl, userId, sessionId, handleEvent]);

  const disconnect = useCallback(() => {
    closedByUs.current = true;
    if (frameTimer.current) { clearInterval(frameTimer.current); frameTimer.current = null; }
    try { wsRef.current?.send(JSON.stringify({ type: 'close' })); } catch { /* already gone */ }
    wsRef.current?.close();
    wsRef.current = null;
    void soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    setCamOn(false);
    setState('idle');
  }, []);

  const sendText = useCallback((text: string, stage: Stage = 'inventory') => {
    const trimmed = text.trim();
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', text: trimmed, stage }));
    push('user', trimmed);
  }, [push]);

  const sendStage = useCallback((stage: Stage) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'stage', stage }));
  }, []);

  const sendFrame = useCallback(async () => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const b64 = await grabFrameRef.current?.();
    if (!b64) return;
    wsRef.current.send(JSON.stringify({ type: 'image', data: b64, mimeType: 'image/jpeg' }));
  }, []);

  // Background frame heartbeat while the camera is on.
  useEffect(() => {
    if (!camOn || state !== 'connected' || visionIntervalMs <= 0) return;
    frameTimer.current = setInterval(() => void sendFrame(), visionIntervalMs);
    return () => {
      if (frameTimer.current) { clearInterval(frameTimer.current); frameTimer.current = null; }
    };
  }, [camOn, state, visionIntervalMs, sendFrame]);

  // Tear everything down on unmount: an orphaned socket keeps a paid session
  // open, and an orphaned sound keeps the audio session claimed.
  useEffect(() => () => {
    if (frameTimer.current) clearInterval(frameTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    void soundRef.current?.unloadAsync().catch(() => {});
  }, []);

  return {
    state, transcripts, error, camOn, setCamOn,
    connect, disconnect, sendText, sendStage, sendFrame,
    registerFrameGrabber, micSupported,
  };
}
