/**
 * Tests de la lógica del tablero. Se corren con `node` contra el TS que
 * importa `board.ts` directamente, sin build ni navegador.
 *
 * Uso: node --experimental-strip-types test/board.test.ts
 * (o `npx tsx`). Fallan con exit 1 si algo no cuadra.
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

/**
 * Crea un tablero con filas como strings; '.' es vacío y '1'..'8' son tiers.
 *
 * Todas las filas deben tener el mismo largo, pero el tablero no tiene por qué
 * ser cuadrado: la gravity es vertical y usar tableros rectangulares deja los
 * casos más legibles.
 */
function boardFrom(rows: string[]): Board {
  const width = rows[0]!.length
  for (const [i, row] of rows.entries()) {
    if (row.length !== width) {
      throw new Error(`fila ${i} de largo ${row.length}, esperado ${width}`)
    }
  }
  const b = new Board(width, rows.length)
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[y]![x]!
      b.set(x, y, ch === '.' ? EMPTY : Number.parseInt(ch, 10))
    }
  }
  return b
}

/** Vuelca el tablero como filas de texto, para comparar. */
function rowsOf(b: Board): string[] {
  const out: string[] = []
  for (let y = 0; y < b.height; y++) {
    let s = ''
    for (let x = 0; x < b.width; x++) s += b.at(x, y) === EMPTY ? '.' : String(b.at(x, y))
    out.push(s)
  }
  return out
}

const SQUARE: CellPos[] = [{ x: 0, y: 0 }]
const TWO_H: CellPos[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }]

// ---------------------------------------------------------------- gravity

console.log('\n== gravity ==')
{
  // Dos bloques en la columna 0, filas 0 y 1 de un tablero 3x3. Caen a las
  // dos últimas filas de su columna.
  const b = boardFrom([
    '1..',
    '1..',
    '...',
  ])
  b.applyGravity()
  eq('bloques caen al fondo', rowsOf(b), ['...', '1..', '1..'])
}
{
  // Una columna con 1 arriba, hueco en el medio y 3 bloqueada abajo: los 3 de
  // abajo no se mueven y el de arriba cae hasta apoyarse en ellos.
  const b = boardFrom([
    '1.1',
    '...',
    '111',
  ])
  b.applyGravity()
  eq('huecos se compactan hacia abajo', rowsOf(b), ['...', '1.1', '111'])
}
{
  const b = new Board(8)
  b.set(0, 0, 3)
  b.set(7, 7, 5)
  b.applyGravity()
  eq('columnas independientes', [b.at(0, 7), b.at(7, 7), b.at(0, 0)], [3, 5, EMPTY])
}

// Invariante: ninguna celda con bloque debajo vacío.
{
  const b = new Board(8)
  b.set(3, 1, 2)
  b.set(3, 5, 4)
  b.applyGravity()
  let floating = false
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (b.at(x, y) !== EMPTY && b.at(x, y + 1) === EMPTY && y + 1 < 8) floating = true
    }
  }
  check('nunca queda flotando', !floating)
}

// ---------------------------------------------------------------- merge

console.log('\n== merge ==')
{
  // Dos bloques ya apoyados en (0,2) y (0,3); se suelta un tercero en (0,1)
  // y completa la columna.
  const b = boardFrom([
    '....',
    '....',
    '....',
    '....',
  ])
  b.set(0, 2, 1)
  b.set(0, 3, 1)
  const res = b.place([{ tier: 1, cells: SQUARE }], { x: 0, y: 1 }, 8)
  check('tres iguales fusionan', res.valid, `res=${JSON.stringify(res)}`)
  eq('queda un bloque de tier 2', rowsOf(b), ['....', '....', '....', '2...'])
  eq('puntaje 10*(3-2)=10', res.score, 10)
}
{
  // Grupo de 4: 10*(4-2)=20. Tres 1s en fila y se suelta un cuarto encima.
  const b = boardFrom([
    '....',
    '....',
    '111.',
    '....',
  ])
  const res = b.place([{ tier: 1, cells: SQUARE }], { x: 0, y: 1 }, 8)
  check('completar una fila fusiona', res.valid, `res=${JSON.stringify(res)}`)
  eq('grupo de 4 da 20', res.score, 20)
}
{
  // El bloque fusionado nace arriba-izquierda del grupo: en una L de 1s, el
  // ancla es (0,0), no la celda de abajo.
  const b = boardFrom([
    '11',
    '1.',
    '..',
    '..',
  ].map((r) => r.padEnd(4, '.')))
  b.applyGravity()
  const g = b.findGroups()
  check('detecta el grupo de 3', g.length === 1, `grupos=${g.length}`)
  check('el grupo tiene 3 celdas', g[0]?.cells.length === 3)
}

