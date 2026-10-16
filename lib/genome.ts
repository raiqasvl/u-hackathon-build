/**
 * Voice genome.
 *
 * Runs entirely in the browser on the two recorded phases:
 *   PHASE_01  ॐ sung as a glide from the lowest to the highest comfortable note
 *   PHASE_02  the mantra, spoken
 *
 * Only these numbers ever leave the device. The recording does not.
 */
import Meyda from 'meyda'
import { keccak256, stringToBytes } from 'viem'
import { clamp01 } from './prng'

export interface Genome {
  f0Min: number
  f0Max: number
  f0Med: number
  /** 13 MFCC means: the timbre fingerprint. */
  mfcc: number[]
  /** Spectral centroid, Hz: dark or bright. */
  centroid: number
  /** Spectral flatness 0..1: tone or noise. */
  flatness: number
  /** Spectral rolloff, Hz. */
  rolloff: number
  /** Relative pitch instability between voiced frames. */
  jitter: number
  /** Relative loudness instability between frames. */
  shimmer: number
  /** Syllable-like onsets per second in the mantra. */
  onsetRate: number
}

export interface StyleCoords {
  /** 0 tone … 1 noise */
  x: number
  /** 0 continuous … 1 fragmented */
  y: number
  dark: number
  density: number
  space: number
}

const FRAME = 2048
const HOP = 1024

function mono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice()
  const a = buf.getChannelData(0)
  const b = buf.getChannelData(1)
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2
  return out
}

/** Autocorrelation pitch on a 4x decimated frame. Returns 0 when unvoiced. */
function pitch(frame: Float32Array, sr: number): number {
  const d = 4
  const n = Math.floor(frame.length / d)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) x[i] = frame[i * d]
  const rate = sr / d
  const minLag = Math.floor(rate / 1000)
  const maxLag = Math.min(n - 1, Math.floor(rate / 60))
  let energy = 0
  for (let i = 0; i < n; i++) energy += x[i] * x[i]
  if (energy < 1e-4) return 0
  let best = 0
  let bestLag = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0
    for (let i = 0; i < n - lag; i++) s += x[i] * x[i + lag]
    const r = s / energy
    if (r > best) {
      best = r
      bestLag = lag
    }
  }
  return best > 0.45 && bestLag > 0 ? rate / bestLag : 0
}

interface FrameStats {
  rms: number[]
  f0: number[]
  centroid: number[]
  flatness: number[]
  rolloff: number[]
  mfcc: number[][]
}

function analyse(signal: Float32Array, sr: number): FrameStats {
  Meyda.bufferSize = FRAME
  Meyda.sampleRate = sr
  Meyda.numberOfMFCCCoefficients = 13
  const s: FrameStats = { rms: [], f0: [], centroid: [], flatness: [], rolloff: [], mfcc: [] }
  for (let start = 0; start + FRAME <= signal.length; start += HOP) {
    const frame = signal.subarray(start, start + FRAME)
    const f = Meyda.extract(
      ['rms', 'spectralCentroid', 'spectralFlatness', 'spectralRolloff', 'mfcc'],
      frame,
    ) as unknown as {
      rms: number
      spectralCentroid: number
      spectralFlatness: number
      spectralRolloff: number
      mfcc: number[]
    }
    s.rms.push(f.rms)
    if (f.rms < 0.01) {
      s.f0.push(0)
      continue
    }
    s.f0.push(pitch(frame, sr))
    // Meyda reports the centroid in FFT bins.
    s.centroid.push((f.spectralCentroid * sr) / FRAME)
    s.flatness.push(f.spectralFlatness)
    s.rolloff.push(f.spectralRolloff)
    s.mfcc.push(f.mfcc)
  }
  return s
}

const mean = (a: number[]) => (a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0)
function median(a: number[]): number {
  if (!a.length) return 0
  const s = [...a].sort((p, q) => p - q)
  return s[Math.floor(s.length / 2)]
}
function percentile(a: number[], p: number): number {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

function onsetRate(rms: number[], sr: number): number {
  // Smooth, then count local peaks clearly above the running level.
  const sm = rms.map((_, i) => mean(rms.slice(Math.max(0, i - 1), i + 2)))
  const level = mean(sm)
  const hopSec = HOP / sr
  const minGap = Math.ceil(0.09 / hopSec)
  let peaks = 0
  let last = -minGap
  for (let i = 1; i < sm.length - 1; i++) {
    if (sm[i] > sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] > level * 1.1 && i - last >= minGap) {
      peaks++
      last = i
    }
  }
  const active = sm.filter((v) => v > 0.01).length * hopSec
  return active > 0 ? peaks / active : 0
}

