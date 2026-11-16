#!/usr/bin/env node
/**
 * Imperios · capturas deterministas para el loop de calidad
 * =========================================================
 *
 * Toma 10 capturas del juego en un orden fijo (01-menu … 08-asedio) usando el
 * CLI `agent-browser` como único motor de navegador. Cero dependencias npm: sólo
 * módulos nativos de Node (>= 18) y el binario `agent-browser` en el PATH.
 *
 * USOS
 * ----
 *   # servidor por defecto (http://localhost:5173/games/imperios/) y fase "current"
 *   node games/imperios/quality/capture.mjs
 *
 *   # fase explícita: las capturas van a quality/shots/<fase>/
 *   node games/imperios/quality/capture.mjs http://localhost:5173/games/imperios/ fase-0
 *
 *   # otra URL (p. ej. preview de un build) en una fase concreta
 *   node games/imperios/quality/capture.mjs http://localhost:4173/games/imperios/ 02-combate
 *
 *   node games/imperios/quality/capture.mjs --help
 *
 * REQUISITOS
 * ----------
 *   1. `npm run dev` corriendo (Vite en el puerto 5173).
 *   2. El dev hook inyectado en la página:
 *        window.__imperios = { state, render, spawn(team,type,n,x,z) -> ids,
 *                               build(team,btype,x,z,built), give(amount),
 *                               setEra(era), select(ids), selectUnits(team,type,n),
 *                               moveFormation(ids,x,z,formation), camera(x,z),
 *                               reveal(team), fog(), entityIds(), skip(seconds) }
 *      El script falla con un mensaje explícito si el hook no aparece.
 *   3. `agent-browser` instalado y en el PATH (o `AGENT_BROWSER=/ruta/al/binario`).
 *
 * VARIABLES DE ENTORNO
 * --------------------
 *   AGENT_BROWSER        binario a ejecutar (default: "agent-browser").
 *   CAPTURE_SETTLE_MS    espera base tras cada acción antes de capturar (default: 600).
 *   CAPTURE_TIMEOUT_MS   timeout por comando del CLI (default: 120000).
 *
 * NOTAS DE DETERMINISMO
 * ---------------------
 *   - El estado del juego avanza con requestAnimationFrame, así que entre una
 *     mutación del hook (`spawn`, `give`, `skip`, `setEra`) y la captura se espera
 *     tiempo real con setTimeout. Sin esa espera la captura muestra el frame viejo.
 *   - `startGame()` corre una intro de cámara de 1800 ms: antes de 02-arranque se
 *     espera a que termine; si no, el encuadre depende del momento del click.
 *   - Los escenarios que miran lejos de la base usan `camera(x,z)`: con niebla de
 *     guerra, el encuadre por defecto (la base propia) dejaría media toma en negro.
 *   - El escenario de combate pide ~1 s real después de `skip(8)` para que el
 *     render drene trazadoras/impactos y la captura no salga a mitad de frame.
 *
 * NO ejecutar desde un agente sin dev server + hook: es el orquestador quien
 * levanta el entorno. Este archivo sólo se escribe.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_URL = 'http://localhost:5173/games/imperios/'
const BIN = process.env.AGENT_BROWSER || 'agent-browser'
const SETTLE_MS = Number(process.env.CAPTURE_SETTLE_MS ?? 600)
const TIMEOUT_MS = Number(process.env.CAPTURE_TIMEOUT_MS ?? 120_000)
const INTRO_CAMERA_MS = 1900 // duración real de la intro de cámara de startGame()
const PHASE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

const USAGE = `Imperios · capturas deterministas

  node games/imperios/quality/capture.mjs [url] [fase]

  url   default: ${DEFAULT_URL}
  fase  carpeta destino bajo quality/shots/ (default: current)

  Ejemplo:
    node games/imperios/quality/capture.mjs ${DEFAULT_URL} fase-0

  Requiere \`npm run dev\` y el dev hook window.__imperios.
`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE)
  process.exit(0)
}

const BASE_URL = process.argv[2] || DEFAULT_URL
const PHASE = process.argv[3] || 'current'

if (!PHASE_RE.test(PHASE)) {
  console.error(`\n[fatal] nombre de fase inválido: "${PHASE}". Usá letras, números, punto, guión o guión bajo.\n`)
  process.exit(1)
}

const SHOTS_DIR = join(HERE, 'shots', PHASE)

// ---------------------------------------------------------------------------
// Helpers de proceso
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

function short(text, max = 800) {
  const t = String(text ?? '').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * Ejecuta el CLI `agent-browser` con argumentos en array (sin shell, sin escapes).
 * Lanza un Error con stdout/stderr y el comando exacto cuando falla.
 */