// Cascada en el mismo turno: un grupo de 3 de tier 1 se fusiona a tier 2 y ese
// tier 2 queda adyacente a otros dos de tier 2, que entonces también fusionan.
// Se arma el estado ya asentado para que la cascada dependa sólo del merge.
{
  // Tablero 4x4: tres 1s en columna y, al fusionar a 2, ese 2 queda pegado a
  // otros dos 2 que también fusionan. Una sola ronda alcanza: la cascada real
  // se prueba en el barrido aleatorio.
  const b = boardFrom([
    '....',
    '....',
    '....',
    '....',
  ])
  // (0,3),(0,2),(0,1) son 1; (1,3),(1,2) son 2.
  b.set(0, 3, 1)
  b.set(0, 2, 1)
  b.set(0, 1, 1)
  b.set(1, 3, 2)
  b.set(1, 2, 2)
  // Se suelta un 1 en (0,0): completa la columna de 1s.
  const res = b.place([{ tier: 1, cells: SQUARE }], { x: 0, y: 0 }, 8)
  check('la cascada es válida', res.valid, `res=${JSON.stringify(res)}`)
  check('hubo cascada (rounds >= 2)', res.rounds >= 2, `rounds=${res.rounds}`)
  const tiers = new Set<number>()
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (b.at(x, y) !== EMPTY) tiers.add(b.at(x, y))
  check('llegó a tier 3', tiers.has(3), `tiers=${[...tiers].sort().join(',')}`)
}

// Un grupo de 3 sobrevive a la gravity: cae al fondo pero sigue siendo grupo.
{
  const b = boardFrom([
    '111...',
    '......',
    '......',
  ])
  b.applyGravity()
  const g = b.findGroups()
  check('un grupo de 3 tras gravity', g.length === 1, `grupos=${g.length}`)
  check('de tier 1', g[0]?.tier === 1)
  check('de 3 celdas', g[0]?.cells.length === 3)
}

// Dos grupos separados del mismo color coexisten: la detección no los mezcla.
{
  const b = boardFrom([
    '......',
    '......',
    '......',
  ])
  // Grupo A: (0,2),(1,2),(2,2) — tres 1s en el fondo.
  b.set(0, 2, 1)
  b.set(1, 2, 1)
  b.set(2, 2, 1)
  // Grupo B: 2x2 de 1s arriba a la derecha.
  b.set(4, 1, 1)
  b.set(5, 1, 1)
  b.set(4, 0, 1)
  b.set(5, 0, 1)

  const g = b.findGroups()
  check('dos grupos separados', g.length === 2, `grupos=${g.length}`)
  check('ambos de tier 1', g.every((x) => x.tier === 1))
  check(
    'tamaños 3 y 4',
    g.map((x) => x.cells.length).sort().join(',') === '3,4',
    g.map((x) => x.cells.length).join(','),
  )
}

// Orden determinista: findGroups ordena por (tier, ancla y, ancla x), así que
// el grupo más arriba va primero.
{
  const b = boardFrom([
    '......',
    '......',
    '......',
  ])
  b.set(0, 2, 2)
  b.set(1, 2, 2)
  b.set(2, 2, 2)
  b.set(4, 1, 2)
  b.set(5, 1, 2)
  b.set(4, 0, 2)
  b.set(5, 0, 2)

  const describe = (): string[] =>
    b.findGroups().map((g) => `${g.tier}:${Math.min(...g.cells.map((c) => c.y))}:${g.cells.length}`)
  eq('findGroups es determinista', describe(), describe())
  // El grupo de la derecha tiene celdas en y=0..1; el del fondo en y=2.
  eq('orden por ancla (y más arriba primero)', describe(), ['2:0:4', '2:2:3'])
}

