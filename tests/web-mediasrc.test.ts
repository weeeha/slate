import { describe, it, expect, vi } from 'vitest'

vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:test/1', revokeObjectURL: () => undefined }))
const { mediaSrc } = await import('../src/renderer/src/lib/mediaSrc')
const { cacheUrl, forgetUrls } = await import('../src/renderer/src/web/mediaCache')

describe('mediaSrc', () => {
  it('keeps desktop paths as file:// URLs', () => {
    expect(mediaSrc('/Users/nick/a.jpg')).toBe('file:///Users/nick/a.jpg')
  })
  it('maps cached slate-web paths to object URLs and forgets them', () => {
    cacheUrl('slate-web:/media/a/x.png', new Blob(['x']))
    expect(mediaSrc('slate-web:/media/a/x.png')).toBe('blob:test/1')
    forgetUrls(['slate-web:/media/a/x.png'])
    expect(mediaSrc('slate-web:/media/a/x.png')).toBe('')
  })
})
