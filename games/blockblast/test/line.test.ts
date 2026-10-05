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

/** Tablero con filas de texto; '.' vacío, dígitos 1-4 son colores. */
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

// ---------------------------------------------------------------- completitud

console.log('\n== línea completa ==')
{
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(0, 1, 1)
  b.set(1, 1, 2)
  b.set(2, 1, 3)
  const res = b.place([{ tier: 4, cells: ONE }], { x: 3, y: 1 })
  check('la última pieza completa la fila', res.cleared === 4, `cleared=${res.cleared}`)
  check('una línea', res.lines.length === 1)
  eq('la fila quedó vacía', rowsOf(b)[1], '....')
  eq('puntaje 4 celdas x 10', res.cleared * 10, 40)
}
{
  // Con 3 de 4 la fila sigue teniendo un hueco: no completa. Se coloca la
  // cuarta pieza en otra posición que no llena ese hueco.
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(0, 1, 1)
  b.set(1, 1, 1)
  b.set(2, 1, 1)
  const res = b.place([{ tier: 2, cells: ONE }], { x: 0, y: 3 })
  eq('hueco en la fila: no completa', res.cleared, 0)
  check('pero el movimiento es válido', res.valid)
  eq('los bloques quedan', b.occupied, 4)
}
{
  // El color es irrelevante: fila llena con 4 colores distintos.
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(0, 2, 1)
  b.set(1, 2, 2)
  b.set(2, 2, 3)
  b.set(3, 2, 4)
  const g = b.findFullLines()
  check('4 colores distintos completan la fila', g.length === 1, `lineas=${g.length}`)
}
{
  // Todos iguales también completa.
  const b = boardFrom(['....', '....', '....', '....'])
  for (let x = 0; x < 4; x++) b.set(x, 1, 2)
  check('4 iguales completan la fila', b.findFullLines().length === 1)
}

// ---------------------------------------------------------------- vertical

console.log('\n== columna completa ==')
{
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(2, 0, 1)
  b.set(2, 1, 2)
  b.set(2, 2, 3)
  const res = b.place([{ tier: 4, cells: ONE }], { x: 2, y: 3 })
  check('la última pieza completa la columna', res.cleared === 4, `cleared=${res.cleared}`)
  check('una línea', res.lines.length === 1)
  eq('la columna quedó vacía', [b.at(2, 0), b.at(2, 3)], [EMPTY, EMPTY])
}

// ---------------------------------------------------------------- cruce

console.log('\n== fila y columna a la vez ==')
{
  // Se completa la fila 1 y, con la misma pieza, la columna 1.
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(0, 1, 1)
  b.set(2, 1, 1)
  b.set(3, 1, 1)
  b.set(1, 0, 1)
  b.set(1, 2, 1)
  b.set(1, 3, 1)
  const res = b.place([{ tier: 1, cells: ONE }], { x: 1, y: 1 })
  check('completó dos líneas', res.lines.length === 2, `lineas=${res.lines.length}`)
  // 4 + 4 con el cruce (1,1) contado una vez: 7.
  eq('7 celdas únicas', res.cleared, 7)
  eq('tablero vacío', b.occupied, 0)
}

// ---------------------------------------------------------------- gravity

console.log('\n== gravity tras completar ==')
{
  // Al vaciarse una fila, sólo caen los bloques de las columnas tocadas.
  const b = boardFrom([
    '2.......',
    '3.......',
    '........',
    '........',
  ])
  b.applyGravity()
  eq('la columna cae al fondo', rowsOf(b), ['........', '........', '2.......', '3.......'])
}
{
  const b = boardFrom([
    '1...2...',
    '........',
    '3...4...',
    '........',
  ])
  b.applyGravity()
  eq('columnas independientes', rowsOf(b), [
    '........',
    '........',
    '1...2...',
    '3...4...',
  ])
}

// ---------------------------------------------------------------- sin cascada

console.log('\n== sin cascadas ==')
{
  // Tablero 4x4. La fila 1 tiene un 2 en x=0, y la columna x=0 tiene 3 en
  // y=2 y 4 en y=3. Se completa la fila 1 con una pieza 1x3; al borrarla, la
  // columna x=0 conserva el 2 y los otros dos caen, sin formar línea.
  const b = boardFrom(['....', '2...', '3...', '4...'])
  const res = b.place([{ tier: 1, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }], {
    x: 1,
    y: 1,
  })
  check('se limpió la fila', res.cleared === 4, `cleared=${res.cleared}`)
  check('una sola línea', res.lines.length === 1, `lineas=${res.lines.length}`)
  // Al borrarse la fila 1, la columna x=0 queda con 3 y 4: bajó pero no se
  // limpió, porque 3 y 4 no llenan ninguna fila ni columna.
  eq('la columna bajó pero no se limpió', rowsOf(b), ['....', '....', '3...', '4...'])
}

