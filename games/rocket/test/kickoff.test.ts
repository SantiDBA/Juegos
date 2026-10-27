/**
 * Tests de las posiciones de kickoff. Se corren con node contra el TS, sin build.
 *
 * Uso: node --experimental-strip-types test/kickoff.test.ts
 */
import { TUNING } from '../src/config.ts'
import { kickoffSpawns } from '../src/kickoff.ts'
import { Rng } from '../src/rng.ts'

const KICKOFF = { radius: TUNING.kickoffRadius, spread: TUNING.kickoffSpread }

let passed = 0
let failed = 0
const failures: string[] = []

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++
  } else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FALLA: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function near(name: string, got: number, want: number, eps = 1e-6): void {
  check(name, Math.abs(got - want) <= eps, `got ${got}, want ${want}`)
}

console.log('\n== kickoff ==')
{
  const rng = new Rng(1234)
  const spawns = kickoffSpawns('blue', 3, rng, KICKOFF)
  check('devuelve un spawn por auto', spawns.length === 3, `len=${spawns.length}`)

  for (const [i, s] of spawns.entries()) {
    const dist = Math.hypot(s.x, s.z)
    near(`auto ${i} a la distancia del círculo`, dist, TUNING.kickoffRadius, 1e-6)
    check(`auto ${i} en su propio campo (z negativo)`, s.z < 0, `z=${s.z}`)

    // El auto tiene que mirar al centro: `forward` es (-sin yaw, 0, -cos yaw).
    const fx = -Math.sin(s.yaw)
    const fz = -Math.cos(s.yaw)
    const toBall = [(-s.x) / dist, (-s.z) / dist]
    const dot = fx * toBall[0]! + fz * toBall[1]!
    near(`auto ${i} mira a la pelota`, dot, 1, 1e-6)
  }
}

console.log('\n== mismo radio y sin pisarse ==')
{
  const spawns = kickoffSpawns('orange', 3, new Rng(77), KICKOFF)
  for (const s of spawns) {
    near('naranja a la misma distancia', Math.hypot(s.x, s.z), TUNING.kickoffRadius, 1e-6)
    check('naranja en su campo (z positivo)', s.z > 0, `z=${s.z}`)
  }

  // Todos a la misma distancia no alcanza: además tienen que estar separados.
  let minSep = Infinity
  for (let i = 0; i < spawns.length; i++) {
    for (let j = i + 1; j < spawns.length; j++) {
      const a = spawns[i]!
      const b = spawns[j]!
      minSep = Math.min(minSep, Math.hypot(a.x - b.x, a.z - b.z))
    }
  }
  check('los tres quedan separados', minSep > 3, `separación mínima=${minSep}`)
}

console.log('\n== el jugador solo ==')
{
  const spawns = kickoffSpawns('blue', 1, new Rng(5), KICKOFF)
  check('un solo spawn', spawns.length === 1)
  near('mismo radio con uno solo', Math.hypot(spawns[0]!.x, spawns[0]!.z), TUNING.kickoffRadius)
  check('dentro del campo', Math.abs(spawns[0]!.x) < TUNING.fieldWidth / 2)
  check('sin equipos no hay nada', kickoffSpawns('orange', 0, new Rng(1), KICKOFF).length === 0)
}

console.log('\n== es aleatorio pero determinístico ==')
{
  const a = kickoffSpawns('blue', 2, new Rng(42), KICKOFF)
  const b = kickoffSpawns('blue', 2, new Rng(42), KICKOFF)
  check(
    'la misma semilla da lo mismo',
    a.every((s, i) => Math.abs(s.x - b[i]!.x) < 1e-9 && Math.abs(s.z - b[i]!.z) < 1e-9),
  )

  // Con 20 semillas distintas los ángulos no deberían repetirse.
  const seen = new Set<string>()
  for (let seed = 0; seed < 20; seed++) {
    const s = kickoffSpawns('blue', 1, new Rng(seed), KICKOFF)[0]!
    seen.add(s.x.toFixed(4))
  }
  check('cada kickoff sale distinto', seen.size === 20, `variantes=${seen.size}`)
}

console.log(`\n${passed} pasaron, ${failed} fallaron`)
if (failed > 0) {
  console.log('\nFallos:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
