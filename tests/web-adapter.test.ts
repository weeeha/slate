import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createWebApi, DESKTOP_ONLY } from '../src/renderer/src/web/adapter'
import { openStore } from '../src/renderer/src/web/store'

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
})
