/**
 * PCM16 <-> base64 helpers for the xAI Voice Agent API.
 * The realtime API exchanges raw little-endian signed 16-bit PCM, base64 encoded.
 */

/** Convert a Float32 mic buffer ([-1, 1]) to a base64-encoded PCM16 string. */
export function float32ToBase64PCM16(input: Float32Array): string {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return arrayBufferToBase64(pcm16.buffer);
}

/** Convert a base64-encoded PCM16 string (from the API) to an Int16Array. */
export function base64PCM16ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // avoid call-stack limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
