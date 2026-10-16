'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  dequantize,
  extractGenome,
  genomeHash,
  originOf,
  quantize,
  rootOf,
  seedOf,
  type Genome,
  type StyleCoords,
} from '@/lib/genome'
import { describe, render } from '@/lib/engine'
import { sigil, sigilSvg } from '@/lib/sigil'
import { toWav } from '@/lib/wav'
import { LANDMARKS, nearest } from '@/lib/field'
import { CONTRACT, EXPLORER, existingToken, mint, connect } from '@/lib/chain'
import s from './Freq.module.css'

type Phase = 'idle' | 'rec1' | 'between' | 'rec2' | 'analysing' | 'ready'
type Lang = 'EN' | 'RU' | 'TH'

const GLIDE_SEC = 6
const MANTRA_SEC = 9

const MANTRA = 'ॐ सच्चिदानंदपरब्रह्मपुरुषोत्तमपरमात्मा'
const SYLLABLES = ['OM', 'SAC', 'CID', 'Ā', 'NAN', 'DA', 'PA', 'RA', 'BRAH', 'MA', 'PU', 'RU', 'ṢOT', 'TA', 'MA', 'PA', 'RA', 'MĀT', 'MĀ']

const f2 = (v: number) => v.toFixed(2)

function announce(lang: Lang, note: string, c: StyleCoords, minted?: bigint): string {
  const spoken = note.replace('#', ' sharp ').replace(/(\d)/, ' $1')
  const x = c.x.toFixed(2)
  const y = c.y.toFixed(2)
  if (lang === 'RU')
    return minted
      ? `Частота записана. Номер ${minted}. Голос остаётся с тобой.`
      : `Частота получена. Тоника ${spoken}. Шум ${x}. Фрагментация ${y}. Голос остаётся с тобой.`
  if (lang === 'TH')
    return minted
      ? `บันทึกความถี่แล้ว หมายเลข ${minted} เสียงของคุณยังคงเป็นของคุณ`
      : `ได้รับความถี่แล้ว โน้ตหลัก ${spoken} เสียงของคุณยังคงเป็นของคุณ`
  return minted
    ? `Frequency entered the record. Number ${minted}. The voice stays with you.`
    : `Frequency received. Root ${spoken}. Noise ${x}. Fragmentation ${y}. The voice stays with you.`
}

async function recordFor(seconds: number, onLevel: (v: number) => void): Promise<AudioBuffer> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(stream)
  const an = ctx.createAnalyser()
  an.fftSize = 1024
  src.connect(an)
  const data = new Float32Array(an.fftSize)
  let raf = 0
  const tick = () => {
    an.getFloatTimeDomainData(data)
    let sum = 0
    for (const v of data) sum += v * v
    onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4))
    raf = requestAnimationFrame(tick)
  }
  tick()
  const rec = new MediaRecorder(stream)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => chunks.push(e.data)
  const done = new Promise<void>((r) => (rec.onstop = () => r()))
  rec.start()
  await new Promise((r) => setTimeout(r, seconds * 1000))
  rec.stop()
  await done
  cancelAnimationFrame(raf)
  onLevel(0)
  stream.getTracks().forEach((t) => t.stop())
  const buf = await ctx.decodeAudioData(await new Blob(chunks).arrayBuffer())
  await ctx.close()
  return buf
}

/**
 * TEST SIGNAL (?test): a synthetic voice-like source, so the pipeline can be
 * checked without a microphone. Labelled as such in the UI; never a stand-in
 * for a real person.
 */
async function testSignal(kind: 'glide' | 'mantra', seconds: number): Promise<AudioBuffer> {
  const sr = 44100
  const ctx = new OfflineAudioContext(1, sr * seconds, sr)
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  const amp = ctx.createGain()
  if (kind === 'glide') {
    osc.frequency.setValueAtTime(98, 0)
    osc.frequency.exponentialRampToValueAtTime(392, seconds - 0.5)
    amp.gain.value = 0.3
  } else {
    osc.frequency.value = 146
    amp.gain.setValueAtTime(0, 0)
    for (let t = 0.2; t < seconds - 0.3; t += 0.21) {
      amp.gain.linearRampToValueAtTime(0.35, t + 0.04)
      amp.gain.linearRampToValueAtTime(0.03, t + 0.18)
    }
  }
  for (const [f, q] of [
    [650, 5],
    [1200, 6],
    [2600, 8],
  ]) {
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = q
    osc.connect(bp).connect(amp)
  }
  amp.connect(ctx.destination)
  osc.start()
  return ctx.startRendering()
}

