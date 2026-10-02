import { isWebPath } from '../web/paths'
import { cachedUrl } from '../web/mediaCache'

/** Image/video URL for a media path: object URL in the browser build, file:// on desktop. */
export function mediaSrc(path: string): string {
  return isWebPath(path) ? (cachedUrl(path) ?? '') : `file://${path}`
}
