import { describe, it, expect } from 'vitest'
import * as shared from '../src/shared/audioFingerprint'
import * as main from '../src/main/audio'

const SR = 16000

function sine(hz: number, seconds: number): Int16Array {
  const pcm = new Int16Array(SR * seconds)
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(Math.sin((2 * Math.PI * hz * i) / SR) * 12000)
  return pcm
}

describe('shared audio fingerprint', () => {
  it('exports the DSP constants the desktop decoder uses', () => {
    expect(shared.SAMPLE_RATE).toBe(16000)
    expect(shared.FRAME).toBe(512)
    expect(shared.MAX_SECONDS).toBe(90)
  })

  it('is the same function the desktop module exports', () => {
    expect(main.computeFingerprint).toBe(shared.computeFingerprint)
  })

  it('fingerprints a steady tone', () => {
    const fp = shared.computeFingerprint(sine(220, 4), 4)
    expect(fp.durationSec).toBeCloseTo(4, 0)
    expect(fp.voicedRatio).toBeGreaterThan(0.5)
  })
})
