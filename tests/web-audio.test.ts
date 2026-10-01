import { describe, it, expect, vi, afterEach } from 'vitest'
import { downmixTo16k, decodeToPcm } from '../src/renderer/src/web/audio'

describe('downmixTo16k', () => {
  it('averages channels and resamples 48k to 16k', () => {
    const l = new Float32Array(48000).fill(0.5)
    const r = new Float32Array(48000).fill(-0.5)
    const pcm = downmixTo16k([l, r], 48000)
    expect(pcm.length).toBe(16000)
    expect(Math.abs(pcm[100])).toBeLessThanOrEqual(1)
  })
  it('scales mono to int16 and clamps', () => {
    const pcm = downmixTo16k([new Float32Array(16000).fill(2)], 16000)
    expect(pcm[0]).toBe(32767)
  })
  it('caps at 90 seconds', () => {
    const pcm = downmixTo16k([new Float32Array(16000 * 100)], 16000)
    expect(pcm.length).toBe(16000 * 90)
  })
})

describe('decodeToPcm', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('creates the AudioContext at 16 kHz so the browser resamples with a filter', async () => {
    const rates: unknown[] = []
    class FakeCtx {
      constructor(opts?: { sampleRate?: number }) { rates.push(opts?.sampleRate) }
      decodeAudioData = async () => ({ numberOfChannels: 1, sampleRate: 16000, duration: 1, getChannelData: () => new Float32Array(16000) })
      close = async () => undefined
    }
    vi.stubGlobal('window', { AudioContext: FakeCtx })
    const out = await decodeToPcm(new Blob([new Uint8Array(4)]))
    expect(rates).toEqual([16000])
    expect(out.pcm.length).toBe(16000)
  })
})
