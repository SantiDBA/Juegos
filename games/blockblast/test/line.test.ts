/**
 * Tests de completar líneas. Se corren con node contra el TS, sin build.
 *
 * Uso: node --experimental-strip-types test/line.test.ts
 */
import { Board, EMPTY, type CellPos } from '../src/board.ts'

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

function eq(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  check(name, ok, ok ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

/** Tablero con filas de texto; '.' vacío, dígitos 1-8 son tiers. */
function boardFrom(rows: string[]): Board {
  const w = rows[0]!.length
  for (const [i, r] of rows.entries()) {
    if (r.length !== w) throw new Error(`fila ${i} de largo ${r.length}, esperado ${w}`)
  }
  const b = new Board(w, rows.length)
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y]![x]!
      b.set(x, y, ch === '.' ? EMPTY : Number.parseInt(ch, 10))
    }
  }
  return b
}

function rowsOf(b: Board): string[] {
  const out: string[] = []
  for (let y = 0; y < b.height; y++) {
    let s = ''
    for (let x = 0; x < b.width; x++) s += b.at(x, y) === EMPTY ? '.' : String(b.at(x, y))
    out.push(s)
  }
  return out
}

const ONE: CellPos[] = [{ x: 0, y: 0 }]
const MIN = 4

// ---------------------------------------------------------------- H

console.log('\n== línea horizontal ==')
{
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(0, 1, 2)
  b.set(1, 1, 2)
  b.set(2, 1, 2)
  const res = b.place([{ tier: 2, cells: ONE }], { x: 3, y: 1 }, MIN)
  check('cuarta pieza completa la fila', res.cleared === 4, `cleared=${res.cleared}`)
  check('una línea', res.lines.length === 1)
  eq('la fila quedó vacía', rowsOf(b)[1], '....')
  eq('puntaje 4 celdas x 10', res.score, 40)
}
{
  // 3 no completa.
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(0, 1, 2)
  b.set(1, 1, 2)
  const res = b.place([{ tier: 2, cells: ONE }], { x: 2, y: 1 }, MIN)
  eq('con 3 no completa', res.cleared, 0)
  check('pero el movimiento es válido', res.valid)
  eq('los bloques quedan', b.occupied, 3)
}

// ---------------------------------------------------------------- V

console.log('\n== línea vertical ==')
{
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(2, 0, 3)
  b.set(2, 1, 3)
  b.set(2, 2, 3)
  const res = b.place([{ tier: 3, cells: ONE }], { x: 2, y: 3 }, MIN)
  check('cuarta pieza completa la columna', res.cleared === 4, `cleared=${res.cleared}`)
  eq('la columna quedó vacía', [b.at(2, 0), b.at(2, 3)], [EMPTY, EMPTY])
}

// ---------------------------------------------------------------- largos

console.log('\n== líneas largas ==')
{
  const b = boardFrom(['.....', '.....', '.....'])
  for (let x = 0; x < 5; x++) b.set(x, 1, 1)
  const g = b.findLines(MIN)
  check('una línea de 5', g.length === 1, `lineas=${g.length}`)
  check('de largo 5', g[0]?.cells.length === 5)
}
{
  // Una fila con dos tramos: el de 3 se descarta, el de 4 se cuenta.
  const b = boardFrom(['.........', '.........'])
  for (const x of [0, 1, 2, 4, 5, 6, 7]) b.set(x, 0, 1)
  const g = b.findLines(MIN)
  check('sólo cuenta el tramo de 4+', g.length === 1, `lineas=${g.length}`)
  check('de largo 4', g[0]?.cells.length === 4)
}

// ---------------------------------------------------------------- cruce

console.log('\n== líneas que se cruzan ==')
{
  // H en y=1 (x 0-3) y V en x=1 (y 0-3). Se cruzan en (1,1).
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(1, 0, 2)
  b.set(1, 2, 2)
  b.set(1, 3, 2)
  b.set(0, 1, 2)
  b.set(2, 1, 2)
  b.set(3, 1, 2)
  const res = b.place([{ tier: 2, cells: ONE }], { x: 1, y: 1 }, MIN)
  check('completó dos líneas', res.lines.length === 2, `lineas=${res.lines.length}`)
  check('8 celdas por celda, 7 únicas', res.cleared === 7, `cleared=${res.cleared}`)
  eq('el tablero quedó vacío', b.occupied, 0)
}

