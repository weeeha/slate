// Browser audio decode for analyzeAudio: Web Audio decode -> mono 16 kHz int16 PCM,
// the same input the desktop feeds computeFingerprint after ffmpeg.

import { SAMPLE_RATE, MAX_SECONDS } from '../../../shared/audioFingerprint'

export function downmixTo16k(channels: Float32Array[], fromRate: number): Int16Array {
  const ratio = fromRate / SAMPLE_RATE
  const srcLen = channels[0]?.length ?? 0
  const outLen = Math.min(Math.floor(srcLen / ratio), SAMPLE_RATE * MAX_SECONDS)
  const pcm = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const j = Math.floor(i * ratio)
    let sum = 0
    for (const ch of channels) sum += ch[j] ?? 0
    const v = Math.max(-1, Math.min(1, sum / channels.length))
    pcm[i] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767)
  }
  return pcm
}

export async function decodeToPcm(blob: Blob): Promise<{ pcm: Int16Array; fullDurationSec: number }> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  // A 16 kHz context makes the browser resample with a proper filter (no aliasing in the
  // brightness measure, a third of the memory of a native-rate decode, closer to ffmpeg).
  const ctx = new AC({ sampleRate: SAMPLE_RATE })
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c))
    return { pcm: downmixTo16k(channels, buf.sampleRate), fullDurationSec: buf.duration }
  } finally {
    void ctx.close()
  }
}
