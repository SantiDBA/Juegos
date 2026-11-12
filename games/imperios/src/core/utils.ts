import type { Cost, Resources, Vec2 } from './types'

let nextId = 1
export function uid(): number { return nextId++ }

export function clamp(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)) }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx, dz = az - bz
  return dx * dx + dz * dz
}
export function dist(ax: number, az: number, bx: number, bz: number): number { return Math.sqrt(dist2(ax, az, bx, bz)) }

export function canAfford(have: Resources, cost: Cost): boolean {
  for (const k of ['suministros', 'materiales', 'combustible', 'minerales'] as const) {
    if ((cost[k] ?? 0) > have[k]) return false
  }
  return true
}

export function spend(have: Resources, cost: Cost): void {
  for (const k of ['suministros', 'materiales', 'combustible', 'minerales'] as const) {
    have[k] -= cost[k] ?? 0
  }
}

export function refund(have: Resources, cost: Cost, ratio = 1): void {
  for (const k of ['suministros', 'materiales', 'combustible', 'minerales'] as const) {
    have[k] += Math.floor((cost[k] ?? 0) * ratio)
  }
}

export function formatCost(cost: Cost): string {
  const parts: string[] = []
  if (cost.suministros) parts.push(`S ${cost.suministros}`)
  if (cost.materiales) parts.push(`M ${cost.materiales}`)
  if (cost.combustible) parts.push(`C ${cost.combustible}`)
  if (cost.minerales) parts.push(`Mi ${cost.minerales}`)
  return parts.join(' · ') || '—'
}

export function moveToward(x: number, z: number, tx: number, tz: number, speed: number, dt: number): Vec2 {
  const dx = tx - x, dz = tz - z
  const d = Math.hypot(dx, dz)
  if (d < 0.001) return { x: tx, z: tz }
  const step = Math.min(d, speed * dt)
  return { x: x + (dx / d) * step, z: z + (dz / d) * step }
}

export function randRange(a: number, b: number): number { return a + Math.random() * (b - a) }
