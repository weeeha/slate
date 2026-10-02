// Virtual paths for media that lives in the browser (IndexedDB), standing in for the
// filesystem paths the desktop app passes through SlateApi.

export const WEB_SCHEME = 'slate-web:'

export function isWebPath(p: string): boolean {
  return p.startsWith(WEB_SCHEME)
}

export function stagedPath(id: string, fileName: string): string {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_')
  return `${WEB_SCHEME}/media/${id}/${safe}`
}

export function framePath(mediaPath: string, n: number): string {
  return `${mediaPath}.frames/${String(n).padStart(3, '0')}.jpg`
}

export function fileNameOf(p: string): string {
  return p.split('/').pop() ?? p
}