export function extractGenome(glide: AudioBuffer, mantra: AudioBuffer): Genome {
  const sr = glide.sampleRate
  const g = analyse(mono(glide), sr)
  const m = analyse(mono(mantra), mantra.sampleRate)

  const voicedGlide = g.f0.filter((v) => v > 0)
  const voicedAll = [...voicedGlide, ...m.f0.filter((v) => v > 0)]
  const f0s = voicedGlide.length > 8 ? voicedGlide : voicedAll

  const mf = [...g.mfcc, ...m.mfcc]
  const mfcc = Array.from({ length: 13 }, (_, k) => mean(mf.map((v) => v[k] ?? 0)))

  let jit = 0
  let jn = 0
  const f0seq = [...g.f0, ...m.f0]
  for (let i = 1; i < f0seq.length; i++) {
    const a = f0seq[i - 1]
    const b = f0seq[i]
    if (a > 0 && b > 0 && Math.abs(a - b) / a < 0.2) {
      jit += Math.abs(a - b) / a
      jn++
    }
  }
  let shim = 0
  let sn = 0
  for (let i = 1; i < m.rms.length; i++) {
    const a = m.rms[i - 1]
    const b = m.rms[i]
    if (a > 0.01 && b > 0.01) {
      shim += Math.abs(a - b) / a
      sn++
    }
  }

  return {
    f0Min: percentile(f0s, 0.05) || 80,
    f0Max: percentile(f0s, 0.95) || 300,
    f0Med: median(f0s) || 140,
    mfcc,
    centroid: mean([...g.centroid, ...m.centroid]) || 1500,
    flatness: mean([...g.flatness, ...m.flatness]),
    rolloff: mean([...g.rolloff, ...m.rolloff]) || 4000,
    jitter: jn ? jit / jn : 0,
    shimmer: sn ? shim / sn : 0,
    onsetRate: onsetRate(m.rms, mantra.sampleRate),
  }
}

/** Integer form stored on chain. Every value is scaled so nothing meaningful is lost. */
export function quantize(g: Genome): number[] {
  return [
    Math.round(g.f0Min),
    Math.round(g.f0Max),
    Math.round(g.f0Med),
    ...g.mfcc.map((v) => Math.round(v * 100)),
    Math.round(g.centroid),
    Math.round(g.flatness * 10000),
    Math.round(g.rolloff),
    Math.round(g.jitter * 10000),
    Math.round(g.shimmer * 10000),
    Math.round(g.onsetRate * 100),
  ]
}

export function dequantize(q: number[]): Genome {
  return {
    f0Min: q[0],
    f0Max: q[1],
    f0Med: q[2],
    mfcc: q.slice(3, 16).map((v) => v / 100),
    centroid: q[16],
    flatness: q[17] / 10000,
    rolloff: q[18],
    jitter: q[19] / 10000,
    shimmer: q[20] / 10000,
    onsetRate: q[21] / 100,
  }
}

export function genomeHash(q: number[]): `0x${string}` {
  return keccak256(stringToBytes(`0FREQ/1/${q.join(',')}`))
}

export function seedOf(hash: string): number {
  return parseInt(hash.slice(2, 10), 16) >>> 0
}

/** Where the voice places itself in the abstraction space before anyone moves it. */
export function originOf(g: Genome): StyleCoords {
  const spread = Math.sqrt(mean(g.mfcc.slice(1).map((v) => v * v)))
  return {
    x: clamp01(0.12 + g.flatness * 2.5 + g.jitter * 6 + g.shimmer * 0.4),
    y: clamp01((g.onsetRate - 1.5) / 6),
    dark: clamp01(1 - (g.centroid - 600) / 3400),
    // Soft curve: never saturates, whatever the MFCC scale of the device.
    density: clamp01(spread / (spread + 12)),
    space: clamp01(Math.log2(Math.max(1.01, g.f0Max / Math.max(1, g.f0Min))) / 2.5),
  }
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export function rootOf(f0: number): { midi: number; name: string; hz: number } {
  const midi = Math.round(69 + 12 * Math.log2(Math.max(20, f0) / 440))
  return { midi, name: `${NOTES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`, hz: 440 * 2 ** ((midi - 69) / 12) }
}