function Countdown({ seconds, running }: { seconds: number; running: boolean }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (!running) return setLeft(seconds)
    const t0 = performance.now()
    const id = setInterval(() => setLeft(Math.max(0, seconds - (performance.now() - t0) / 1000)), 100)
    return () => clearInterval(id)
  }, [running, seconds])
  return <span>{left.toFixed(1)} S</span>
}

export function Freq() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const [genome, setGenome] = useState<Genome | null>(null)
  const [origin, setOrigin] = useState<StyleCoords | null>(null)
  const [coords, setCoords] = useState<StyleCoords | null>(null)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [rendering, setRendering] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [lang, setLang] = useState<Lang>('EN')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [extra, setExtra] = useState<AudioBuffer | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [gate, setGate] = useState<'open' | 'signing' | 'done'>('open')
  const [minted, setMinted] = useState<{ hash: string; tokenId: bigint; account: string } | null>(null)
  const [testMode, setTestMode] = useState(false)

  const glideRef = useRef<AudioBuffer | null>(null)
  const playCtx = useRef<AudioContext | null>(null)
  const playSrc = useRef<AudioBufferSourceNode | null>(null)
  const fieldRef = useRef<HTMLDivElement | null>(null)

  const q = useMemo(() => (genome ? quantize(genome) : null), [genome])
  const hash = useMemo(() => (q ? genomeHash(q) : null), [q])
  const seed = hash ? seedOf(hash) : 0
  // Render from the quantized genome: exactly what the chain will hold.
  const recipe = useMemo(() => (q ? dequantize(q) : null), [q])
  const root = genome ? rootOf(genome.f0Med) : null
  const region = coords ? nearest(coords.x, coords.y) : '∅'

  useEffect(() => {
    setTestMode(new URLSearchParams(window.location.search).has('test'))
    fetch('/api/sfx')
      .then((r) => r.json())
      .then((j: { enabled: boolean }) => setAiEnabled(j.enabled))
      .catch(() => setAiEnabled(false))
  }, [])

  const speak = useCallback(
    async (text: string) => {
      if (!aiEnabled) return
      try {
        const r = await fetch('/api/voice', { method: 'POST', body: JSON.stringify({ text }) })
        if (!r.ok) return
        const audio = new Audio(URL.createObjectURL(await r.blob()))
        await audio.play()
      } catch {
        /* the System stays silent */
      }
    },
    [aiEnabled],
  )

  async function begin() {
    setError('')
    try {
      setPhase('rec1')
      glideRef.current = testMode ? await testSignal('glide', GLIDE_SEC) : await recordFor(GLIDE_SEC, setLevel)
      setPhase('between')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('idle')
    }
  }

  async function second() {
    setError('')
    try {
      setPhase('rec2')
      const mantra = testMode ? await testSignal('mantra', MANTRA_SEC) : await recordFor(MANTRA_SEC, setLevel)
      setPhase('analysing')
      const g = extractGenome(glideRef.current!, mantra)
      // The recordings are released here. Only the genome is kept.
      glideRef.current = null
      const o = originOf(g)
      setGenome(g)
      setOrigin(o)
      setCoords(o)
      setPhase('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('idle')
    }
  }

  // Re-render whenever the recipe or the point moves.
  useEffect(() => {
    if (!recipe || !coords) return
    let cancelled = false
    setRendering(true)
    const id = setTimeout(async () => {
      const b = await render({ genome: recipe, coords, seed, extra })
      if (cancelled) return
      setBuffer(b)
      setRendering(false)
    }, 320)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [recipe, coords, seed, extra])

  const announced = useRef(false)
  useEffect(() => {
    if (phase === 'ready' && root && origin && !announced.current) {
      announced.current = true
      void speak(announce(lang, root.name, origin))
    }
  }, [phase, root, origin, lang, speak])

  // Hot-swap the loop when a new render lands.
  useEffect(() => {
    if (!playing || !buffer) return
    const ctx = playCtx.current ?? new AudioContext()
    playCtx.current = ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.connect(ctx.destination)
    src.start()
    const prev = playSrc.current
    playSrc.current = src
    prev?.stop()
  }, [buffer, playing])

  function togglePlay() {
    if (playing) {
      playSrc.current?.stop()
      playSrc.current = null
      setPlaying(false)
    } else setPlaying(true)
  }

  function download() {
    if (!buffer || !hash) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(toWav(buffer))
    a.download = `0freq-${hash.slice(2, 10)}.wav`
    a.click()
  }

  async function addLayer() {
    if (!recipe || !coords) return
    setAiBusy(true)
    try {
      const r = await fetch('/api/sfx', { method: 'POST', body: JSON.stringify({ text: describe(recipe, coords) }) })
      if (!r.ok) throw new Error(await r.text())
      const ctx = new AudioContext()
      setExtra(await ctx.decodeAudioData(await r.arrayBuffer()))
      await ctx.close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiBusy(false)
    }
  }

  function moveTo(e: React.PointerEvent<HTMLDivElement>) {
    if (!coords || gate === 'done') return
    if (e.type === 'pointermove' && e.buttons !== 1) return
    const r = fieldRef.current!.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    setCoords({ ...coords, x, y })
  }

  async function accept() {
    if (!q || !hash || !coords || !recipe) return
    setError('')
    setGate('signing')
    try {
      const { account } = await connect()
      const existing = await existingToken(account)
      if (existing > 0n) throw new Error(`This wallet already holds frequency #${existing}. One per wallet.`)
      const svg = sigilSvg(sigil(recipe, coords, seed, 1440), 400, 4)
      const c = [coords.x, coords.y, coords.dark, coords.density, coords.space].map((v) => Math.round(v * 1000)) as [
        number,
        number,
        number,
        number,
        number,
      ]
      const res = await mint({ genomeHash: hash, genome: q, coords: c, svg })
      setMinted(res)
      setGate('done')
      void speak(announce(lang, root!.name, coords, res.tokenId))
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0] : String(e))
      setGate('open')
    }
  }

  const mark = useMemo(() => (recipe && coords ? sigil(recipe, coords, seed, 1440) : null), [recipe, coords, seed])

  return (
    <main className={s.page}>
      <header className={s.head}>
        <h1 className={s.title} aria-label="zero freq">
          ∅FREQ
        </h1>
        <p className="ui-lede">A voice becomes a frequency. The voice stays with you; the abstraction enters the record.</p>
        <div className={s.headMeta}>
          <span className="ui-meta">BVLK.EXE / PROTOCOL 01</span>
          <span className="ui-meta">AVALANCHE FUJI / 43113</span>
          <span className="ui-meta">ELEVENLABS / {aiEnabled ? 'ONLINE' : '∅'}</span>
          <label className="ui-meta">
            SYSTEM VOICE{' '}
            <select className={s.select} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              <option>EN</option>
              <option>RU</option>
              <option>TH</option>
            </select>
          </label>
        </div>
        <div className="ui-scale" aria-hidden="true" />
      </header>

      {/* 01 SIGNAL */}
      <section className={s.section}>
        <div className={s.label}>
          <span className="ui-meta">01 / SIGNAL</span>
          <span className="ui-meta">RECORDED LOCALLY / NEVER SENT</span>
        </div>
        <div className={`${s.signal} ui-plate`}>
          <div className={s.phaseRow} data-active={phase === 'rec1' || phase === 'idle'}>
            <span className="ui-meta">PHASE 01 / {GLIDE_SEC} S</span>
            <p className={s.om} lang="sa">
              ॐ
            </p>
            <p className="ui-prose">Sing OM as one breath. Start at your lowest comfortable note and glide to your highest.</p>
          </div>
          <div className={s.phaseRow} data-active={phase === 'rec2' || phase === 'between'}>
            <span className="ui-meta">PHASE 02 / {MANTRA_SEC} S</span>
            <p className={s.mantra} lang="sa">
              {MANTRA}
            </p>
            <p className={s.syllables}>{SYLLABLES.join(' · ')}</p>
            <p className="ui-meta">OM SACCIDĀNANDA PARABRAHMA PURUṢOTTAMA PARAMĀTMĀ / SPOKEN, NATURAL VOICE</p>
          </div>

          <div className={s.controls}>
            {phase === 'idle' && (
              <button className={s.btn} onClick={begin}>
                RECORD PHASE 01
              </button>
            )}
            {phase === 'between' && (
              <button className={s.btn} onClick={second}>
                RECORD PHASE 02
              </button>
            )}
            {(phase === 'rec1' || phase === 'rec2') && (
              <span className="ui-meta">
                RECORDING / <Countdown seconds={phase === 'rec1' ? GLIDE_SEC : MANTRA_SEC} running />
              </span>
            )}
            {testMode && <span className="ui-meta">TEST SIGNAL / NO MICROPHONE</span>}
            {phase === 'analysing' && <span className="ui-meta">MEASURING</span>}
            {phase === 'ready' && <span className="ui-meta">SIGNAL MEASURED / RECORDING RELEASED</span>}
            <div className={s.meter} aria-hidden="true">
              <div style={{ transform: `scaleX(${level})` }} />
            </div>
          </div>
          {error && <p className={s.error}>{error}</p>}
        </div>
      </section>

      {genome && q && hash && root && coords && origin && recipe && mark && (
        <>
          {/* 02 GENOME */}
          <section className={s.section}>
            <div className={s.label}>
              <span className="ui-meta">02 / GENOME</span>
              <span className="ui-meta">{hash.slice(0, 18)}…</span>
            </div>
            <dl className={s.genome}>
              <div>
                <dt className="ui-meta">ROOT</dt>
                <dd className={s.big}>{root.name}</dd>
              </div>
              <div>
                <dt className="ui-meta">F0 RANGE</dt>
                <dd>
                  {Math.round(genome.f0Min)}–{Math.round(genome.f0Max)} HZ
                </dd>
              </div>
              <div>
                <dt className="ui-meta">CENTROID</dt>
                <dd>{Math.round(genome.centroid)} HZ</dd>
              </div>
              <div>
                <dt className="ui-meta">FLATNESS</dt>
                <dd>{genome.flatness.toFixed(3)}</dd>
              </div>
              <div>
                <dt className="ui-meta">JITTER / SHIMMER</dt>
                <dd>
                  {genome.jitter.toFixed(3)} / {genome.shimmer.toFixed(3)}
                </dd>
              </div>
              <div>
                <dt className="ui-meta">PULSE</dt>
                <dd>{genome.onsetRate.toFixed(2)} / S</dd>
              </div>
              <div className={s.mfcc}>
                <dt className="ui-meta">TIMBRE / MFCC 1–12</dt>
                <dd aria-label="timbre coefficients">
                  {genome.mfcc.slice(1).map((v, i) => (
                    <span key={i} style={{ height: `${Math.min(100, Math.abs(v) * 4 + 4)}%` }} />
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          {/* 03 FIELD */}
          <section className={s.section}>
            <div className={s.label}>
              <span className="ui-meta">03 / FIELD</span>
              <span className="ui-meta">
                {region} / X {f2(coords.x)} / Y {f2(coords.y)} {rendering ? '/ RENDERING' : ''}
              </span>
            </div>
            <div className={s.fieldGrid}>
              <div
                ref={fieldRef}
                className={`${s.field} ui-plate`}
                onPointerDown={moveTo}
                onPointerMove={moveTo}
                role="slider"
                aria-label="abstraction field"
                aria-valuetext={`${region}, noise ${f2(coords.x)}, fragmentation ${f2(coords.y)}`}
                tabIndex={0}
              >
                <span className={`${s.axis} ${s.axisX}`}>TONE / NOISE</span>
                <span className={`${s.axis} ${s.axisY}`}>CONTINUOUS / FRAGMENTED</span>
                {LANDMARKS.map((l) => (
                  <span key={l.name} className={s.landmark} style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%` }}>
                    {l.name}
                  </span>
                ))}
                <span className={s.origin} style={{ left: `${origin.x * 100}%`, top: `${origin.y * 100}%` }} title="where the voice placed itself">
                  ∅
                </span>
                <span className={s.point} style={{ left: `${coords.x * 100}%`, top: `${coords.y * 100}%` }} />
              </div>
              <div className={s.side}>
                {(['dark', 'density', 'space'] as const).map((k) => (
                  <label key={k} className={s.slider}>
                    <span className="ui-meta">
                      {k.toUpperCase()} / {f2(coords[k])}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={coords[k]}
                      disabled={gate === 'done'}
                      onChange={(e) => setCoords({ ...coords, [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
                <div className={s.btnRow}>
                  <button className={s.btn} onClick={togglePlay} disabled={!buffer}>
                    {playing ? 'STOP' : 'LISTEN'}
                  </button>
                  <button className={s.btn} onClick={download} disabled={!buffer}>
                    WAV
                  </button>
                  <button className={s.btn} onClick={() => setCoords(origin)} disabled={gate === 'done'}>
                    RETURN TO ∅
                  </button>
                </div>
                {aiEnabled && (
                  <div className={s.btnRow}>
                    <button className={s.btn} onClick={addLayer} disabled={aiBusy}>
                      {aiBusy ? 'GENERATING' : extra ? 'REGENERATE ELEVENLABS LAYER' : '+ ELEVENLABS LAYER'}
                    </button>
                    {extra && (
                      <button className={s.btn} onClick={() => setExtra(null)}>
                        REMOVE LAYER
                      </button>
                    )}
                  </div>
                )}
                <p className="ui-meta">{describe(recipe, coords)}</p>
              </div>
            </div>
          </section>

          {/* 04 SIGIL + ACCESS */}
          <section className={s.section}>
            <div className={s.label}>
              <span className="ui-meta">04 / SIGIL</span>
              <span className="ui-meta">
                {root.name} / {region} / SEED {seed.toString(16).toUpperCase()}
              </span>
            </div>
            <div className={s.sigilGrid}>
              <div className={`${s.sigil} ui-plate`}>
                <svg viewBox="-1 -1 2 2" className="ui-xray" role="img" aria-label="frequency sigil">
                  {Array.from({ length: mark.count }, (_, i) => (
                    <rect key={i} x={mark.points[i * 2]} y={mark.points[i * 2 + 1]} width={0.006} height={0.006} fill="var(--bvlk-white)" />
                  ))}
                </svg>
              </div>
              <div className={s.gate}>
                <span className="ui-meta">05 / ACCESS</span>
                <p className="ui-prose">
                  Nothing enters the record without your decision. Accepting writes the recipe to Avalanche: the genome, the point you chose and
                  the sigil. One frequency per wallet. It cannot be transferred.
                </p>
                {gate !== 'done' && (
                  <button className={`${s.btn} ${s.accept}`} onClick={accept} disabled={gate === 'signing' || !CONTRACT}>
                    {gate === 'signing' ? 'SIGNING' : 'THIS IS MY FREQUENCY'}
                  </button>
                )}
                {!CONTRACT && <p className="ui-meta">CONTRACT / ∅ / DEPLOY AT /deploy</p>}
                {minted && (
                  <div className={s.minted}>
                    <span className="ui-meta">ENTERED THE RECORD</span>
                    <p className={s.big}>#{minted.tokenId.toString()}</p>
                    <a className="ui-meta" href={`${EXPLORER}/tx/${minted.hash}`} target="_blank" rel="noreferrer">
                      TX / {minted.hash.slice(0, 18)}…
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      <footer className={s.foot}>
        <hr className="rule" />
        <span className="ui-meta">∅FREQ / A ∩ B / BVLK.EXE / U-HACKATHON 2026</span>
      </footer>
    </main>
  )
}