// ---------------------------------------------------------------- gravity

console.log('\n== gravity tras completar ==')
{
  // Cada columna se compacta por separado: la de x=0 tiene un 1 arriba de un
  // 2 y quedan apilados en el fondo; la de x=2 sólo tiene un 1, que también
  // baja hasta el fondo. No hay arrastre lateral.
  const b = boardFrom([
    '1.1.....',
    '2.......',
    '........',
  ])
  b.applyGravity()
  eq('cada columna cae al fondo', rowsOf(b), ['........', '1.......', '2.1.....'])
}
{
  // Columnas independientes: cada una se compacta por su cuenta.
  const b = boardFrom([
    '1...2...',
    '........',
    '3...4...',
    '........',
  ])
  b.applyGravity()
  eq('dos columnas caen por separado', rowsOf(b), [
    '........',
    '........',
    '1...2...',
    '3...4...',
  ])
}

// ---------------------------------------------------------------- sin cascada

console.log('\n== sin cascadas ==')
{
  // La fila 0 es `111.` en x=0..3: se completa con un 1 en x=3. Al borrarla
  // corre la gravity, así que los tres 2 de x=0 caen al fondo de su columna.
  const b = boardFrom([
    '111.....',
    '2.......',
    '2.......',
    '2.......',
    '........',
  ])
  const res = b.place([{ tier: 1, cells: ONE }], { x: 3, y: 0 }, MIN)
  check('se limpió la fila de 4', res.cleared === 4, `cleared=${res.cleared}`)
  check('una sola línea', res.lines.length === 1, `lineas=${res.lines.length}`)
  eq('los 2 bajaron al fondo', rowsOf(b), [
    '........',
    '........',
    '2.......',
    '2.......',
    '2.......',
  ])
}
{
  // La vertical de x=0 ya está completa (4 unos) ANTES de soltar. Al agregar
  // el cuarto 1 de la fila 3, se limpian las dos líneas: la horizontal que se
  // acaba de completar y la vertical que ya existía. Ambas cuentan.
  const b = boardFrom([
    '1.......',
    '1.......',
    '1.......',
    '111.....',
    '........',
  ])
  const res = b.place([{ tier: 1, cells: ONE }], { x: 3, y: 3 }, MIN)
  check('se limpiaron dos líneas', res.lines.length === 2, `lineas=${res.lines.length}`)
  // 4 de la fila + 3 de la vertical, el cruce (0,3) se cuenta una vez: 7.
  eq('7 celdas únicas', res.cleared, 7)
  eq('tablero vacío', b.occupied, 0)
}
{
  // Cascada real: la vertical de x=0 tiene 3 unos (NO es línea todavía) y la
  // fila 3 tiene 3. Al soltar el cuarto 1 en la fila, se limpia sólo la
  // horizontal. Al caer, la columna x=0 queda con 3 unos, no 4: no hay
  // cascada, y el tablero conserva bloques para el turno siguiente.
  const b = boardFrom([
    '........',
    '1.......',
    '1.......',
    '111.....',
    '........',
  ])
  const res = b.place([{ tier: 1, cells: ONE }], { x: 3, y: 3 }, MIN)
  check('se limpió sólo la horizontal', res.lines.length === 1, `lineas=${res.lines.length}`)
  eq('4 celdas', res.cleared, 4)
  eq('los 2 unos de x=0 quedan apilados', rowsOf(b), [
    '........',
    '........',
    '........',
    '1.......',
    '1.......',
  ])
}

// ---------------------------------------------------------------- validez