// Simultanéidad: una fila entera de 1s es un solo grupo, y al fusionar todos
// en la misma ronda queda un solo bloque de tier 2. Si el merge fuera
// secuencial celda por celda, el resultado sería distinto.
{
  const b = boardFrom([
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '11111111',
  ])
  b.applyGravity()
  const g = b.findGroups()
  check('la fila entera es un grupo', g.length === 1, `grupos=${g.length}`)
  check('de 8 celdas', g[0]?.cells.length === 8)
  check('de tier 1', g[0]?.tier === 1)
}

// Dos filas de 8 se convierten en UN bloque de tier 3: fusionan a la vez a
// tier 2 y esos dos tier 2 vuelven a fusionar en la misma cascada.
{
  const b = boardFrom([
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '11111111',
    '11111111',
  ])
  b.applyGravity()
  const g = b.findGroups()
  check('dos filas de 8 son un grupo de 16', g.length === 1, `grupos=${g.length}`)
  check('de 16 celdas', g[0]?.cells.length === 16)
}

// ---------------------------------------------------------------- validez

console.log('\n== validez ==')
{
  // Bloque que cae pero no fusiona nada -> inválido.
  const b = boardFrom([
    '....',
    '....',
    '....',
    '....',
  ])
  const res = b.place([{ tier: 1, cells: SQUARE }], { x: 0, y: 0 }, 8)
  check('caer sin fusionar es inválido', !res.valid)
  eq('el tablero no cambió', rowsOf(b), ['....', '....', '....', '....'])
}
{
  // Dos 1s ya apoyados y un tercero que completa la columna.
  const b = boardFrom([
    '....',
    '....',
    '....',
    '....',
  ])
  b.set(0, 2, 1)
  b.set(0, 3, 1)
  const res = b.place([{ tier: 1, cells: SQUARE }], { x: 0, y: 1 }, 8)
  check('completar un grupo de 3 es válido', res.valid, `res=${JSON.stringify(res)}`)
}
{
  // Fuera de rango -> inválido, sin tocar el tablero.
  const b = boardFrom(['....', '....', '....', '....'])
  const res = b.place([{ tier: 1, cells: TWO_H }], { x: 3, y: 0 }, 8)
  check('fuera de rango es inválido', !res.valid)
}
{
  // Una forma que no cabe porque la celda está ocupada -> inválido.
  const b = boardFrom(['1...', '....', '....', '....'])
  const res = b.place([{ tier: 1, cells: TWO_H }], { x: 0, y: 0 }, 8)
  check('sobre celda ocupada es inválido', !res.valid)
  eq('tablero intacto tras rechazo', rowsOf(b)[0], '1...')
}
{
  // Varias piezas a la vez: si una no cabe, el turno entero se rechaza.
  const b = boardFrom(['....', '....', '....', '....'])
  const res = b.place(
    [
      { tier: 1, cells: SQUARE },
      { tier: 1, cells: TWO_H },
    ],
    { x: 0, y: 0 },
    8,
  )
  check('grupo con una pieza que no cabe es inválido', !res.valid)
  eq('no se частиó ninguna pieza', b.occupied, 0)
}

// ---------------------------------------------------------------- game over

