/**
 * The sigil: a point density, never a drawn shape. An f(θ) construction in the
 * BVLK manner: a deformed circle whose harmonics come from the voice's timbre
 * and whose boundary disperses with noise and fragmentation.
 */
import { createRng } from './prng'
import type { Genome, StyleCoords } from './genome'

export interface Sigil {
  /** xy pairs in [-1, 1] */
  points: Float32Array
  count: number
}

export function sigil(g: Genome, c: StyleCoords, seed: number, count = 1440): Sigil {
  const rng = createRng(seed ^ 0x5f3759df)
  const maxM = Math.max(1e-6, ...g.mfcc.slice(1).map(Math.abs))
  const harmonics = [1, 2, 3, 4, 5].map((i) => ({
    k: 2 + (Math.abs(Math.round(g.mfcc[i] ?? 0)) % 9) + i,
    a: 0.015 + (Math.abs(g.mfcc[i] ?? 0) / maxM) * (0.05 + c.density * 0.05),
    phase: rng() * Math.PI * 2,
  }))
  const dispersal = 0.04 + c.x * 0.5 + c.y * 0.25
  const shells = 1 + Math.round(c.space * 3)
  const points = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2 * shells
    const shell = Math.floor((i / count) * shells)
    let r = 0.78 - shell * 0.11
    for (const h of harmonics) r += h.a * Math.sin(h.k * theta + h.phase)
    // Fragmentation opens gaps in the boundary.
    if (c.y > 0.1 && Math.sin(theta * (3 + Math.round(g.onsetRate))) > 1 - c.y * 1.4) r *= 1 + (rng() - 0.5) * c.y
    r += (rng() - 0.5) * dispersal * 0.6
    points[i * 2] = Math.cos(theta) * r
    points[i * 2 + 1] = Math.sin(theta) * r
  }
  return { points, count }
}

/**
 * Compact SVG for the chain: square dots as zero-length path segments, so a
 * point cloud costs a few bytes per point.
 */
export function sigilSvg(s: Sigil, size = 400, step = 1): string {
  const half = size / 2
  let d = ''
  for (let i = 0; i < s.count; i += step) {
    const x = Math.round(half + s.points[i * 2] * half * 0.92)
    const y = Math.round(half + s.points[i * 2 + 1] * half * 0.92)
    d += `M${x} ${y}h1`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#050505"/><path d="${d}" stroke="#e8e8e8" stroke-width="2" stroke-linecap="square"/></svg>`
}
