/**
 * The engine: genome + coordinates → sound.
 *
 * Modules, not presets. The genome sets the character of each module (root,
 * harmonic series, formants, roughness, pulse); the coordinates set how the
 * modules are mixed and how they behave. Everything is seeded and rendered
 * offline, so the same recipe always produces the same sample.
 *
 * The recording is never used here. The "voice ghost" is resynthesised from
 * the genome alone, which is what lets the chain hold the score instead of
 * the voice.
 */
import { createRng, clamp01 } from './prng'
import { rootOf, type Genome, type StyleCoords } from './genome'

export const SAMPLE_RATE = 44100
export const DURATION = 15

export interface RenderInput {
  genome: Genome
  coords: StyleCoords
  seed: number
  /** Optional ElevenLabs layer, already decoded. */
  extra?: AudioBuffer | null
}

function formants(g: Genome): [number, number, number] {
  const n = (v: number) => clamp01((v + 25) / 50)
  return [
    300 + n(g.mfcc[1] ?? 0) * 600,
    900 + n(g.mfcc[2] ?? 0) * 1600,
    2400 + n(g.mfcc[3] ?? 0) * 1000,
  ]
}

function noiseBuffer(ctx: BaseAudioContext, rng: () => number, seconds: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1
  return b
}

function impulse(ctx: BaseAudioContext, rng: () => number, seconds: number, darkness: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const b = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c)
    let lp = 0
    const k = 0.15 + (1 - darkness) * 0.8
    for (let i = 0; i < len; i++) {
      lp += k * (rng() * 2 - 1 - lp)
      d[i] = lp * Math.pow(1 - i / len, 2.2)
    }
  }
  return b
}

