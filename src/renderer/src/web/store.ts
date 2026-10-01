// IndexedDB persistence for the browser build: projects by id, media by virtual path.
// Media is stored as { type, bytes } (ArrayBuffer), which every engine can clone.

import type { Project } from '../../../shared/types'

export type MediaRecord = { type: string; bytes: ArrayBuffer }

export interface SlateStore {
  putProject(p: Project): Promise<void>
  getProject(id: string): Promise<Project | null>
  allProjects(): Promise<Project[]>
  deleteProject(id: string): Promise<void>
  putMedia(path: string, rec: MediaRecord): Promise<void>
  getMedia(path: string): Promise<MediaRecord | null>
  deleteMedia(paths: string[]): Promise<void>
  close(): void
}

const PROJECTS = 'projects'
const MEDIA = 'media'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function openStore(name = 'slate:web'): Promise<SlateStore> {
  const open = indexedDB.open(name, 1)
  open.onupgradeneeded = () => {
    const db = open.result
    if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' })
    if (!db.objectStoreNames.contains(MEDIA)) db.createObjectStore(MEDIA)
  }
  const db = await req(open)

  const write = async (store: string, fn: (s: IDBObjectStore) => void): Promise<void> => {
    const tx = db.transaction(store, 'readwrite')
    fn(tx.objectStore(store))
    await done(tx)
  }
  const read = <T>(store: string, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    req(fn(db.transaction(store, 'readonly').objectStore(store)))

  return {
    putProject: (p) => write(PROJECTS, (s) => s.put(structuredClone(p))),
    getProject: async (id) => (await read<Project | undefined>(PROJECTS, (s) => s.get(id))) ?? null,
    allProjects: () => read<Project[]>(PROJECTS, (s) => s.getAll()),
    deleteProject: (id) => write(PROJECTS, (s) => s.delete(id)),
    putMedia: (path, rec) => write(MEDIA, (s) => s.put(rec, path)),
    getMedia: async (path) => (await read<MediaRecord | undefined>(MEDIA, (s) => s.get(path))) ?? null,
    deleteMedia: (paths) => write(MEDIA, (s) => paths.forEach((p) => s.delete(p))),
    close: () => db.close(),
  }
}
