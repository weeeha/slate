// Synchronous path -> object URL lookups for media held in IndexedDB, so components
// can render <img src={mediaSrc(path)}> without awaiting.

const urls = new Map<string, string>()

export function cacheUrl(path: string, blob: Blob): string {
  const old = urls.get(path)
  if (old) URL.revokeObjectURL(old)
  const url = URL.createObjectURL(blob)
  urls.set(path, url)
  return url
}

export function cachedUrl(path: string): string | undefined {
  return urls.get(path)
}

export function forgetUrls(paths: string[]): void {
  for (const p of paths) {
    const url = urls.get(p)
    if (url) URL.revokeObjectURL(url)
    urls.delete(p)
  }
}