// ---------------------------------------------------------------- validez

console.log('\n== validez ==')
{
  const b = boardFrom(['....', '....', '....', '....'])
  const res = b.place([{ tier: 1, cells: ONE }], { x: 0, y: 0 })
  check('colocar sin completar es válido', res.valid)
  eq('pero no limpia nada', res.cleared, 0)
  eq('el bloque queda', b.occupied, 1)
}
{
  const b = boardFrom(['....', '....', '....', '....'])
  const res = b.place([{ tier: 1, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }], { x: 3, y: 0 })
  check('fuera de rango es inválido', !res.valid)
  eq('tablero intacto', b.occupied, 0)
}
{
  const b = boardFrom(['....', '....', '....', '....'])
  const res = b.place(
    [
      { tier: 1, cells: ONE },
      { tier: 1, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ],
    { x: 3, y: 0 },
  )
  check('grupo con pieza que no cabe es inválido', !res.valid)
  eq('no se colocó ninguna', b.occupied, 0)
}
{
  // Varias piezas a la vez pueden completar la fila entre todas.
  const b = boardFrom(['....', '....', '....', '....'])
  b.set(0, 1, 1)
  b.set(1, 1, 1)
  const res = b.place(
    [
      { tier: 2, cells: ONE },
      { tier: 2, cells: [{ x: 1, y: 0 }] },
    ],
    { x: 2, y: 1 },
  )
  check('varias piezas completan la fila', res.cleared === 4, `cleared=${res.cleared}`)
}

// ---------------------------------------------------------------- game over

console.log('\n== game over ==')
{
  const rows: string[] = []
  for (let y = 0; y < 8; y++) rows.push(y === 7 ? '1111111.' : '11111111')
  const b = boardFrom(rows)
  eq('2x2 no tiene placements', b.placements([{ x: 0, y: 0 }, { x: 1, y: 0 }]).length, 0)
  eq('1x1 sí tiene uno', b.placements(ONE).length, 1)
}

// ---------------------------------------------------------------- determinismo

console.log('\n== determinismo ==')
{
  const rows = ['11111...', '2.2.2...', '..33....', '4...4...', '........']
  const results = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const b = boardFrom(rows)
    b.place([{ tier: 1, cells: [{ x: 4, y: 0 }] }], { x: 3, y: 0 })
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
  // Líneas que aparecieron sólo por la gravity del turno anterior. No se
  // limpian en el mismo turno (no hay cascadas, por diseño), así que quedan
  // pendientes para el siguiente: no cuentan como invariante roto.
  let pendingAfterGravity = 0

  for (let g = 0; g < 200; g++) {
    const b = new Board(8)
    for (let t = 0; t < 200; t++) {
      const cells = shapes[Math.floor(rnd() * shapes.length)]!
      const tier = 1 + Math.floor(rnd() * 4)
      const x = Math.floor(rnd() * 8)
      const y = Math.floor(rnd() * 8)
      const res = b.place([{ tier, cells }], { x, y })
      if (!res.valid) {
        rejected++
        continue
      }
      moves++
      linesFound += res.lines.length

      // Invariante: si se borró algo, tras la gravity no puede quedar un bloque
      // con una celda vacía debajo.
      if (res.cleared > 0) {
        for (let x2 = 0; x2 < 8; x2++) {
          for (let y2 = 0; y2 < 8; y2++) {
            if (b.at(x2, y2) !== EMPTY && b.at(x2, y2 + 1) === EMPTY && y2 + 1 < 8) invalid++
          }
        }
      }
      // Una línea completa que queda es válida: la gravity pudo armarla y se
      // limpia el próximo turno. Sólo es un error si aparece sin haber borrado
      // nada, porque entonces `place` no la evaluó.
      const left = b.findFullLines()
      if (left.length > 0) {
        if (res.cleared > 0) pendingAfterGravity++
        else invalid++
      }
    }
  }

  eq('ningún invariante roto', invalid, 0)
  check('hubo movimientos válidos', moves > 5000, `válidos=${moves}`)
  check('hubo rechazos', rejected > 1000, `rechazos=${rejected}`)
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