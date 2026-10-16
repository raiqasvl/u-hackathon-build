/**
 * The abstraction field. Landmarks are coordinates, not presets: they only
 * name regions of a continuous space. x: tone → noise. y: continuous → fragmented.
 */
export interface Landmark {
  name: string
  x: number
  y: number
}

export const LANDMARKS: Landmark[] = [
  { name: 'DRONE', x: 0.07, y: 0.06 },
  { name: 'DARK AMBIENT', x: 0.2, y: 0.16 },
  { name: 'ISOLATIONISM', x: 0.33, y: 0.07 },
  { name: 'SPECTRAL', x: 0.1, y: 0.3 },
  { name: 'TAPE / HAUNTOLOGY', x: 0.36, y: 0.32 },
  { name: 'LOWERCASE', x: 0.5, y: 0.18 },
  { name: 'WEST COAST / FM', x: 0.26, y: 0.56 },
  { name: 'GRANULAR', x: 0.5, y: 0.48 },
  { name: 'MUSIQUE CONCRETE', x: 0.62, y: 0.62 },
  { name: 'IDM', x: 0.36, y: 0.82 },
  { name: 'MICROSOUND', x: 0.56, y: 0.78 },
  { name: 'GLITCH', x: 0.7, y: 0.92 },
  { name: 'INDUSTRIAL', x: 0.76, y: 0.52 },
  { name: 'POWER ELECTRONICS', x: 0.86, y: 0.36 },
  { name: 'HARSH NOISE', x: 0.94, y: 0.74 },
  { name: 'HARSH NOISE WALL', x: 0.95, y: 0.05 },
]

/** The nearest named region, or ∅ when the point sits in unnamed space. */
export function nearest(x: number, y: number): string {
  let best = LANDMARKS[0]
  let dist = Infinity
  for (const l of LANDMARKS) {
    const d = Math.hypot(l.x - x, l.y - y)
    if (d < dist) {
      dist = d
      best = l
    }
  }
  return dist < 0.09 ? best.name : '∅ UNNAMED'
}