function shaper(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048
  const curve = new Float32Array(new ArrayBuffer(n * 4))
  const k = amount * 120
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

export async function render({ genome: g, coords: c, seed, extra }: RenderInput): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, SAMPLE_RATE * DURATION, SAMPLE_RATE)
  const rng = createRng(seed)
  const T = DURATION

  const root = rootOf(g.f0Med)
  let bass = root.hz
  while (bass > 82) bass /= 2
  while (bass < 41) bass *= 2

  const tonalW = Math.pow(1 - c.x, 1.3)
  const noiseW = Math.pow(c.x, 1.1)
  const fmW = Math.sin(Math.PI * c.x) * (0.25 + c.density * 0.5)
  const ghostW = 0.25 + c.density * 0.45

  // Master chain: gate (fragmentation) → tone filter (dark) → compressor.
  const mix = ctx.createGain()
  const gate = ctx.createGain()
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 450 * Math.pow(2, (1 - c.dark) * 4.8)
  tone.Q.value = 0.5 + c.x * 4
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 4
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  const verb = ctx.createConvolver()
  verb.buffer = impulse(ctx, rng, 0.4 + c.space * 5.5, c.dark)
  dry.gain.value = 1 - c.space * 0.45
  wet.gain.value = 0.12 + c.space * 0.75

  mix.connect(gate).connect(tone)
  tone.connect(dry).connect(comp)
  tone.connect(verb).connect(wet).connect(comp)
  comp.connect(ctx.destination)

  // Fragmentation: continuous at y=0, chopped by the speech pulse towards y=1.
  gate.gain.setValueAtTime(1, 0)
  if (c.y > 0.04) {
    const pulse = 1 / Math.max(1.5, g.onsetRate || 3)
    const step = pulse / (1 + Math.round(c.y * 5))
    for (let t = 0; t < T; t += step) {
      const open = rng() > c.y * 0.65
      const v = open ? 1 : Math.max(0, 0.15 - c.y * 0.15)
      gate.gain.setValueAtTime(gate.gain.value, t)
      gate.gain.linearRampToValueAtTime(v, t + Math.min(0.012, step / 4))
    }
  }

  // 1. Harmonic bank: the timbre as an overtone series.
  const maxM = Math.max(1e-6, ...g.mfcc.slice(1).map(Math.abs))
  const partials = 4 + Math.round(c.density * 10)
  const stretch = 1 + c.x * 0.035
  for (let k = 1; k <= partials; k++) {
    const amp = (0.25 + Math.abs(g.mfcc[k % 13] ?? 0) / maxM) / Math.pow(k, 0.8)
    const osc = ctx.createOscillator()
    osc.frequency.value = bass * Math.pow(k, stretch) * (1 + (rng() - 0.5) * (g.jitter * 0.6 + 0.002))
    const env = ctx.createGain()
    env.gain.value = amp * tonalW * 0.12
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.02 + rng() * (0.08 + c.y * 0.6)
    const depth = ctx.createGain()
    depth.gain.value = amp * tonalW * 0.1
    lfo.connect(depth).connect(env.gain)
    osc.connect(env).connect(mix)
    osc.start(0)
    lfo.start(0)
  }

  // 2. FM voice: formant ratio as the modulator.
  if (fmW > 0.02) {
    const [f1, f2] = formants(g)
    const carrier = ctx.createOscillator()
    carrier.frequency.value = bass * 2
    const mod = ctx.createOscillator()
    mod.frequency.value = bass * 2 * (f2 / f1)
    const index = ctx.createGain()
    index.gain.value = bass * (1 + (g.centroid / 1000) * (0.5 + c.x * 2))
    mod.connect(index).connect(carrier.frequency)
    const out = ctx.createGain()
    out.gain.value = fmW * 0.08
    carrier.connect(out).connect(mix)
    carrier.start(0)
    mod.start(0)
  }

  // 3. Noise bank: filtered noise at the voice's formants, roughness as drive.
  if (noiseW > 0.02) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, rng, 3)
    src.loop = true
    const drive = ctx.createWaveShaper()
    drive.curve = shaper(clamp01(c.x * 0.6 + g.shimmer * 2))
    const out = ctx.createGain()
    out.gain.value = noiseW * 0.35
    const q = Math.min(25, Math.max(0.6, 1 / (g.flatness + 0.04)))
    for (const f of [...formants(g), g.rolloff * 0.6]) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f
      bp.Q.value = q * (1 - c.x * 0.7)
      src.connect(bp).connect(drive)
    }
    // Harsh end of the field: a share of unfiltered noise.
    const raw = ctx.createGain()
    raw.gain.value = Math.pow(c.x, 3) * 0.6
    src.connect(raw).connect(drive)
    drive.connect(out).connect(mix)
    src.start(0)
  }

  // 4. Voice ghost: a buzz at the voice's own pitch path through its formants,
  //    cut into grains. Recognisable as a voice of no one.
  {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    const lo = g.f0Min / 2
    const hi = g.f0Max / 2
    osc.frequency.setValueAtTime(lo, 0)
    for (let t = 0; t < T; t += 1.5 + rng() * 2) osc.frequency.linearRampToValueAtTime(lo + (hi - lo) * rng(), t)
    const grains = ctx.createGain()
    grains.gain.setValueAtTime(0, 0)
    const count = Math.round(12 + c.density * 70 + c.y * 60)
    const times = Array.from({ length: count }, () => rng() * (T - 0.4)).sort((a, b) => a - b)
    for (const t of times) {
      const len = 0.04 + (1 - c.y) * 0.9 * rng()
      grains.gain.setValueAtTime(0, t)
      grains.gain.linearRampToValueAtTime(0.5 + rng() * 0.5, t + len * 0.3)
      grains.gain.linearRampToValueAtTime(0, t + len)
    }
    const out = ctx.createGain()
    out.gain.value = ghostW * 0.18
    for (const f of formants(g)) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f
      bp.Q.value = 6
      osc.connect(bp).connect(grains)
    }
    grains.connect(out).connect(mix)
    osc.start(0)
  }

  // 5. Optional ElevenLabs layer, described from the same recipe.
  if (extra) {
    const src = ctx.createBufferSource()
    src.buffer = extra
    src.loop = true
    const out = ctx.createGain()
    out.gain.value = 0.35
    src.connect(out).connect(mix)
    src.start(0)
  }

  // Fade the edges so the sample can loop.
  mix.gain.setValueAtTime(0, 0)
  mix.gain.linearRampToValueAtTime(1, 0.25)
  mix.gain.setValueAtTime(1, T - 0.4)
  mix.gain.linearRampToValueAtTime(0, T)

  const buf = await ctx.startRendering()
  normalise(buf, 0.89)
  return buf
}

function normalise(buf: AudioBuffer, target: number) {
  let peak = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]))
  }
  if (peak < 1e-6) return
  const k = target / peak
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] *= k
  }
}

/** Text the ElevenLabs sound layer is generated from. Derived from the recipe only. */
export function describe(g: Genome, c: StyleCoords): string {
  const root = rootOf(g.f0Med).name.replace(/\d/, '')
  const parts = [
    c.x < 0.33 ? 'sustained tonal drone' : c.x < 0.66 ? 'granular textural hum' : 'dense harsh noise',
    c.y < 0.33 ? 'continuous and slowly evolving' : c.y < 0.66 ? 'pulsing irregularly' : 'fragmented, stuttering bursts',
    c.dark > 0.5 ? 'dark, low, muffled' : 'bright, metallic',
    c.space > 0.5 ? 'in a vast reverberant concrete space' : 'close and dry',
    `centred on the note ${root}`,
    'abstract experimental sound, no melody, no drums, no voice',
  ]
  return parts.join(', ')
}
