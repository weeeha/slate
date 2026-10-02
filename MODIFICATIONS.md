# Modifications

This fork (weeeha/slate) modifies Slate by Sam Wasserman (wassermanproductions.com), Apache-2.0.

## 2026-10-01: browser build for the AI Studio Suite
- Moved the audio fingerprint DSP from `src/main/audio.ts` to `src/shared/audioFingerprint.ts` unchanged; the desktop decoder imports it.
- Added `src/renderer/src/web/` (browser implementation of `SlateApi`: IndexedDB storage, file-input picking, canvas frame sampling, Web Audio decode) and `src/renderer/src/lib/mediaSrc.ts`.
- `ReferencesPanel.tsx` and `Studios.tsx`: image sources go through `mediaSrc()` (desktop still gets `file://` URLs).
- `src/renderer/index.html`: CSP allows `blob:` images and media.
- `src/renderer/src/main.tsx`: installs the browser adapter when `window.slate` is missing.
- `vite.web.config.ts`, `package.json`: `npm run build:web` builds the browser version into `dist-web/`.

### Browser build: storage and known gaps
- Browser projects are browser-local. They live in this browser's IndexedDB for this origin and are not synced or backed up. The build asks the browser for persistent storage (`navigator.storage.persist()`), but Safari can still evict site data after 7 days without a visit, and clearing site data deletes projects. Zip export and import is planned and not yet built.
- Only images and extracted video frames (JPEG) are stored. A video file itself is read once to extract frames and is not kept, so a clip cannot be re-sampled after the page is reloaded.
- Known gap: the References panel text "Media stays where it lives, Slate links it, never copies it" describes the desktop app. In the browser, images and frames are copied into IndexedDB.
- Known gap: the Home screen warning "No local brain found. Install and sign in to Claude Code" also shows in the browser, where the brain is desktop-only. Brain actions and the brain pill answer with the Desktop app message.
