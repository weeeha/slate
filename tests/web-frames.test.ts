import { describe, it, expect } from 'vitest'
import { sampleTimes } from '../src/renderer/src/web/frames'

describe('sampleTimes', () => {
  it('samples every 2 seconds from 0.5s, up to 16 frames', () => {
    expect(sampleTimes(7)).toEqual([0.5, 2.5, 4.5, 6.5])
    expect(sampleTimes(100)).toHaveLength(16)
  })
  it('always returns at least one frame for very short clips', () => {
    expect(sampleTimes(0.3)).toEqual([0.15])
  })
  it('respects an in/out range', () => {
    expect(sampleTimes(60, { inSec: 10, outSec: 15 })).toEqual([10.5, 12.5, 14.5])
  })
})