function run(args, { allowFail = false, timeout = TIMEOUT_MS } = {}) {
  const printable = [BIN, ...args.map((a) => (a.length > 120 ? `${a.slice(0, 120)}…` : a))].join(' ')
  const res = spawnSync(BIN, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  })

  if (res.error) {
    if (res.error.code === 'ENOENT') {
      throw new Error(
        `No encontré el CLI "${BIN}". Instalá agent-browser o exportá AGENT_BROWSER=/ruta/al/binario.\n  comando: ${printable}`,
      )
    }
    if (res.error.code === 'ETIMEDOUT' || res.signal === 'SIGTERM') {
      throw new Error(`Timeout (${timeout} ms) ejecutando:\n  ${printable}`)
    }
    throw new Error(`Error de proceso ejecutando:\n  ${printable}\n  ${res.error.message}`)
  }

  const out = res.stdout ?? ''
  const err = res.stderr ?? ''

  if (res.status !== 0 && !allowFail) {
    throw new Error(
      `Falló:\n  ${printable}\n  exit: ${res.status}\n  stderr: ${short(err)}\n  stdout: ${short(out)}`,
    )
  }

  return { status: res.status, stdout: out, stderr: err, printable }
}

/** Evalúa JS en la página y devuelve stdout limpio. */
function evalJs(js, opts = {}) {
  const { stdout } = run(['eval', js], opts)
  return stdout.trim()
}

/**
 * Evalúa JS y exige que la salida contenga `expected`. Sirve para detectar
 * fallos silenciosos del hook (p. ej. eval devuelve "not-found" en vez de tirar).
 */
function evalExpect(js, expected, label) {
  const out = evalJs(js)
  if (!out.toLowerCase().includes(String(expected).toLowerCase())) {
    throw new Error(`Escenario "${label}": se esperaba "${expected}" y la página devolvió:\n  ${short(out)}`)
  }
  return out
}

/** Captura de viewport al directorio de la fase. */
function shot(fileName) {
  const file = join(SHOTS_DIR, fileName)
  run(['screenshot', file])
  log(`  ✓ ${fileName}`)
  return file
}

/**
 * Espera a que exista el dev hook. Devuelve true/false (no tira) para que el
 * llamador decida si es fatal.
 */
async function waitForHook({ attempts = 20, delayMs = 250 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    const out = evalJs('typeof window.__imperios', { allowFail: true })
    if (/\b(object|function)\b/.test(out)) return true
    await sleep(delayMs)
  }
  return false
}

// ---------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------

/**
 * Los escenarios mutan el estado del juego a través del hook y dejan que el
 * requestAnimationFrame pinte. Cada uno es autocontenido y ordenado.
 */
