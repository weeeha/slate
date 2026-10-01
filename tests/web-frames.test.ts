import { describe, it, expect, vi, afterEach } from 'vitest'
import { sampleTimes, isBlank, once } from '../src/renderer/src/web/frames'

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

describe('isBlank', () => {
  const px = (r: number, g: number, b: number, a: number, n = 64) => Uint8ClampedArray.from(Array.from({ length: n }, () => [r, g, b, a]).flat())
  it('treats solid black and fully transparent frames as blank', () => {
    expect(isBlank(px(0, 0, 0, 255))).toBe(true)
    expect(isBlank(px(0, 0, 0, 0))).toBe(true)
    expect(isBlank(new Uint8ClampedArray(0))).toBe(true)
  })
  it('accepts a frame with real content', () => {
    expect(isBlank(px(120, 130, 140, 255))).toBe(false)
  })
})

describe('once', () => {
  afterEach(() => vi.useRealTimers())
  it('resolves on the event and removes its listeners', async () => {
    const el = new EventTarget()
    const add = vi.spyOn(el, 'addEventListener')
    const remove = vi.spyOn(el, 'removeEventListener')
    const p = once(el, 'seeked', 1000)
    el.dispatchEvent(new Event('seeked'))
    await expect(p).resolves.toBeUndefined()
    expect(add).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledTimes(2)
  })
  it('rejects on error and leaves no listener that could resolve later', async () => {
    const el = new EventTarget()
    const p = once(el, 'seeked', 1000)
    el.dispatchEvent(new Event('error'))
    await expect(p).rejects.toThrow('could not be decoded')
  })
  it('rejects after the timeout when the event never fires', async () => {
    vi.useFakeTimers()
    const el = new EventTarget()
    const p = once(el, 'seeked', 15_000)
    const assertion = expect(p).rejects.toThrow('did not respond in time')
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })
})
