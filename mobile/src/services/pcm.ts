// The live agent streams raw 24kHz mono PCM. Browsers can feed that straight
// into an AudioContext; React Native has no Web Audio API, and expo-av will only
// play a recognised container. So each chunk gets a 44-byte WAV header bolted on
// and is handed over as a data URI.
//
// Written without Buffer or atob, neither of which exists in the RN runtime.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 -> bytes. Tolerates URL-safe alphabet and missing padding. */
export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0, buffer = 0, bits = 0;
  for (let i = 0; i < len; i += 1) {
    const v = B64.indexOf(clean[i]);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/** bytes -> base64. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 63];
  }
  return out;
}

/**
 * Wrap raw PCM in a minimal WAV container so a player will accept it.
 * Defaults match what the live agent emits: 24kHz, mono, 16-bit little-endian.
 */
export function pcmToWavBase64(pcm: Uint8Array, sampleRate = 24000, channels = 1, bits = 16): string {
  const blockAlign = (channels * bits) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = new Uint8Array(44);
  const dv = new DataView(header.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) header[offset + i] = text.charCodeAt(i);
  };

  ascii(0, 'RIFF');
  dv.setUint32(4, 36 + pcm.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  dv.setUint32(16, 16, true);        // PCM chunk size
  dv.setUint16(20, 1, true);         // format: PCM
  dv.setUint16(22, channels, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, byteRate, true);
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, bits, true);
  ascii(36, 'data');
  dv.setUint32(40, pcm.length, true);

  const wav = new Uint8Array(44 + pcm.length);
  wav.set(header, 0);
  wav.set(pcm, 44);
  return bytesToBase64(wav);
}
