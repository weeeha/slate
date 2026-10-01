import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { openStore } from '../src/renderer/src/web/store'
import { newProjectShape } from '../src/renderer/src/lib/newProject'

let n = 0
const fresh = () => openStore(`test-${n++}`)

describe('slate web store', () => {
  it('round-trips projects', async () => {
    const s = await fresh()
    const p = newProjectShape('Night Market')
    await s.putProject(p)
    expect((await s.getProject(p.id))?.name).toBe('Night Market')
    expect((await s.allProjects()).map((x) => x.id)).toEqual([p.id])
    expect(await s.getProject('missing')).toBeNull()
    s.close()
  })

  it('deletes a project', async () => {
    const s = await fresh()
    const p = newProjectShape('Gone')
    await s.putProject(p)
    await s.deleteProject(p.id)
    expect(await s.getProject(p.id)).toBeNull()
    s.close()
  })

  it('stores media bytes and type, and deletes them by path', async () => {
    const s = await fresh()
    const bytes = new Uint8Array([1, 2, 3]).buffer
    await s.putMedia('slate-web:/media/a/x.png', { type: 'image/png', bytes })
    const rec = await s.getMedia('slate-web:/media/a/x.png')
    expect(rec?.type).toBe('image/png')
    expect(new Uint8Array(rec!.bytes)).toEqual(new Uint8Array([1, 2, 3]))
    await s.deleteMedia(['slate-web:/media/a/x.png'])
    expect(await s.getMedia('slate-web:/media/a/x.png')).toBeNull()
    s.close()
  })
})
