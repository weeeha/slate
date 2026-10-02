// Browser implementation of SlateApi (the interface the Electron preload exposes as
// window.slate). Installed only when window.slate is missing; Electron is unchanged.

import type { AudioFingerprint, BrainResult, Project, ProjectMeta, SlateApi } from '../../../shared/types'
import { computeFingerprint, SAMPLE_RATE } from '../../../shared/audioFingerprint'
import { newProjectShape } from '../lib/newProject'
import { openStore, type SlateStore } from './store'
import { stagedPath, framePath, fileNameOf, isWebPath } from './paths'
import { cacheUrl, forgetUrls } from './mediaCache'
import { extractFrames } from './frames'
import { decodeToPcm } from './audio'
import { pickFiles } from './pick'

export const DESKTOP_ONLY = 'Desktop app: this runs in the Slate desktop app for now.'

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp'
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-m4v'
const AUDIO_ACCEPT = 'audio/*'

const noop = (): (() => void) => () => undefined
const desktopOnly = (id: string): BrainResult => ({ id, ok: false, text: '', error: DESKTOP_ONLY, elapsedMs: 0 })

function meta(p: Project): ProjectMeta {
  return {
    id: p.id,
    name: p.name,
    logline: p.logline,
    path: `slate-web:/projects/${p.id}`,
    updatedAt: p.updatedAt,
    sceneCount: p.scenes.length,
    shotCount: p.scenes.reduce((n, s) => n + s.shots.length, 0),
  }
}

/**
 * Every stored media path of a project: image references, extracted frames, sheet images.
 * A video reference's own path is not stored (only its frames are), so it is not listed.
 */
function mediaPathsOf(p: Project): string[] {
  const paths = [
    ...p.references.flatMap((r) => (r.kind === 'video' ? r.frames : [r.path, ...r.frames])),
    ...p.characters.flatMap((c) => c.images ?? []),
    ...p.locations.flatMap((l) => l.images ?? []),
    ...p.lookbook.flatMap((l) => l.images ?? []),
  ]
  return [...new Set(paths.filter(isWebPath))]
}

export function createWebApi(deps: { store?: Promise<SlateStore>; pick?: typeof pickFiles } = {}): SlateApi {
  const store = deps.store ?? openStore()
  const pick = deps.pick ?? pickFiles
  const staged = new Map<string, File>()
  let persistAsked = false

  // Ask the browser not to evict this origin's storage (Safari clears script-writable
  // storage after 7 days without interaction). Once per page, best effort, result ignored.
  const askPersistence = (): void => {
    if (persistAsked) return
    persistAsked = true
    try {
      void navigator.storage?.persist?.().catch(() => undefined)
    } catch {
      // storage API unavailable: nothing to do
    }
  }

  const stage = (file: File): string => {
    const path = stagedPath(crypto.randomUUID(), file.name)
    staged.set(path, file)
    cacheUrl(path, file)
    return path
  }

  const blobFor = async (path: string): Promise<Blob | null> => {
    const file = staged.get(path)
    if (file) return file
    const rec = await (await store).getMedia(path)
    return rec ? new Blob([rec.bytes], { type: rec.type }) : null
  }

  const persist = async (path: string, blob: Blob): Promise<void> => {
    await (await store).putMedia(path, { type: blob.type, bytes: await blob.arrayBuffer() })
    cacheUrl(path, blob)
    askPersistence()
  }

  const saveFrames = async (mediaPath: string, frames: Blob[]): Promise<string[]> => {
    const paths: string[] = []
    for (const [i, jpg] of frames.entries()) {
      const p = framePath(mediaPath, i + 1)
      await persist(p, jpg)
      paths.push(p)
    }
    return paths
  }

  /** Load every media blob a project references into the object-URL cache before UI renders it. */
  const warm = async (p: Project): Promise<void> => {
    const s = await store
    for (const path of mediaPathsOf(p)) {
      const rec = await s.getMedia(path)
      if (rec) cacheUrl(path, new Blob([rec.bytes], { type: rec.type }))
    }
  }

  return {
    async listProjects() {
      const all = await (await store).allProjects()
      return all.map(meta).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async createProject(name) {
      const p = newProjectShape(name)
      await (await store).putProject(p)
      askPersistence()
      return structuredClone(p)
    },
    async openProject(id) {
      const p = await (await store).getProject(id)
      if (p) await warm(p)
      return p
    },
    async saveProject(project) {
      await (await store).putProject({ ...project, updatedAt: new Date().toISOString() })
      askPersistence()
    },
    async deleteProject(id) {
      const s = await store
      const p = await s.getProject(id)
      if (p) {
        const paths = mediaPathsOf(p)
        await s.deleteMedia(paths)
        forgetUrls(paths)
      }
      await s.deleteProject(id)
    },
    async revealProject() {},
    async brainStatus() {
      return {
        claude: { available: false, version: null },
        codex: { available: false, version: null },
        local: { available: false, version: null, endpoint: null },
      }
    },
    async brainRun(req) {
      return desktopOnly(req.id)
    },
    async brainCancel() {},
    async brainTest() {
      return desktopOnly('test')
    },
    async localModels() {
      return { endpoint: null, models: [] }
    },
    async pickMedia() {
      return (await pick(`${IMAGE_ACCEPT},${VIDEO_ACCEPT}`, true)).map(stage)
    },
    async pickAudio() {
      return (await pick(AUDIO_ACCEPT, false)).map(stage)
    },
    async ingestMedia(_projectId, path) {
      const blob = await blobFor(path)
      if (!blob) throw new Error(`Media not found: ${fileNameOf(path)}`)
      if (blob.type.startsWith('image/')) {
        await persist(path, blob)
        return { kind: 'image' as const, frames: [path] }
      }
      // Videos are never stored: only the extracted frames are, so a failed decode leaves nothing behind.
      return { kind: 'video' as const, frames: await saveFrames(path, await extractFrames(blob)) }
    },
    async stillsDiscover() {
      return []
    },
    async stillsExtract(_projectId, mediaPath, inSec, outSec) {
      const blob = await blobFor(mediaPath)
      if (!blob) throw new Error(`Media not found: ${fileNameOf(mediaPath)}`)
      return saveFrames(`${mediaPath}.stills`, await extractFrames(blob, { inSec, outSec }))
    },
    async analyzeAudio(path): Promise<AudioFingerprint> {
      const blob = await blobFor(path)
      if (!blob) throw new Error(`Audio not found: ${fileNameOf(path)}`)
      const { pcm, fullDurationSec } = await decodeToPcm(blob)
      if (pcm.length < SAMPLE_RATE) throw new Error('Audio is too short to analyze (need at least 1 second).')
      return computeFingerprint(pcm, fullDurationSec)
    },
    pathForFile(file) {
      return stage(file)
    },
    async copyText(text) {
      await navigator.clipboard.writeText(text)
    },
    onProjectsChanged: noop,
    onHelpOpen: noop,
    onAboutOpen: noop,
  }
}

export function installWebAdapter(): void {
  if (typeof window === 'undefined' || (window as unknown as { slate?: SlateApi }).slate) return
  ;(window as unknown as { slate: SlateApi }).slate = createWebApi()
}
