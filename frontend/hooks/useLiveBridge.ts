/**
 * useLiveBridge — WebSocket hook for real-time audio + video streaming to Gemini.
 *
 * Manages: WebSocket lifecycle, mic capture (PCM 16kHz), camera capture (JPEG 1fps),
 * audio playback (PCM 24kHz), and transcript extraction from ADK events.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getIdToken } from '../services/firebase';

export type LiveTranscript = {
  role: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
};

type LiveBridgeState = 'disconnected' | 'connecting' | 'connected' | 'error';

type UseLiveBridgeOptions = {
  wsUrl: string;
  userId: string;
  sessionId: string;
  autoConnect?: boolean;
  /**
   * Snapshot cadence in ms for the background vision heartbeat. Vision is the
   * dominant cost driver, so we sample slowly (default 2500ms ≈ 0.4fps) and lean
   * on captureSnapshot() for the moments that matter. Set to 0 to disable the
   * heartbeat entirely (pure on-demand snapshots).
   */
  visionIntervalMs?: number;
  /** Session mode. 'interview' connects the Max-tier mock interviewer (#21). */
  mode?: 'tutor' | 'interview';
  /** Fires once, right after the auth frame is sent, with a JSON sender. Use it
   *  to prime the session (e.g. send the interview context) in the correct order. */
  onReady?: (sendJson: (obj: unknown) => void) => void;
};

export type CameraFacing = 'user' | 'environment';

type UseLiveBridgeReturn = {
  state: LiveBridgeState;
  micOn: boolean;
  camOn: boolean;
  facing: CameraFacing;
  transcripts: LiveTranscript[];
  connect: () => void;
  disconnect: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
  /** Toggle front/rear camera (rear is best for pointing at a bench on a phone). */
  switchCamera: () => void;
  /** Send a single frame to the tutor immediately ("look at my board now"). */
  captureSnapshot: () => void;
  /**
   * Grab one still from the live preview as a base64 JPEG (no data: prefix),
   * without streaming it to the tutor. Used by the inventory kit check, which
   * posts the frame to the vision-verifier service. Resolves null if the camera
   * is not ready.
   */
  grabFrame: (maxWidth?: number) => Promise<string | null>;
  sendText: (text: string, stage: string) => void;
  sendStageUpdate: (stage: string) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
};

// Downsample audio from source rate to 16kHz PCM 16-bit mono
function downsampleTo16kHz(buffer: Float32Array, sourceSampleRate: number): ArrayBuffer {
  const ratio = sourceSampleRate / 16000;
  const newLength = Math.floor(buffer.length / ratio);
  const result = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const sample = buffer[Math.floor(i * ratio)];
    result[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
  }
  return result.buffer;
}

