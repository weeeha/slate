import 'fake-indexeddb/auto'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createWebApi, DESKTOP_ONLY } from '../src/renderer/src/web/adapter'
import { openStore } from '../src/renderer/src/web/store'
import { decodeToPcm } from '../src/renderer/src/web/audio'
import { extractFrames } from '../src/renderer/src/web/frames'
import { forgetUrls } from '../src/renderer/src/web/mediaCache'

vi.mock('../src/renderer/src/web/audio', () => ({ decodeToPcm: vi.fn() }))
vi.mock('../src/renderer/src/web/frames', () => ({ extractFrames: vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

let n = 0
const api = () => createWebApi({ store: openStore(`adapter-${n++}`), pick: async () => [] })

describe('web SlateApi', () => {
  it('creates, lists, saves, reopens and deletes projects', async () => {
    const s = api()
    const p = await s.createProject('Night Market')
    expect((await s.listProjects()).map((m) => [m.name, m.path])).toEqual([['Night Market', `slate-web:/projects/${p.id}`]])
    await s.saveProject({ ...p, logline: 'A market at night.' })
    expect((await s.openProject(p.id))?.logline).toBe('A market at night.')
    await s.deleteProject(p.id)
    expect(await s.listProjects()).toEqual([])
    expect(await s.openProject(p.id)).toBeNull()
  })

  it('reports desktop-only features instead of throwing', async () => {
    const s = api()
    const status = await s.brainStatus()
    expect(status.claude.available).toBe(false)
    const run = await s.brainRun({ id: 'r1', task: 't', system: '', prompt: '', tier: 'fast' })
    expect(run).toMatchObject({ id: 'r1', ok: false, error: DESKTOP_ONLY })
    expect(await s.stillsDiscover()).toEqual([])
    await expect(s.revealProject('x')).resolves.toBeUndefined()
  })

  it('returns no paths when the picker is cancelled', async () => {
    expect(await api().pickMedia()).toEqual([])
  })

  it('stores image bytes and frame JPEGs but never the full video', async () => {
    const storeP = openStore(`adapter-${n++}`)
    const s = createWebApi({ store: storeP, pick: async () => [] })
    const store = await storeP
    const video = new File([new Uint8Array(64)], 'clip.mp4', { type: 'video/mp4' })
    const jpeg = new Blob([new Uint8Array(8)], { type: 'image/jpeg' })
    vi.mocked(extractFrames).mockResolvedValue([jpeg, jpeg])
    const vpath = s.pathForFile(video)
    const { kind, frames } = await s.ingestMedia('p', vpath)
    expect(kind).toBe('video')
    expect(frames).toHaveLength(2)
    expect(await store.getMedia(vpath)).toBeNull()
    expect(await store.getMedia(frames[0])).toBeTruthy()

    const img = new File([new Uint8Array(8)], 'a.png', { type: 'image/png' })
    const ipath = s.pathForFile(img)
    expect((await s.ingestMedia('p', ipath)).kind).toBe('image')
    expect(await store.getMedia(ipath)).toBeTruthy()
  })

  it('stores nothing when frame extraction fails', async () => {
    const storeP = openStore(`adapter-${n++}`)
    const s = createWebApi({ store: storeP, pick: async () => [] })
    const store = await storeP
    vi.mocked(extractFrames).mockRejectedValue(new Error('could not be decoded'))
    const path = s.pathForFile(new File([new Uint8Array(64)], 'bad.mov', { type: 'video/quicktime' }))
    await expect(s.ingestMedia('p', path)).rejects.toThrow('could not be decoded')
    expect(await store.getMedia(path)).toBeNull()
  })

  it('does not list a video reference path when opening or deleting a project', async () => {
    const storeP = openStore(`adapter-${n++}`)
    const s = createWebApi({ store: storeP, pick: async () => [] })
    const store = await storeP
    const p = await s.createProject('Vid')
    const frame = 'slate-web:/media/f1.jpg'
    await store.putMedia(frame, { type: 'image/jpeg', bytes: new ArrayBuffer(4) })
    const getMedia = vi.spyOn(store!, 'getMedia')
    await s.saveProject({
      ...p,
      references: [{ id: 'r', path: 'slate-web:/media/clip.mp4', kind: 'video', label: 'clip', frames: [frame], elements: null, addedAt: '' }],
    })
    await s.openProject(p.id)
    expect(getMedia.mock.calls.map((c) => c[0])).toEqual([frame])
    forgetUrls([frame])
  })

  it('rejects audio shorter than one second instead of saving a NaN fingerprint', async () => {
    const s = api()
    vi.mocked(decodeToPcm).mockResolvedValue({ pcm: new Int16Array(3200), fullDurationSec: 0.2 })
    const path = s.pathForFile(new File([new Uint8Array(8)], 'blip.wav', { type: 'audio/wav' }))
    await expect(s.analyzeAudio(path)).rejects.toThrow('too short')
  })

  it('asks the browser for persistent storage once, and ignores failure', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { storage: { persist } })
    const s = api()
    const p = await s.createProject('Keep')
    await s.saveProject(p)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('does not fail when the storage API is missing', async () => {
    vi.stubGlobal('navigator', {})
    await expect(api().createProject('NoStorage')).resolves.toBeTruthy()
  })
})
