/**
 * Tests de la lógica de necesidades. Se corren con node contra el TS, sin build.
 *
 * Uso: node --experimental-strip-types test/needs.test.ts
 */
import {
  CRITICAL,
  NEEDS,
  NEEDS_MAX,
  NEEDS_START,
  NEED_ORDER,
  READY_BELOW,
  canAttend,
  createNeeds,
  decayNeeds,
  fillNeed,
  isCritical,
  isFull,
  mostUrgent,
  satisfy,
  type Needs,
} from '../src/needs.ts'

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

function near(name: string, got: number, want: number, eps = 1e-9): void {
  check(name, Math.abs(got - want) <= eps, `got ${got}, want ${want}`)
}

// ---------------------------------------------------------------- alta

console.log('\n== arranque ==')
{
  const needs = createNeeds()
  for (const id of NEED_ORDER) near(`${id} arranca en ${NEEDS_START}`, needs[id], NEEDS_START)
  check('hay cinco necesidades', NEED_ORDER.length === 5)
  check('sin duplicados', new Set(NEED_ORDER).size === 5)

  const custom = createNeeds(12)
  for (const id of NEED_ORDER) near(`${id} respeta el valor inicial`, custom[id], 12)
}

// ---------------------------------------------------------------- ritmo

console.log('\n== ritmo de una partida infinita ==')
{
  // La partida no termina: cada necesidad tiene que dar aire de sobra.
  for (const id of NEED_ORDER) {
    const seconds = NEEDS_START / NEEDS[id].decay
    check(`${id} dura más de un minuto desde llena`, seconds > 60, `${seconds.toFixed(0)}s`)
  }

  // Y la suma no puede ser tan alta que haya que correr sin parar.
  let perSecond = 0
  for (const id of NEED_ORDER) perSecond += NEEDS[id].decay
  const secondsToDrainAll = (NEEDS_MAX * NEED_ORDER.length) / perSecond
  check(
    'vaciarse todo de cero lleva minutos, no segundos',
    secondsToDrainAll > 120,
    `${secondsToDrainAll.toFixed(0)}s`,
  )
}

// ---------------------------------------------------------------- caída

console.log('\n== caída de las necesidades ==')
{
  const needs = createNeeds()
  const emptied = decayNeeds(needs, 1, 1)
  check('un segundo no vacía nada', emptied.length === 0)
  for (const id of NEED_ORDER) {
    near(`${id} bajó su tasa`, needs[id], NEEDS_START - NEEDS[id].decay, 1e-9)
  }

  const doubled = createNeeds()
  decayNeeds(doubled, 1, 2)
  for (const id of NEED_ORDER) {
    const single = NEEDS_START - NEEDS[id].decay
    near(`${id} con el doble de dificultad baja el doble`, doubled[id], NEEDS_START - NEEDS[id].decay * 2)
    check(`${id} baja más que con dificultad 1`, doubled[id] < single)
  }
}

console.log('\n== llegar a cero se reporta y no rompe nada ==')
{
  const needs = createNeeds(1)
  const atZero = decayNeeds(needs, 10, 1)
  check('todas llegaron a cero', atZero.length === NEED_ORDER.length, `len=${atZero.length}`)
  for (const id of NEED_ORDER) {
    near(`${id} queda en cero, no negativo`, needs[id], 0)
    check(`${id} figura entre las que están en cero`, atZero.includes(id))
  }

  // Sigue reportándose frame a frame: es lo que mantiene al gato mustio hasta
  // que lo atiendan. No hay penalidad acumulada que pueda matarlo.
  const again = decayNeeds(needs, 5, 1)
  check('sigue en cero después de más tiempo', again.length === NEED_ORDER.length)
  for (const id of NEED_ORDER) near(`${id} sigue en cero`, needs[id], 0)
}