console.log('\n== game over ==')
{
  // Tablero lleno salvo 1 celda. Una pieza 2x2 no entra -> no hay colocación
  // válida, aunque geométricamente "quepa" la 1x1.
  const rows: string[] = []
  for (let y = 0; y < 8; y++) {
    rows.push(y === 7 ? '1111111.' : '11111111')
  }
  const b = boardFrom(rows)
  const places = b.placements([{ x: 0, y: 0 }, { x: 1, y: 0 }])
  eq('2x2 no tiene placements', places.length, 0)
  const onePlaces = b.placements(SQUARE)
  eq('1x1 sí tiene 1 placement', onePlaces.length, 1)
}
{
  // hasMergingPlacement: hay hueco libre pero la pieza no completa grupo, así
  // que no cuenta como jugada. Ésta es la condición real de game over.
  const empty = boardFrom(['....', '....', '....', '....'])
  check(
    'tablero vacío: caer solo no fusiona, así que no hay jugada',
    !empty.hasMergingPlacement(SQUARE, 1),
  )

  const twoOnes = boardFrom(['....', '....', '....', '....'])
  twoOnes.set(0, 2, 1)
  twoOnes.set(0, 3, 1)
  check('con dos 1s hay colocación que completa grupo', twoOnes.hasMergingPlacement(SQUARE, 1))

  const lone = boardFrom(['....', '....', '....', '....'])
  lone.set(0, 3, 1)
  check('con un solo 1 no hay merge posible', !lone.hasMergingPlacement(SQUARE, 1))

  const mixed = boardFrom(['....', '....', '....', '....'])
  mixed.set(0, 3, 1)
  mixed.set(1, 3, 2)
  check('1 junto a 2 no fusionan', !mixed.hasMergingPlacement(SQUARE, 1))
  check('2 junto a 1 tampoco', !mixed.hasMergingPlacement(SQUARE, 2))

  const trio = boardFrom(['....', '....', '....', '....'])
  trio.set(0, 2, 3)
  trio.set(1, 2, 3)
  check('con dos 3 hay merge para un 3', trio.hasMergingPlacement(SQUARE, 3))
}

// ---------------------------------------------------------------- determinismo

console.log('\n== determinismo ==')
{
  const rows = [
    '111.....',
    '..22....',
    '1.2.....',
    '...333..',
    '..1.....',
    '22......',
    '.111....',
    '....111.',
  ]
  const b0 = boardFrom(rows)
  b0.applyGravity()

  const results = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const b = boardFrom(rows)
    b.applyGravity()
    b.place([{ tier: 1, cells: SQUARE }], { x: 4, y: 6 }, 8)
    results.add(b.toKey())
  }
  check('100 corridas idénticas', results.size === 1, `variantes=${results.size}`)
}

// ---------------------------------------------------------------- barrido aleatorio

console.log('\n== barrido aleatorio (500 tableros x 500 turnos) ==')
{
  let seed = 12345
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const shapes: CellPos[][] = [
    SQUARE,
    TWO_H,
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    [{ x: 0, y: 0 }, { x: 0, y: 1 }],
  ]

  let floating = 0
  let inconsistent = 0
  let validMoves = 0
  let games = 0
  let longestGame = 0

  for (let g = 0; g < 500; g++) {
    const b = new Board(8)
    let moves = 0
    let alive = true

    for (let t = 0; t < 500; t++) {
      // Pieza y posición al azar.
      const cells = shapes[Math.floor(rnd() * shapes.length)]!
      const tier = 1 + Math.floor(rnd() * 4)
      const x = Math.floor(rnd() * 8)
      const y = Math.floor(rnd() * 8)

      const res = b.place([{ tier, cells }], { x, y }, 8)
      if (res.valid) {
        validMoves++
        moves++
        // Invariante tras todo movimiento válido: nada flotando y ningún
        // grupo de 3+ sin resolver.
        for (let yy = 0; yy < 8; yy++) {
          for (let xx = 0; xx < 8; xx++) {
            if (b.at(xx, yy) !== EMPTY && b.at(xx, yy + 1) === EMPTY && yy + 1 < 8) floating++
          }
        }
        if (b.findGroups().length > 0) inconsistent++
      }

      // ¿Quedó alguna jugada? Si no, terminó.
      const anyMove = shapes.some((s) => b.hasMergingPlacement(s, tier))
      if (!anyMove) {
        alive = false
        break
      }
    }
    if (alive) longestGame++
    games++
  }

  eq('ningún bloque quedó flotando', floating, 0)
  eq('ningún grupo quedó sin resolver', inconsistent, 0)
  check('hubo movimientos válidos', validMoves > 10000, `válidos=${validMoves}`)
  check('algunas partidas llegaron al final del barrido', longestGame > 0, `larga=${longestGame}`)
  check('se simularon las 500 partidas', games === 500)
}

// ---------------------------------------------------------------- resultado

console.log(`\n${passed} pasaron, ${failed} fallaron`)
if (failed > 0) {
  console.log('\nFallos:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}