export function useLiveBridge({
  wsUrl,
  userId,
  sessionId,
  autoConnect = false,
  visionIntervalMs = 2500,
  mode = 'tutor',
  onReady,
}: UseLiveBridgeOptions): UseLiveBridgeReturn {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [state, setState] = useState<LiveBridgeState>('disconnected');
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const facingRef = useRef<CameraFacing>('environment');
  const [transcripts, setTranscripts] = useState<LiveTranscript[]>([]);

  // Track whether we've received any audio data this session.
  // When true, we use outputTranscription for text display and skip content.parts text
  // to prevent duplicate messages (the model sends both).
  const hasReceivedAudioRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const camIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const pushTranscript = useCallback((role: LiveTranscript['role'], text: string) => {
    setTranscripts((prev) => [...prev, { role, text, timestamp: new Date().toISOString() }]);
  }, []);

  // ── Audio playback (PCM 24kHz from Gemini) ──

  const playAudioChunk = useCallback((base64Audio: string) => {
    try {
      // Normalise: URL-safe base64 → standard base64, strip whitespace, fix padding
      let b64 = base64Audio.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
      while (b64.length % 4 !== 0) b64 += '=';

      // base64 → raw bytes
      const binaryStr = atob(b64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

      // Ensure even byte count for Int16Array alignment
      const usableLen = len - (len % 2);
      const int16 = new Int16Array(bytes.buffer, 0, usableLen / 2);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

      if (!playbackCtxRef.current) {
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
        nextPlayTimeRef.current = 0;
        console.log('[ohmlet-live] created AudioContext, sampleRate:', playbackCtxRef.current.sampleRate, 'state:', playbackCtxRef.current.state);
      }
      const ctx = playbackCtxRef.current;
      if (ctx.state === 'suspended') {
        console.log('[ohmlet-live] resuming suspended AudioContext');
        ctx.resume();
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
    } catch (err) {
      console.error('[ohmlet-live] audio playback error:', err);
    }
  }, []);

  // ── Handle incoming ADK events ──

  const handleEvent = useCallback(
    (data: string) => {
      try {
        const event = JSON.parse(data);

        // ── Audio + text from content.parts ──
        const content = event?.content;
        if (content?.parts) {
          for (const part of content.parts) {
            // Play audio data
            const inlineData = part.inlineData || part.inline_data;
            if (inlineData?.data) {
              const mime = inlineData.mimeType || inlineData.mime_type || '';
              if (mime.includes('audio') || mime.includes('pcm')) {
                hasReceivedAudioRef.current = true;
                console.log('[ohmlet-live] audio chunk received, mime:', mime, 'size:', inlineData.data.length);
                playAudioChunk(inlineData.data);
              }
            }
            // For native-audio models, agent text arrives in outputTranscription.
            // content.parts text is a duplicate — always skip it for agent/model role.
            // Only show content.parts text for user role (text-only fallback models).
            if (part.text && content.role === 'user') {
              if (!part.text.startsWith('[stage')) {
                pushTranscript('user', part.text);
              }
            }
          }
        }

        // ── Output transcription (agent's spoken words as text) ──
        if (event?.outputTranscription?.text && event.partial === false) {
          pushTranscript('agent', event.outputTranscription.text);
        }

        // ── Input transcription (user's spoken words as text) ──
        if (event?.inputTranscription?.text && event.partial === false) {
          pushTranscript('user', event.inputTranscription.text);
        }

        // ── Turn complete ──
        if (event?.turnComplete) {
          console.log('[ohmlet-live] turn complete');
        }
      } catch (err) {
        console.warn('[ohmlet-live] Failed to parse event:', err, data.slice(0, 200));
      }
    },
    [pushTranscript, playAudioChunk]
  );

  // ── WebSocket connect/disconnect ──

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    intentionalCloseRef.current = false;
    setState('connecting');

    const url = `${wsUrl}/ws/${userId}/${sessionId}${mode === 'interview' ? '?mode=interview' : ''}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate FIRST: the backend verifies this token and derives the UID
      // from it (#44), so the connection cannot impersonate another user. Sent
      // before any audio/text frame; harmlessly ignored by the legacy backend.
      void getIdToken().then((token) => {
        if (token && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'auth', token }));
          // After auth, let the caller prime the session (e.g. interview context),
          // guaranteeing it arrives after the auth frame.
          onReadyRef.current?.((obj: unknown) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
          });
        }
      });
      setState('connected');
      reconnectAttemptRef.current = 0;
      pushTranscript('system', reconnectAttemptRef.current === 0
        ? 'Connected to Ohmlet Live Bridge.'
        : 'Reconnected to Ohmlet Live Bridge.');
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        handleEvent(event.data);
      }
    };

    ws.onclose = (event) => {
      wsRef.current = null;

      if (intentionalCloseRef.current) {
        setState('disconnected');
        return;
      }

      // Auto-reconnect with exponential backoff (max 10s, up to 5 attempts)
      const attempt = reconnectAttemptRef.current;
      if (attempt < 5) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        reconnectAttemptRef.current = attempt + 1;
        setState('connecting');
        pushTranscript('system', `Connection lost (code ${event.code}). Reconnecting in ${delay / 1000}s...`);
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setState('error');
        pushTranscript('system', 'Connection lost after multiple attempts. Click the session button to try again.');
      }
    };

    ws.onerror = () => {
      // onclose will fire after this — reconnect handled there
    };
  }, [wsUrl, userId, sessionId, pushTranscript, handleEvent]);

  const disconnect = useCallback(() => {
    // Mark as intentional so onclose doesn't auto-reconnect
    intentionalCloseRef.current = true;
    reconnectAttemptRef.current = 0;
    hasReceivedAudioRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Send close message
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'close' }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    setState('disconnected');

    // Stop mic
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicOn(false);

    // Stop cam
    if (camIntervalRef.current) clearInterval(camIntervalRef.current);
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setCamOn(false);

    // Stop playback
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
    nextPlayTimeRef.current = 0;
  }, []);

  // ── Mic toggle ──

  const toggleMic = useCallback(async () => {
    if (micOn) {
      // Stop mic
      processorRef.current?.disconnect();
      audioContextRef.current?.close();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      audioContextRef.current = null;
      processorRef.current = null;
      setMicOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: stream.getAudioTracks()[0].getSettings().sampleRate || 48000 });
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);

      // Use ScriptProcessorNode (widely supported) to get raw PCM
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = downsampleTo16kHz(input, ctx.sampleRate);
        wsRef.current.send(pcm);
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setMicOn(true);
    } catch (err) {
      pushTranscript('system', 'Microphone access denied or unavailable.');
    }
  }, [micOn, pushTranscript]);

  // ── Camera ──

  // Grab one frame from the live preview and ship it to the tutor. Used by both
  // the slow background heartbeat and the on-demand "look now" snapshot.
  const sendFrame = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth) return; // Not ready yet

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');

    // Scale down for Gemini — 512px wide is plenty and keeps tokens (cost) down.
    const scale = Math.min(1, 512 / video.videoWidth);
    const w = Math.floor(video.videoWidth * scale);
    const h = Math.floor(video.videoHeight * scale);
    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob || wsRef.current?.readyState !== WebSocket.OPEN) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          wsRef.current?.send(JSON.stringify({ type: 'image', data: base64, mimeType: 'image/jpeg' }));
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      0.6,
    );
  }, []);

  const startCameraStream = useCallback(async (mode: CameraFacing) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        // ideal (not exact) so a laptop with one webcam still resolves.
        facingMode: { ideal: mode },
      },
    });
    camStreamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
    return stream;
  }, []);

  const toggleCam = useCallback(async () => {
    if (camOn) {
      if (camIntervalRef.current) clearInterval(camIntervalRef.current);
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
      setCamOn(false);
      return;
    }

    try {
      await startCameraStream(facingRef.current);

      // Snapshot vision: a slow heartbeat keeps the tutor loosely aware while the
      // preview stays full framerate. visionIntervalMs = 0 disables the heartbeat.
      if (visionIntervalMs > 0) {
        camIntervalRef.current = setInterval(sendFrame, visionIntervalMs);
      }

      setCamOn(true);
    } catch {
      pushTranscript('system', 'Camera access denied or unavailable.');
    }
  }, [camOn, pushTranscript, startCameraStream, sendFrame, visionIntervalMs]);

  const switchCamera = useCallback(async () => {
    const next: CameraFacing = facingRef.current === 'environment' ? 'user' : 'environment';
    facingRef.current = next;
    setFacing(next);
    if (!camOn) return;
    // Swap the underlying track without tearing down the heartbeat.
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      await startCameraStream(next);
    } catch {
      pushTranscript('system', 'Could not switch camera.');
    }
  }, [camOn, startCameraStream, pushTranscript]);

  const captureSnapshot = useCallback(() => {
    sendFrame();
  }, [sendFrame]);

  // Grab a still for the inventory kit check (posted to the vision-verifier, not
  // streamed to the tutor). A slightly larger frame than the live heartbeat so
  // small parts read clearly. Resolves null if the camera isn't ready.
  const grabFrame = useCallback((maxWidth = 768): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) {
        resolve(null);
        return;
      }
      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const w = Math.floor(video.videoWidth * scale);
      const h = Math.floor(video.videoHeight * scale);
      const canvas = canvasRef.current;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.7,
      );
    });
  }, []);

  // ── Send text message ──

  const sendText = useCallback(
    (text: string, stage: string) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN || !text.trim()) return;
      wsRef.current.send(JSON.stringify({ type: 'text', text: text.trim(), stage }));
      pushTranscript('user', text.trim());
    },
    [pushTranscript]
  );

  // ── Send stage update ──

  const sendStageUpdate = useCallback((stage: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'stage', stage }));
  }, []);

  // ── Auto-connect ──

  useEffect(() => {
    if (autoConnect && sessionId) connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      disconnect();
    };
  }, [autoConnect, sessionId]);

  return {
    state,
    micOn,
    camOn,
    facing,
    transcripts,
    connect,
    disconnect,
    toggleMic,
    toggleCam,
    switchCamera,
    captureSnapshot,
    grabFrame,
    sendText,
    sendStageUpdate,
    videoRef,
  };
}
