// Browser frame sampling: even samples (desktop's few-cuts fallback), JPEG at 768px wide.

type Range = { inSec?: number | null; outSec?: number | null; everySec?: number; max?: number }

export function sampleTimes(durationSec: number, opts: Range = {}): number[] {
  const every = opts.everySec ?? 2
  const max = opts.max ?? 16
  const start = Math.max(0, opts.inSec ?? 0)
  const end = Math.min(durationSec, opts.outSec ?? durationSec)
  if (end - start <= 0.5) return [Math.round(((start + end) / 2) * 100) / 100]
  const times: number[] = []
  for (let t = start + 0.5; t < end && times.length < max; t += every) times.push(Math.round(t * 100) / 100)
  return times
}

function once(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    el.addEventListener(event, () => resolve(), { once: true })
    el.addEventListener('error', () => reject(new Error('This video could not be decoded in the browser.')), { once: true })
  })
}

export async function extractFrames(video: Blob, opts: Range = {}): Promise<Blob[]> {
  const url = URL.createObjectURL(video)
  const el = document.createElement('video')
  el.muted = true
  el.playsInline = true
  el.preload = 'auto'
  el.src = url
  try {
    await once(el, 'loadedmetadata')
    const width = Math.min(768, el.videoWidth || 768)
    const height = Math.round((width * (el.videoHeight || 432)) / (el.videoWidth || 768))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.')
    const out: Blob[] = []
    for (const t of sampleTimes(el.duration, opts)) {
      el.currentTime = t
      await once(el, 'seeked')
      ctx.drawImage(el, 0, 0, width, height)
      const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
      if (jpg) out.push(jpg)
    }
    return out
  } finally {
    el.removeAttribute('src')
    el.load()
    URL.revokeObjectURL(url)
  }
}