{
  const full = createNeeds(NEEDS_MAX)
  const none = decayNeeds(full, 0.002, 1)
  check('con las cinco llenas, un ratito no vacía ninguna', none.length === 0)
}

console.log('\n== el tope es 100 ==')
{
  const needs = createNeeds(99.9)
  decayNeeds(needs, 0.001, 0)
  for (const id of NEED_ORDER) check(`${id} no pasa de 100`, needs[id] <= NEEDS_MAX)
}

// ---------------------------------------------------------------- llenado

console.log('\n== llenar una necesidad ==')
{
  const needs = createNeeds(0)
  const id = 'higiene'
  const rate = NEEDS_MAX / NEEDS[id].duration

  const after = fillNeed(needs, id, 1)
  near('un segundo llena su tasa', after, rate, 1e-9)
  near('y el objeto quedó igual', needs[id], rate, 1e-9)

  const rest = fillNeed(needs, id, NEEDS[id].duration)
  near('se planta en el tope', rest, NEEDS_MAX, 1e-9)
  check('está llena', isFull(rest))

  const other = createNeeds(0)
  fillNeed(other, 'comer', NEEDS.comer.duration)
  near('tarda exactamente su duración', other.comer, NEEDS_MAX, 1e-6)
}

console.log('\n== umbrales ==')
{
  check('llena en el borde', isFull(NEEDS_MAX))
  check('llena justo por debajo del borde', isFull(NEEDS_MAX - 0.4))
  check('no llena a mitad', !isFull(NEEDS_MAX - 1))

  check('crítica en el umbral', isCritical(CRITICAL))
  check('crítica por debajo', isCritical(0))
  check('no crítica un punto arriba', !isCritical(CRITICAL + 1))
}

console.log('\n== cuándo se puede hacer algo ==')
{
  check('con la barra baja, sí', canAttend(0))
  check('justo por debajo del umbral, sí', canAttend(READY_BELOW - 0.1))
  check('en el umbral, no', !canAttend(READY_BELOW))
  check('casi llena, no', !canAttend(95))
  check('llena, no', !canAttend(NEEDS_MAX))

  // Con lo que arranca la partida hay que poder atenderlo de una.
  check('al arrancar la partida se puede', canAttend(NEEDS_START))
  // Y el umbral tiene que quedar bastante por encima de lo crítico.
  check('el umbral está por encima de lo crítico', READY_BELOW > CRITICAL)
}

console.log('\n== satisfacer ==')
{
  const needs = createNeeds(5)
  satisfy(needs, 'energia')
  near('queda al máximo', needs.energia, NEEDS_MAX)
  near('y no toca las otras', needs.comer, 5)
}

// ---------------------------------------------------------------- urgente

console.log('\n== la más urgente ==')
{
  const needs = createNeeds()
  needs.banio = 3
  check('encuentra la más baja', mostUrgent(needs) === 'banio')

  const tie = createNeeds()
  check('empate devuelve la primera del orden', mostUrgent(tie) === NEED_ORDER[0])

  const allLow = createNeeds(0)
  allLow.diversion = 0.5
  check('gana la más baja aunque todas estén críticas', mostUrgent(allLow) === NEED_ORDER[0])

  const single = createNeeds(50)
  single.higiene = 49.9
  check('detecta diferencias chicas', mostUrgent(single) === 'higiene')
}

// ---------------------------------------------------------------- determinismo

console.log('\n== mismo estado, mismo resultado ==')
{
  const run = (): Needs => {
    const needs = createNeeds()
    for (let i = 0; i < 120; i++) decayNeeds(needs, 1 / 60, 1.3)
    return needs
  }
  const a = run()
  const b = run()
  check(
    'dos corridas iguales dan lo mismo',
    NEED_ORDER.every((id) => Math.abs(a[id] - b[id]) < 1e-12),
  )
}

console.log(`\n${passed} pasaron, ${failed} fallaron`)
if (failed > 0) {
  console.log('\nFallos:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
