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
    title: 'Economía real: ciclo denso de aldeanos (recolectando, cargando, entregando y volviendo)',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      // Asegurar tope de población: el hook spawn() recorta al tope, así que sin viviendas
      // los escenarios de combate/economía no llegan a desplegar su fuerza.
      for (let bi = 0; bi < 6; bi++) { g.build('player', 'vivienda', -66, -26 + bi * 10, true); g.build('enemy', 'vivienda', 66, -26 + bi * 10, true) }
      g.skip(0.05)
      const getIter = () => typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
      let tc = null
      const nodes = []
      for (const e of getIter()) {
        if (!e || e.dead) continue
        if (e.kind === 'building' && e.btype === 'ayuntamiento' && e.team === 'player') tc = e
        if (e.kind === 'resource' && e.amount > 0) nodes.push(e)
      }
      const tx = tc ? tc.x : -55, tz = tc ? tc.z : 0
      nodes.sort((a, b) => ((a.x - tx) ** 2 + (a.z - tz) ** 2) - ((b.x - tx) ** 2 + (b.z - tz) ** 2))
      const pick = (pred) => nodes.find(n => pred(n)) || null
      const nFood = pick(n => n.resource === 'suministros') || nodes[0] || null
      const nWood = pick(n => n.resource === 'materiales' && n !== nFood) || nodes[1] || nodes[0] || null
      const nMine = pick(n => (n.resource === 'minerales' || n.resource === 'combustible') && n !== nFood && n !== nWood) || nodes[2] || nodes[1] || nodes[0] || null
      const targets = [nFood, nWood, nMine].filter((n, i, a) => n && a.indexOf(n) === i)

      // base de ingenieros iniciales en economía
      if (typeof g.assignEconomy === 'function') g.assignEconomy(12)

      const send = (node, count, ox = 0, oz = 0) => {
        if (!node || count <= 0) return
        const ids = g.spawn('player', 'ingeniero', count, tx + 3 + ox, tz + oz) || []
        if (typeof g.gatherNode === 'function' && ids.length) g.gatherNode(node.id, count)
      }

      // 1) grupos en distintos nodos para que arranquen el ciclo
      send(nFood, 4, 0, 2)
      send(nWood, 4, 0, -2)
      send(nMine, 3, 1, 0)
      g.skip(14)

      // 2) más trabajadores: algunos ya habrán entregado y vuelven; otros siguen en ruta
      send(nWood, 3, 2, 3)
      send(nFood, 3, 2, -3)
      g.skip(7)

      // 3) oleada fresca en nodos para asegurar recolectores activos en el instante de captura
      send(nMine, 3, 3, 1)
      send(nWood, 2, 3, -1)
      send(nFood, 2, 4, 0)
      g.skip(4)

      const isCarrying = (e) => (e.carryAmount || 0) > 0.5
      const isGathering = (e) => !isCarrying(e) && !!e.gatherTargetId
      const isReturning = (e) => isCarrying(e) && !e.gatherTargetId
      const engs = () => {
        const out = []
        for (const e of getIter()) {
          if (!e || e.dead || e.kind !== 'unit' || e.team !== 'player' || e.utype !== 'ingeniero') continue
          out.push(e)
        }
        return out
      }

      // refuerzo si faltan estados claros (retorno/carga y recolección simultáneos)
      for (let i = 0; i < 6; i++) {
        const list = engs()
        const ret = list.filter(isReturning).length
        const car = list.filter(isCarrying).length
        const gat = list.filter(isGathering).length
        if (car >= 6 && ret >= 3 && gat >= 5) break
        if (gat < 5) {
          const n = targets[i % Math.max(1, targets.length)] || nFood
          if (n) send(n, 2, 4 + i * 0.3, (i % 2 ? 2 : -2))
        }
        g.skip(3)
      }
      // Poner a trabajar TODA la economía: nada de ingenieros ociosos en el still.
      if (typeof g.gatherAll === 'function') g.gatherAll('player')
      g.skip(6)

      // Asegurar PORTADORES al final: sin skips después, o entregan y se vacía.
      for (let i = 0; i < 16; i++) {
        const car = engs().filter(isCarrying).length
        if (car >= 7) break
        g.skip(1.0)
      }

      const list = engs()
      const returning = list.filter(isReturning)
      const carrying = list.filter(e => isCarrying(e) && !isReturning(e))
      const gathering = list.filter(isGathering)
      const others = list.filter(e => !isCarrying(e) && !isGathering(e))

      const nearTc = (a, b) => ((a.x - tx) ** 2 + (a.z - tz) ** 2) - ((b.x - tx) ** 2 + (b.z - tz) ** 2)
      returning.sort(nearTc)
      carrying.sort(nearTc)
      gathering.sort(nearTc)

      // selección representativa de las 3 fases del ciclo
      const selected = [
        ...returning.slice(0, 4),
        ...carrying.slice(0, 2),
        ...gathering.slice(0, 4),
        ...others.slice(0, 2),
      ]
      if (selected.length) g.select(selected.map(e => e.id))

      // encuadre: TC + ruta + nodos cercanos para ver salida, recolección y retorno
      const f1 = nFood || nWood || nMine
      const f2 = nWood || nFood || nMine
      let cx = tx + 8, cz = tz
      if (f1 && f2) {
        cx = tx * 0.38 + f1.x * 0.34 + f2.x * 0.28
        cz = tz * 0.38 + f1.z * 0.34 + f2.z * 0.28
      } else if (f1) {
        cx = tx * 0.45 + f1.x * 0.55
        cz = tz * 0.45 + f1.z * 0.55
      }
      g.camera(cx, cz, 44)
      g.state.status = 'paused'

      const all = engs()
      const cRet = all.filter(isReturning).length
      const cCar = all.filter(isCarrying).length
      const cGat = all.filter(isGathering).length
      return 'ok total=' + all.length + ' carrying=' + cCar + ' returning=' + cRet + ' gathering=' + cGat
    })()`,
    settleMs: 900,
  },
  {
    id: '03b-nodos',
    title: 'Nodos: cantidad restante visible al seleccionar un recurso',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      let node = null
      for (const e of g.state.entities.values()) {
        if (e.dead || e.kind !== 'resource' || e.amount <= 0) continue
        if (!node || e.resource === 'materiales') node = e
        if (e.resource === 'materiales') break
      }
      if (!node) return 'no-node'
      globalThis.__lastNodeId = node.id
      g.camera(node.x, node.z, 50)
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
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      const id = globalThis.__lastNodeId
      if (!id) return 'missing-node'
      const iter = typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
      let amount = -1
      for (const e of iter) {
        if (e && e.id === id) {
          e.amount = 10
          amount = e.amount
          g.camera(e.x, e.z, 46)
          g.select([id])
          break
        }
      }
      if (amount < 0) return 'node-gone'
      g.skip(1)
      return 'ok amount=' + Math.floor(amount)
    })()`,
    settleMs: SETTLE_MS,
  },
  {
    id: '09-research',
    title: 'Investigación en curso: barra de progreso prominente, nombre y tiempo restante visibles',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      g.give(1500)
      g.setEra(3)
      const iter = typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
      let tc = null
      for (const e of iter) { if (e && e.kind === 'building' && e.btype === 'ayuntamiento' && e.team === 'player') { tc = e.id; break } }
      if (tc == null) return 'no-tc'
      g.select([tc])
      const r = g.research('motor')
      // avanzar lo suficiente para que la barra muestre progreso claro sin completar
      if (r === 'ok') g.skip(6)
      g.camera(-48, 0, 46)
      g.state.status = 'paused'
      return r === 'ok' ? 'ok' : 'research:' + r
    })()`,
    settleMs: 600,
  },
  {
    id: '09b-avance-era',
    title: 'Avance de era en curso: barra dorada prominente con progreso, porcentaje y tiempo',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      // Asegurar tope de población: el hook spawn() recorta al tope, así que sin viviendas
      // los escenarios de combate/economía no llegan a desplegar su fuerza.
      for (let bi = 0; bi < 6; bi++) { g.build('player', 'vivienda', -66, -26 + bi * 10, true); g.build('enemy', 'vivienda', 66, -26 + bi * 10, true) }
      g.skip(0.05)
      g.give(5000)
      g.setEra(1)
      // algo de contexto económico alrededor para que el avance se lea en una base activa
      if (typeof g.assignEconomy === 'function') g.assignEconomy(6)
      g.skip(2)
      g.camera(-48, 0, 52)
      const iter = typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
      let tc = null
      for (const e of iter) { if (e && e.kind === 'building' && e.btype === 'ayuntamiento' && e.team === 'player') { tc = e.id; break } }
      if (tc == null) return 'no-tc'
      g.select([tc])
      const r = g.advanceEra()
      // progreso intermedio bien visible (barra dorada avanzada) sin completar
      if (r === 'ok') g.skip(18)
      g.state.status = 'paused'
      return r === 'ok' ? 'ok' : 'era:' + r
    })()`,
    settleMs: 700,
  },
  {
    id: '04-combate',
    title: 'Combate: choque frontal masivo con fuego cruzado, trazadoras, impactos y bajas visibles',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      // Asegurar tope de población: el hook spawn() recorta al tope, así que sin viviendas
      // los escenarios de combate/economía no llegan a desplegar su fuerza.
      for (let bi = 0; bi < 6; bi++) { g.build('player', 'vivienda', -66, -26 + bi * 10, true); g.build('enemy', 'vivienda', 66, -26 + bi * 10, true) }
      g.skip(0.05)
      // Choque denso melee+ranged + artillería ligera: contacto inmediato y fuego cruzado sostenido
      g.spawn('player', 'milicia', 8, -2, 25)
      g.spawn('player', 'fusilero', 10, -10, 25)
      g.spawn('enemy', 'milicia', 8,  2, 25)
      g.spawn('enemy', 'fusilero', 10,  10, 25)

      const entities = () => typeof g.state.entities.values === 'function'
        ? [...g.state.entities.values()]
        : Object.values(g.state.entities)
      const deadUnits = () => entities().filter(e => e && e.dead && e.kind === 'unit')
      const liveFront = () => entities().filter(e => e && !e.dead && e.kind === 'unit' && Math.abs(e.x) < 30 && Math.abs(e.z - 25) < 25)

      // Avanzar hasta choque real con bajas acumuladas (huellas persistentes)
      let dead = 0
      for (let i = 0; i < 18 && dead < 4; i++) {
        g.skip(0.5)
        dead = deadUnits().length
      }
      // Un poco más de intercambio, pero sin que un bando desaparezca
      g.skip(0.3)
      dead = deadUnits().length

      // Refuerzos frescos de ambos bandos: garantiza que azul y rojo estén presentes
      // y disparando en el instante de la captura (no sólo el bando que quedó vivo).
      g.spawn('player', 'milicia', 3, -6, 22)
      g.spawn('player', 'fusilero', 3, -13, 23)
      g.spawn('enemy', 'milicia', 3, 6, 22)
      g.spawn('enemy', 'fusilero', 3, 13, 23)
      g.skip(0.8)
      // pausa justo tras actividad
      g.skip(0.15)
      g.state.status = 'paused'

      // Encuadre fijo sobre el frente: ambas líneas (±13) entran en cuadro
      g.camera(0, 25, 48)

      return 'ok dead=' + deadUnits().length
    })()`,
    settleMs: 850,
  },
  {
    id: '05-fog',
    title: 'Niebla / exploración en era 3: siluetas recordadas de edificios enemigos',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      g.setEra(3)
      // Marcar edificios enemigos como conocidos y luego cerrar la niebla:
      // quedan fuera de visión actual pero en memoria (explorados) => ghosts.
      g.reveal('player')
      g.state.visionRevealed.player = false
      g.fog()
      // Encuadrar la base enemiga en zona de memoria (no visible ahora).
      g.camera(55, 0, 54)
      return 'ok'
    })()`,
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
    title: 'Late game: era 4, base enemiga desarrollada, oleadas con intención y cruce de fuego activo',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      g.give(5000)
      g.setEra(4)
      // Economía enemiga con recursos para que su IA construya una base completa
      g.state.players.enemy.resources.suministros = 3500
      g.state.players.enemy.resources.materiales = 3500
      g.state.players.enemy.resources.combustible = 2500
      g.state.players.enemy.resources.minerales = 2500
      // base propia desarrollada
      g.build('player', 'vivienda', -46, -8, true)
      g.build('player', 'vivienda', -46, 8, true)
      g.build('player', 'vivienda', -46, -16, true)
      g.build('player', 'vivienda', -58, 0, true)
      g.build('player', 'cuartel', -52, -14, true)
      g.build('player', 'almacen', -52, 14, true)
      g.build('player', 'fabrica', -46, 16, true)
      g.build('player', 'torre', -44, 0, true)
      // Base enemiga COMPACTA y legible: producción + línea de torres alrededor del TC (55,0)
      g.build('enemy', 'cuartel', 45, 9, true)
      g.build('enemy', 'cuartel', 45, -9, true)
      g.build('enemy', 'fabrica', 58, 11, true)
      g.build('enemy', 'almacen', 58, -11, true)
      g.build('enemy', 'vivienda', 47, 17, true)
      g.build('enemy', 'vivienda', 47, -17, true)
      g.build('enemy', 'vivienda', 62, 0, true)
      g.build('enemy', 'torre', 41, 0, true)
      g.build('enemy', 'torre', 41, 14, true)
      g.build('enemy', 'torre', 49, -19, true)
      g.build('enemy', 'torre', 61, 15, true)
      // economía enemiga visible trabajando
      g.spawn('enemy', 'ingeniero', 6, 52, -6)
      g.spawn('enemy', 'ingeniero', 4, 54, -10)
      // defensores posicionados alrededor de la base enemiga
      g.spawn('enemy', 'milicia', 5, 45, -2)
      g.spawn('enemy', 'fusilero', 6, 46, 4)
      g.spawn('enemy', 'granadero', 3, 47, 1)
      g.spawn('enemy', 'milicia', 4, 48, -12)
      g.spawn('enemy', 'fusilero', 5, 53, -10)
      g.spawn('enemy', 'tanque', 3, 54, 6)
      g.spawn('enemy', 'canon', 3, 55, -2)
      // actividad de "producción": grupos recién salidos de cuartel/fábrica con intención clara
      const prodInf = []
      prodInf.push(...g.spawn('enemy', 'milicia', 5, 48, 15))
      prodInf.push(...g.spawn('enemy', 'fusilero', 5, 48, 13))
      prodInf.push(...g.spawn('enemy', 'granadero', 2, 48, 14))
      g.moveFormation(prodInf, 26, 10, 'line')
      const prodMech = []
      prodMech.push(...g.spawn('enemy', 'tanque', 3, 57, 11))
      prodMech.push(...g.spawn('enemy', 'canon', 2, 57, 9))
      g.moveFormation(prodMech, 22, 6, 'wedge')
      // oleada intermedia ya en ruta coordinada hacia el frente
      const routeWave = []
      routeWave.push(...g.spawn('enemy', 'milicia', 6, 16, -2))
      routeWave.push(...g.spawn('enemy', 'fusilero', 8, 18, 4))
      routeWave.push(...g.spawn('enemy', 'granadero', 3, 17, 1))
      routeWave.push(...g.spawn('enemy', 'tanque', 3, 20, 9))
      routeWave.push(...g.spawn('enemy', 'canon', 2, 21, 6))
      g.moveFormation(routeWave, -10, 3, 'line')
      // ejército propio con cruce de fuego activo
      g.spawn('player', 'milicia', 10, -38, -2)
      g.spawn('player', 'fusilero', 10, -38, 5)
      g.spawn('player', 'granadero', 4, -39, 2)
      g.spawn('player', 'tanque', 6, -38, 11)
      g.spawn('player', 'canon', 4, -40, 16)
      // oleada enemiga en contacto/ataque directo en el frente
      const frontWave = []
      frontWave.push(...g.spawn('enemy', 'milicia', 8, -12, -2))
      frontWave.push(...g.spawn('enemy', 'fusilero', 8, -10, 5))
      frontWave.push(...g.spawn('enemy', 'granadero', 3, -11, 2))
      frontWave.push(...g.spawn('enemy', 'tanque', 5, -8, 11))
      frontWave.push(...g.spawn('enemy', 'canon', 3, -6, 15))
      g.moveFormation(frontWave, -34, 7, 'line')
      g.reveal('player')

      // encuadre inicial: base enemiga + oleadas + frente
      g.camera(32, 2, 90)
      g.skip(5.5)
      // reencuadre dinámico: mantener visible base enemiga activa + ruta + choque
      let cx = 8, cz = 4, n = 0
      for (const e of g.state.entities.values()) {
        if (e.dead || e.kind !== 'unit') continue
        if (e.x < -30 || e.x > 42 || Math.abs(e.z - 6) > 32) continue
        cx += e.x; cz += e.z; n++
      }
      g.camera(48, 0, 76)

      // más tiempo de combate para bajas/huellas claras + pausa en momento activo
      g.skip(3.6)
      g.skip(0.2)
      g.state.status = 'paused'
      return 'ok'
    })()`,
    settleMs: 900,
  },
  // --- ciclo 02: niebla / formaciones / asedio -----------------------------
  {
    id: '06b-unidades',
    title: 'Unidades + barras de vida: milicias propias seleccionadas',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      g.camera(-42, 12, 48)
      // asegurar margen de población tras escenarios previos con muchas unidades
      g.build('player', 'vivienda', -60, 30, true)
      g.build('player', 'vivienda', -60, 34, true)
      let squad = g.spawn('player', 'milicia', 9, -45, 12) || []
      if (squad.length < 6) {
        const extra = g.spawn('player', 'milicia', 9 - squad.length, -47, 14) || []
        squad = squad.concat(extra)
      }
      g.skip(1)
      // fallback: seleccionar milicias/unidades propias existentes si el spawn fue limitado
      if (!squad || squad.length < 6) {
        const fallback = (typeof g.selectUnits === 'function') ? (g.selectUnits('player', 'milicia', 9) || []) : []
        if (fallback.length) squad = fallback
      }
      if (!squad || squad.length < 6) {
        const ids = []
        const iter = typeof g.state.entities.values === 'function' ? g.state.entities.values() : Object.values(g.state.entities)
        for (const e of iter) {
          if (e && !e.dead && e.kind === 'unit' && e.team === 'player') ids.push(e.id)
          if (ids.length >= 9) break
        }
        if (ids.length) squad = ids
      }
      g.select((squad || []).slice ? (squad || []).slice(0, 9) : (squad || []))
      const sel = g.state.selectedIds || []
      return sel.length >= 6 ? 'ok' : 'sel:' + sel.length
    })()`,
    settleMs: 700,
  },
  {
    id: '06c-formacion',
    title: 'Formación en filas por rol: infantería al frente, fusileros detrás, ingenieros al fondo',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      // Tope de población: sin viviendas el hook spawn() recorta el despliegue.
      for (let bi = 0; bi < 4; bi++) g.build('player', 'vivienda', -66, 2 + bi * 8, true)
      g.skip(0.05)
      g.setEra(3)
      const ids = []
      ids.push(...g.spawn('player', 'milicia', 6, -48, 2))
      ids.push(...g.spawn('player', 'fusilero', 5, -48, 7))
      ids.push(...g.spawn('player', 'ingeniero', 3, -48, 12))
      if (ids.length < 6) return 'spawn-only:' + ids.length
      g.select(ids)
      const n = g.moveFormation(ids, -30, 14, 'ranks')
      // Justo en tránsito: en cuanto llegan al destino la separación los dispersa y la
      // formación deja de leerse. El destino lejano garantiza que sigan marchando.
      g.skip(1)
      g.camera(-42, 6, 24)  // cerca: a distancia lejana las filas no se leen a este zoom
      g.state.status = 'paused'
      return n >= 6 ? 'ok' : 'moved:' + n + '/' + ids.length
    })()`,
    settleMs: 900,
  },
  {
    id: '08-asedio',
    title: 'Asedio intenso: cañones, trazadoras cruzadas, impactos y bajas persistentes sobre base defendida',
    js: `(() => {
      const g = window.__imperios
      g.state.status = 'playing' // reanudar el sim: el escenario previo pudo pausarlo para el still
      // Asegurar tope de población: el hook spawn() recorta al tope, así que sin viviendas
      // los escenarios de combate/economía no llegan a desplegar su fuerza.
      for (let bi = 0; bi < 6; bi++) { g.build('player', 'vivienda', -66, -26 + bi * 10, true); g.build('enemy', 'vivienda', 66, -26 + bi * 10, true) }
      g.skip(0.05)
      g.setEra(4)
      g.state.players.enemy.resources.suministros = 3500
      g.state.players.enemy.resources.materiales = 3500
      g.state.players.enemy.resources.combustible = 2500
      g.state.players.enemy.resources.minerales = 2500
      // base enemiga desarrollada, defendida y con actividad visible
      g.build('enemy', 'vivienda', 58, 10, true)
      g.build('enemy', 'vivienda', 58, -10, true)
      g.build('enemy', 'vivienda', 62, 0, true)
      g.build('enemy', 'vivienda', 62, -16, true)
      g.build('enemy', 'cuartel', 48, 18, true)
      g.build('enemy', 'almacen', 52, 14, true)
      g.build('enemy', 'fabrica', 60, -14, true)
      g.build('enemy', 'torre', 50, -6, true)
      g.build('enemy', 'torre', 50, 8, true)
      g.build('enemy', 'torre', 46, 2, true)
      g.build('enemy', 'torre', 54, 14, true)
      // defensores posicionados con fuego a distancia y artillería
      g.spawn('enemy', 'milicia', 7, 51, 2)
      g.spawn('enemy', 'fusilero', 8, 52, -4)
      g.spawn('enemy', 'granadero', 3, 51, -1)
      g.spawn('enemy', 'fusilero', 4, 49, 10)
      g.spawn('enemy', 'tanque', 4, 54, 7)
      g.spawn('enemy', 'canon', 3, 55, 4)
      // contraataque saliendo desde la base/cuartel (intención defensiva)
      const counter = []
      counter.push(...g.spawn('enemy', 'milicia', 5, 48, 16))
      counter.push(...g.spawn('enemy', 'fusilero', 4, 46, 15))
      counter.push(...g.spawn('enemy', 'granadero', 2, 47, 17))
      g.moveFormation(counter, 41, 7, 'line')
      // fuerza atacante con presión sostenida y artillería pesada
      g.spawn('player', 'tanque', 6, 39, 0)
      g.spawn('player', 'milicia', 10, 38, 6)
      g.spawn('player', 'canon', 5, 36, -4)
      g.spawn('player', 'fusilero', 9, 37, 10)
      g.spawn('player', 'granadero', 3, 38, 8)
      g.reveal('player')

      // dejar que el asedio se desarrolle y acumule bajas/huellas
      g.skip(5.0)
      // daño visible de asedio en curso (estructuras y tropas heridas, sin aniquilar todo)
      const iter = typeof g.state.entities.values === 'function' ? [...g.state.entities.values()] : Object.values(g.state.entities)
      for (const e of iter) {
        if (!e || e.dead) continue
        if (e.kind === 'building' && e.team === 'enemy' && e.x >= 44 && e.x <= 64 && e.z >= -18 && e.z <= 20) {
          if (e.btype === 'torre' || e.btype === 'almacen' || e.btype === 'vivienda') {
            e.hp = Math.max(1, Math.floor(e.maxHp * 0.42))
          } else if (e.btype === 'cuartel' || e.btype === 'fabrica') {
            e.hp = Math.max(1, Math.floor(e.maxHp * 0.58))
          }
        }
        if (e.kind === 'unit' && e.x >= 34 && e.x <= 56 && e.z >= -10 && e.z <= 20) {
          if (e.team === 'enemy' && (e.utype === 'milicia' || e.utype === 'fusilero' || e.utype === 'granadero')) {
            e.hp = Math.max(1, Math.floor(e.maxHp * 0.5))
          }
          if (e.team === 'player' && (e.utype === 'milicia' || e.utype === 'fusilero')) {
            e.hp = Math.max(1, Math.floor(e.maxHp * 0.65))
          }
        }
      }

      // centrar en el cruce de fuego activo (ambos bandos y base defendida)
      let cx = 0, cz = 0, n = 0
      for (const e of g.state.entities.values()) {
        if (e.dead || e.kind !== 'unit') continue
        if (e.x < 32 || e.x > 58 || e.z < -18 || e.z > 22) continue
        cx += e.x; cz += e.z; n++
      }
      if (n > 0) g.camera(cx / n, cz / n, 48)
      else g.camera(47, 2, 48)
      g.fog()

      // acumular más huellas y pausar en ráfaga reciente (trazadoras/impactos visibles)
      g.skip(3.2)
      g.skip(0.2)
      g.state.status = 'paused'
      return 'ok'
    })()`,
    settleMs: 900,
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
    // encuadrar el TC del jugador: 05-fog dejó la cámara sobre la base enemiga
    const e = g.state.entities && g.state.entities.get ? g.state.entities.get(${id}) : null
    if (e) g.camera(e.x, e.z, 55)
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
        const out = sc.js ? evalExpect(sc.js, 'ok', sc.id) : ''
        if (out) log(`    → ${short(out, 160)}`)
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