const SCENARIOS = [
  {
    id: '02-arranque',
    title: 'Arranque: base del jugador, sin mutaciones',
    // Sin eval: la partida recién empezada es el estado de referencia.
    js: null,
    settleMs: INTRO_CAMERA_MS,
  },
  {
    id: '03-economia',
    title: 'Economía real: ingenieros recolectando, con carga y volviendo a depositar',
    js: `(() => {
      const g = window.__imperios
      const assigned = g.assignEconomy(8)
      g.skip(12)   // llegar al nodo y recolectar
      g.skip(8)    // cargar y comenzar retorno al depósito
      const getIter = () => typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
      const countCarrying = () => {
        let n = 0
        for (const e of getIter()) if (e && !e.dead && e.kind === 'unit' && e.team === 'player' && e.utype === 'ingeniero' && (e.carryAmount || 0) > 0.5) n++
        return n
      }
      for (let i = 0; i < 4 && countCarrying() < 3; i++) g.skip(2)
      let tc = null, sx = 0, sz = 0, sn = 0, cx = 0, cz = 0, cn = 0
      for (const e of getIter()) {
        if (!e || e.dead) continue
        if (e.kind === 'building' && e.btype === 'ayuntamiento' && e.team === 'player') tc = e
        if (e.kind === 'unit' && e.team === 'player' && e.utype === 'ingeniero') {
          sx += e.x; sz += e.z; sn++
          if ((e.carryAmount || 0) > 0.5) { cx += e.x; cz += e.z; cn++ }
        }
      }
      const ax = cn > 0 ? cx / cn : (sn ? sx / sn : -46)
      const az = cn > 0 ? cz / cn : (sn ? sz / sn : 2)
      const tx = tc ? tc.x : -55, tz = tc ? tc.z : 0
      // encuadre zona TC+dropoff con ingenieros volviendo con carga
      g.camera(tx * 0.6 + ax * 0.4, tz * 0.6 + az * 0.4, 54)
      return 'ok assigned=' + assigned + ' carrying=' + cn
    })()`,
    settleMs: 2200, // tiempo real para ver tránsito/carga y FX de depósito
  },
  {
    id: '03b-nodos',
    title: 'Nodos: cantidad restante visible al seleccionar un recurso',
    js: `(() => {
      const g = window.__imperios
      let node = null
      for (const e of g.state.entities.values()) {
        if (e.dead || e.kind !== 'resource' || e.amount <= 0) continue
        if (!node || e.resource === 'materiales') node = e
        if (e.resource === 'materiales') break
      }
      if (!node) return 'no-node'
      globalThis.__lastNodeId = node.id
      g.camera(node.x, node.z, 55)
      g.select([node.id])
      g.gatherNode(node.id, 8)
      return 'ok node=' + node.id
    })()`,
    settleMs: SETTLE_MS,
  },
  {
    id: '03c-nodo-agotado',
    title: 'Economía: el nodo baja de cantidad mientras los ingenieros recolectan',
    js: `(() => {
      const g = window.__imperios
      const id = globalThis.__lastNodeId
      if (!id) return 'missing-node'
      g.skip(20)
      const iter = typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
      let amount = -1
      for (const e of iter) { if (e && e.id === id) { amount = e.amount; g.camera(e.x, e.z, 55); g.select([id]); break } }
      if (amount < 0) return 'node-gone'
      return 'ok amount=' + Math.floor(amount)
    })()`,
    settleMs: SETTLE_MS,
  },
  {
    id: '09-research',
    title: 'Investigación en curso: barra visible con segundos y nombre de la tecnología',
    js: `(() => {
      const g = window.__imperios
      g.give(1500) // combustible for Motor de Combustión (350) in a real economy run
      g.setEra(3)
      const iter = typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
      let tc = null
      for (const e of iter) { if (e && e.kind === 'building' && e.btype === 'ayuntamiento' && e.team === 'player') { tc = e.id; break } }
      if (tc == null) return 'no-tc'
      g.select([tc])
      const r = g.research('motor')
      g.camera(-48, 0, 62)
      return r === 'ok' ? 'ok' : 'research:' + r
    })()`,
    settleMs: 350,
  },
  {
    id: '09b-avance-era',
    title: 'Avance de era en curso: barra dorada con progreso y segundos',
    js: `(() => {
      const g = window.__imperios
      g.give(4000)
      g.setEra(1)
      g.camera(-48, 0, 62)
      const iter = typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
      let tc = null
      for (const e of iter) { if (e && e.kind === 'building' && e.btype === 'ayuntamiento' && e.team === 'player') { tc = e.id; break } }
      if (tc == null) return 'no-tc'
      g.select([tc])
      const r = g.advanceEra()
      return r === 'ok' ? 'ok' : 'era:' + r
    })()`,
    settleMs: 600,
  },
  {
    id: '04-combate',
    title: 'Combate: choque de milicias + línea de fusileros enemigos a distancia',
    js: `(() => {
      const g = window.__imperios
      g.spawn('player', 'milicia', 12, -35, 25)
      g.spawn('player', 'fusilero', 5, -37, 29)
      g.spawn('enemy', 'milicia', 10, -31, 25)
      g.spawn('enemy', 'fusilero', 7, -29, 29)
      g.skip(1.5)
      // centrar en el choque real en pleno intercambio (trazadoras/impactos visibles)
      let cx = 0, cz = 0, n = 0
      for (const e of g.state.entities.values()) {
        if (e.dead || e.kind !== 'unit') continue
        if (e.utype !== 'milicia' && e.utype !== 'fusilero') continue
        if (Math.abs(e.x + 33) > 18 || Math.abs(e.z - 27) > 18) continue
        cx += e.x; cz += e.z; n++
      }
      if (n > 0) g.camera(cx / n, cz / n, 50)
      return 'ok'
    })()`,
    settleMs: 1400, // tiempo real para drenar VFX del intercambio
  },
  {
    id: '05-fog',
    title: 'Niebla / exploración en era 3',
    js: `(() => { const g = window.__imperios; g.setEra(3); g.camera(-42, 6, 68); g.skip(2); g.fog(); return 'ok' })()`,
    settleMs: SETTLE_MS,
  },
  {
    id: '06-ui',
    title: 'UI: ayuntamiento del jugador seleccionado (command card)',
    js: null, // se resuelve en runScenario06()
    settleMs: SETTLE_MS,
  },
  {
    id: '07-late-game',
    title: 'Late game: era 4, base enemiga desarrollada y oleada compuesta avanzando al choque',
    js: `(() => {
      const g = window.__imperios
      g.give(4000)
      g.setEra(4)
      // base propia (población y soporte)
      g.build('player', 'vivienda', -46, -8, true)
      g.build('player', 'vivienda', -46, 8, true)
      g.build('player', 'vivienda', -46, -16, true)
      g.build('player', 'cuartel', -52, -14, true)
      g.build('player', 'fabrica', -46, 16, true)
      // base enemiga desarrollada (viviendas, cuartel, almacén, fábrica, torres)
      g.build('enemy', 'vivienda', 46, 10, true)
      g.build('enemy', 'vivienda', 46, -10, true)
      g.build('enemy', 'cuartel', 50, 16, true)
      g.build('enemy', 'almacen', 50, -14, true)
      g.build('enemy', 'fabrica', 60, 12, true)
      g.build('enemy', 'torre', 44, 0, true)
      g.build('enemy', 'torre', 44, 18, true)
      // ejército propio
      g.spawn('player', 'milicia', 10, -38, -2)
      g.spawn('player', 'fusilero', 6, -38, 4)
      g.spawn('player', 'tanque', 5, -38, 10)
      g.spawn('player', 'canon', 2, -40, 15)
      // oleada enemiga clara y reconocible avanzando al frente (infantería + blindados + artillería)
      const wave = []
      wave.push(...g.spawn('enemy', 'milicia', 10, -14, -2))
      wave.push(...g.spawn('enemy', 'fusilero', 6, -12, 4))
      wave.push(...g.spawn('enemy', 'tanque', 5, -10, 10))
      wave.push(...g.spawn('enemy', 'canon', 2, -8, 15))
      g.moveFormation(wave, -34, 6, 'line')
      g.reveal('player')
      g.camera(-26, 6, 74)
      g.skip(6)
      // recentrar en el choque/base+ejércitos con acción visible
      let cx = 0, cz = 0, n = 0
      for (const e of g.state.entities.values()) {
        if (e.dead || e.kind !== 'unit') continue
        if (e.x < -45 || e.x > -5 || Math.abs(e.z - 6) > 28) continue
        cx += e.x; cz += e.z; n++
      }
      if (n > 0) g.camera(cx / n, cz / n, 70)
      return 'ok'
    })()`,
    settleMs: 1200,
  },
  // --- ciclo 02: niebla / formaciones / asedio -----------------------------
  {
    id: '06b-unidades',
    title: 'Unidades + barras de vida: 6 milicias propias seleccionadas',
    js: `(() => {
      const g = window.__imperios
      g.camera(-42, 12)
      const squad = g.spawn('player', 'milicia', 6, -45, 12)
      g.skip(1)
      // el hook expone selectUnits(team, utype, n); el grupo recién creado se
      // vuelve a fijar para que la toma siempre encuadre a estas 6 milicias
      g.selectUnits('player', 'milicia', 6)
      g.select(squad)
      const sel = g.state.selectedIds || []
      return sel.length === 6 ? 'ok' : 'sel:' + sel.length
    })()`,
    settleMs: 700,
  },
  {
    id: '06c-formacion',
    title: 'Formación en cuña: el mismo grupo, orden de movimiento en wedge',
    js: `(() => {
      const g = window.__imperios
      const squad = (g.state.selectedIds || []).slice()
      const n = g.moveFormation(squad, -36, 12, 'wedge')
      g.skip(6)              // avanzar hasta llegar y asentarse en formación
      g.camera(-36, 12, 50)  // reencuadre al destino/formación
      return n >= 6 ? 'ok' : 'moved:' + n
    })()`,
    settleMs: 2400,
  },
  {
    id: '08-asedio',
    title: 'Asedio real: base enemiga defendida con defensores y cruce de fuego activo',
    js: `(() => {
      const g = window.__imperios
      g.setEra(4)
      // base enemiga más desarrollada y defendida
      g.build('enemy', 'vivienda', 58, 10, true)
      g.build('enemy', 'vivienda', 58, -10, true)
      g.build('enemy', 'cuartel', 48, 18, true)
      g.build('enemy', 'almacen', 52, 14, true)
      g.build('enemy', 'fabrica', 60, -14, true)
      g.build('enemy', 'torre', 50, -6, true)
      g.build('enemy', 'torre', 50, 8, true)
      g.build('enemy', 'torre', 46, 2, true)
      // defensores y presión/contraataque breve
      g.spawn('enemy', 'milicia', 8, 51, 2)
      g.spawn('enemy', 'fusilero', 5, 52, -4)
      g.spawn('enemy', 'tanque', 2, 54, 7)
      const counter = g.spawn('enemy', 'milicia', 4, 48, 0)
      g.moveFormation(counter, 44, 0, 'line')
      // fuerza atacante con presión sostenida
      g.spawn('player', 'tanque', 4, 40, 0)
      g.spawn('player', 'milicia', 8, 39, 6)
      g.spawn('player', 'canon', 3, 37, -4)
      g.spawn('player', 'fusilero', 4, 38, 10)
      g.reveal('player')
      g.skip(4)
      // centrar en el asedio/combate activo (ambos bandos)
      let cx = 0, cz = 0, n = 0
      for (const e of g.state.entities.values()) {
        if (e.dead || e.kind !== 'unit') continue
        if (e.x < 34 || e.x > 56 || e.z < -16 || e.z > 20) continue
        cx += e.x; cz += e.z; n++
      }
      if (n > 0) g.camera(cx / n, cz / n, 54)
      else g.camera(47, 2, 54)
      g.fog()
      return 'ok'
    })()`,
    settleMs: 1600,
  },
]

