# Modifications

This fork (weeeha/slate) modifies Slate by Sam Wasserman (wassermanproductions.com), Apache-2.0.

## 2026-10-01: browser build for the AI Studio Suite
- Moved the audio fingerprint DSP from `src/main/audio.ts` to `src/shared/audioFingerprint.ts` unchanged; the desktop decoder imports it.
- Added `src/renderer/src/web/` (browser implementation of `SlateApi`: IndexedDB storage, file-input picking, canvas frame sampling, Web Audio decode) and `src/renderer/src/lib/mediaSrc.ts`.
- `ReferencesPanel.tsx` and `Studios.tsx`: image sources go through `mediaSrc()` (desktop still gets `file://` URLs).
- `src/renderer/index.html`: CSP allows `blob:` images and media.
- `src/renderer/src/main.tsx`: installs the browser adapter when `window.slate` is missing.
- `vite.web.config.ts`, `package.json`: `npm run build:web` builds the browser version into `dist-web/`.
