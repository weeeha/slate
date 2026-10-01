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

// True when the pixels are all transparent or near-black, i.e. nothing was presented yet.
export function isBlank(data: ArrayLike<number>, threshold = 6): boolean {
  let sum = 0
  let n = 0
  for (let i = 0; i + 3 < data.length; i += 4 * 16) {
    if (data[i + 3] === 0) { n++; continue }
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3
    n++
  }
  return n === 0 || sum / n < threshold
}

// Resolve once the browser has presented a new frame (WebKit paints the seeked frame later than 'seeked').
function nextFrame(el: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    const timer = setTimeout(finish, 500)
    const wrapped = () => { clearTimeout(timer); finish() }
    if ('requestVideoFrameCallback' in el) {
      el.requestVideoFrameCallback(wrapped)
    } else {
      requestAnimationFrame(() => requestAnimationFrame(wrapped))
    }
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
      await nextFrame(el)
      ctx.drawImage(el, 0, 0, width, height)
      if (isBlank(ctx.getImageData(0, 0, width, height).data)) {
        await nextFrame(el)
        ctx.drawImage(el, 0, 0, width, height)
      }
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