/**
 * 06-ui: busca el ayuntamiento del jugador dentro de `state.entities` (Map),
 * lo selecciona con `select([id])` y valida que la selección quedó aplicada.
 */
async function runScenario06(settleMs) {
  const finder = `(() => {
    const g = window.__imperios
    const ents = g && g.state && g.state.entities
    if (!ents) return 'no-state'
    const iter = typeof ents.values === 'function' ? ents.values() : Object.values(ents)
    for (const e of iter) {
      if (e && e.kind === 'building' && e.btype === 'ayuntamiento' && e.team === 'player') return 'id:' + e.id
    }
    return 'not-found'
  })()`

  let out = evalJs(finder)
  if (out.includes('not-found') || out.includes('no-state')) {
    // La partida puede no haber corrido todavía el primer tick: damos margen.
    await sleep(500)
    out = evalJs(finder)
  }

  const match = /id:(\d+)/.exec(out)
  if (!match) {
    const ids = evalJs(`(() => { try { return JSON.stringify(window.__imperios.entityIds()) } catch (e) { return String(e) } })()`, {
      allowFail: true,
    })
    throw new Error(
      `06-ui: no encontré un ayuntamiento del jugador en state.entities.\n  salida: ${short(out)}\n  entityIds(): ${short(ids)}`,
    )
  }

  const id = Number(match[1])
  const selected = evalJs(`(() => {
    const g = window.__imperios
    g.select([${id}])
    const sel = g.state.selectedIds || []
    return 'selected:' + sel.join(',')
  })()`)

  if (!selected.includes(String(id))) {
    throw new Error(`06-ui: select([${id}]) no quedó aplicado. Salida: ${short(selected)}`)
  }
  log(`  · ayuntamiento del jugador: id ${id}`)
  await sleep(settleMs)
}