console.log('\n== validez ==')
{
  // Colocar sin completar línea ES válido.
  const b = boardFrom(['....', '....', '....', '....'])
  const res = b.place([{ tier: 1, cells: ONE }], { x: 0, y: 0 }, MIN)
  check('colocar sin completar es válido', res.valid)
  eq('pero no puntúa', res.score, 0)
  eq('y el bloque queda', b.occupied, 1)
}
{
  // Fuera de rango.
  const b = boardFrom(['....', '....', '....', '....'])
  const res = b.place([{ tier: 1, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }], { x: 3, y: 0 }, MIN)
  check('fuera de rango es inválido', !res.valid)
  eq('tablero intacto', b.occupied, 0)
}
{
  // Grupo de piezas: si una no cabe, se rechaza todo.
  const b = boardFrom(['....', '....', '....', '....'])
  const res = b.place(
    [
      { tier: 1, cells: ONE },
      { tier: 1, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ],
    { x: 3, y: 0 },
    MIN,
  )
  check('grupo con pieza que no cabe es inválido', !res.valid)
  eq('no se colocó ninguna', b.occupied, 0)
}

// ---------------------------------------------------------------- game over

console.log('\n== game over ==')
{
  const rows: string[] = []
  for (let y = 0; y < 8; y++) {
    rows.push(y === 7 ? '1111111.' : '11111111')
  }
  const b = boardFrom(rows)
  eq('2x2 no tiene placements', b.placements([{ x: 0, y: 0 }, { x: 1, y: 0 }]).length, 0)
  eq('1x1 sí tiene uno', b.placements(ONE).length, 1)
}

// ---------------------------------------------------------------- determinismo

console.log('\n== determinismo ==')
{
  const rows = [
    '11111...',
    '2.2.2...',
    '..33....',
    '4...4...',
    '........',
  ]
  const results = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const b = boardFrom(rows)
    b.place([{ tier: 1, cells: [{ x: 4, y: 0 }] }], { x: 3, y: 0 }, MIN)
    results.add(b.toKey())
  }
  check('100 corridas idénticas', results.size === 1, `variantes=${results.size}`)
}

// ---------------------------------------------------------------- barrido

console.log('\n== barrido aleatorio (200 tableros x 200 turnos) ==')
{
  let seed = 999
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const shapes: CellPos[][] = [
    ONE,
    [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 1 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  ]

  let invalid = 0
  let rejected = 0
  let moves = 0
  let linesFound = 0
  // Lines that only appeared because of the previous turn's gravity. They are
  // not cleared in the same turn (no cascades, by design), so they are counted
  // separately instead of being treated as a broken invariant.
  let pendingAfterGravity = 0

  for (let g = 0; g < 200; g++) {
    const b = new Board(8)
    for (let t = 0; t < 200; t++) {
      const cells = shapes[Math.floor(rnd() * shapes.length)]!
      const tier = 1 + Math.floor(rnd() * 4)
      const x = Math.floor(rnd() * 8)
      const y = Math.floor(rnd() * 8)
      const res = b.place([{ tier, cells }], { x, y }, MIN)
      if (!res.valid) {
        // A piece that doesn't fit is a normal rejection, not a broken rule:
        // the board must be untouched.
        rejected++
        continue
      }
      moves++
      linesFound += res.lines.length

      // Gravity sólo corre cuando se borró algo. Después de correr puede
      // haber líneas nuevas: son las que quedan para el turno siguiente.
      const left = b.findLines(MIN)
      if (left.length > 0) {
        if (res.cleared > 0) pendingAfterGravity++
        // Una línea sin gravity debajo y sin haber borrado este turno es
        // imposible: `place` siempre evalúa antes de terminar.
        else invalid++
      }
    }
  }

  eq('ningún invariante roto', invalid, 0)
  check('hubo movimientos válidos', moves > 5000, `válidos=${moves}`)
  check('hubo rechazos normales', rejected > 1000, `rechazos=${rejected}`)
  check('se completaron líneas', linesFound > 100, `lineas=${linesFound}`)
  check(
    'hubo turnos que dejaron línea para el siguiente',
    pendingAfterGravity > 0,
    `pendientes=${pendingAfterGravity}`,
  )
}

console.log(`\n${passed} pasaron, ${failed} fallaron`)
if (failed > 0) {
  console.log('\nFallos:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}