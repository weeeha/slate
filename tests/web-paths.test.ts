import { describe, it, expect } from 'vitest'
import { WEB_SCHEME, isWebPath, stagedPath, framePath, fileNameOf } from '../src/renderer/src/web/paths'

describe('slate-web paths', () => {
  it('builds staged media paths with a safe file name', () => {
    expect(stagedPath('abc', 'My Clip (1).mp4')).toBe('slate-web:/media/abc/My_Clip__1_.mp4')
    expect(isWebPath(stagedPath('abc', 'a.png'))).toBe(true)
    expect(isWebPath('/Users/nick/a.png')).toBe(false)
    expect(WEB_SCHEME).toBe('slate-web:')
  })

  it('builds frame paths under the media path', () => {
    expect(framePath('slate-web:/media/abc/clip.mp4', 3)).toBe('slate-web:/media/abc/clip.mp4.frames/003.jpg')
  })

  it('returns the last path segment as the file name', () => {
    expect(fileNameOf('slate-web:/media/abc/clip.mp4')).toBe('clip.mp4')
    expect(fileNameOf('/Users/nick/x.wav')).toBe('x.wav')
  })
})
