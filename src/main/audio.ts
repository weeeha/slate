// Audio reference analysis — decode with the system ffmpeg, then measure the
// signal locally: tempo, pitch register, dynamics, brightness, structure.
// The numbers travel to the brain, which writes the style language.

import { spawn } from 'child_process'
import type { AudioFingerprint } from '../shared/types'
import { SAMPLE_RATE, MAX_SECONDS, computeFingerprint } from '../shared/audioFingerprint'

export type { AudioFingerprint }
export { computeFingerprint }

function decodePcm(path: string): Promise<{ pcm: Int16Array; fullDurationSec: number }> {
  return new Promise((resolve, reject) => {
    // Duration probe piggybacks on stderr; decode capped sample from the start.
    const child = spawn('ffmpeg', [
      '-i', path,
      '-map', 'a:0',
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-t', String(MAX_SECONDS),
      '-f', 's16le',
      'pipe:1'
    ])
    const chunks: Buffer[] = []
    let err = ''
    child.stdout.on('data', (d: Buffer) => chunks.push(d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => reject(new Error(`ffmpeg failed: ${e.message}`)))
    child.on('close', (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(err.includes('does not contain any stream') || err.includes('Stream map')
          ? 'No audio track found in this file.'
          : `Could not decode audio (ffmpeg exit ${code}).`))
        return
      }
      const buf = Buffer.concat(chunks)
      const pcm = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2))
      const durMatch = err.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/)
      const fullDurationSec = durMatch
        ? Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3])
        : pcm.length / SAMPLE_RATE
      resolve({ pcm, fullDurationSec })
    })
  })
}

export async function analyzeAudio(path: string): Promise<AudioFingerprint> {
  const { pcm, fullDurationSec } = await decodePcm(path)
  if (pcm.length < SAMPLE_RATE) throw new Error('Audio is too short to analyze (need at least 1 second).')
  return computeFingerprint(pcm, fullDurationSec)
}