// ---------------------------------------------------------------------------
// Flujo principal
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(SHOTS_DIR, { recursive: true })
  log(`\nImperios · capturas`)
  log(`  url   ${BASE_URL}`)
  log(`  fase  ${PHASE}`)
  log(`  dir   ${SHOTS_DIR}`)
  log(`  bin   ${BIN}\n`)

  const created = []
  let opened = false

  try {
    // a. Abrir la página y esperar carga de red + primer frame.
    log('[1/4] Abriendo la página')
    run(['open', BASE_URL])
    opened = true
    run(['wait', '--load', 'networkidle'])
    await sleep(SETTLE_MS)

    // El hook puede montarse en el import del módulo o después del primer tick.
    const hookReady = await waitForHook({ attempts: 8, delayMs: 250 })
    if (!hookReady) {
      log('  ! el dev hook todavía no responde; sigo y lo reintento tras el click')
    }

    // b. Menú / pantalla de inicio.
    log('[2/4] Menú')
    created.push(shot('01-menu.png'))

    // c. Click en "Comenzar partida" vía DOM (id="start" en el overlay de la UI).
    log('[3/4] Comenzando partida')
    evalExpect(
      `(() => {
        const b = document.getElementById('start')
        if (!b) return 'missing-start-button'
        b.click()
        return 'clicked'
      })()`,
      'clicked',
      'click-inicio',
    )

    const hookAfterStart = await waitForHook({ attempts: 40, delayMs: 250 })
    if (!hookAfterStart) {
      throw new Error(
        'El dev hook window.__imperios no existe. Verificá que:\n' +
          '  - `npm run dev` esté corriendo (Vite, puerto 5173),\n' +
          '  - la URL apunte a /games/imperios/,\n' +
          '  - el hook esté inyectado sólo en modo dev (import.meta.env.DEV).',
      )
    }

    // d–i. Escenarios en orden fijo.
    log('[4/4] Escenarios')
    for (const sc of SCENARIOS) {
      log(`  · ${sc.id} — ${sc.title}`)
      if (sc.id === '06-ui') {
        await runScenario06(sc.settleMs)
      } else {
        if (sc.js) evalExpect(sc.js, 'ok', sc.id)
        await sleep(sc.settleMs)
      }
      created.push(shot(`${sc.id}.png`))
    }

    log(`\nListo: ${created.length} capturas en ${SHOTS_DIR}`)
    for (const f of created) log(`  - ${f}`)
    log('')
  } finally {
    if (opened) {
      try {
        run(['close'], { allowFail: true })
      } catch (e) {
        log(`  ! no pude cerrar el navegador: ${e.message}`)
      }
    }
  }
}

main().catch((err) => {
  console.error(`\n[fatal] ${err.message}\n`)
  console.error('Nada se escribió fuera de quality/shots/. Revisá el dev server y el dev hook.')
  process.exit(1)
})
