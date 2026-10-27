/**
 * Tests de la física pura. Se corren con node contra el TS, sin build.
 *
 * Uso: node --experimental-strip-types test/physics.test.ts
 */
import * as THREE from 'three'
import {
  applyDrag,
  approach,
  box,
  clamp,
  insideGoal,
  plane,
  resolveSphereBoxes,
  resolveSpherePlanes,
  sphereVsBox,
  sphereVsSphere,
} from '../src/physics.ts'

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

// ---------------------------------------------------------------- básicos

console.log('\n== clamp y approach ==')
{
  near('clamp por arriba', clamp(5, -1, 3), 3)
  near('clamp por abajo', clamp(-5, -1, 3), -1)
  near('clamp dentro', clamp(2, -1, 3), 2)
  near('approach sube sin pasarse', approach(0, 10, 3), 3)
  near('approach llegó', approach(9, 10, 3), 10)
  near('approach baja sin pasarse', approach(0, -10, 4), -4)
}

console.log('\n== caja ==')
{
  const b = box(1, 2, 3, 2, 4, 6)
  check('min', b.min.x === 0 && b.min.y === 0 && b.min.z === 0, JSON.stringify(b.min))
  check('max', b.max.x === 2 && b.max.y === 4 && b.max.z === 6, JSON.stringify(b.max))
}

// ---------------------------------------------------------------- esfera-caja

console.log('\n== esfera-caja ==')
{
  const floor = box(0, -0.5, 0, 10, 1, 10) // y de -1 a 0
  const miss = sphereVsBox(new THREE.Vector3(0, 2, 0), 0.5, floor)
  check('sin contacto si está lejos', miss === null)

  const hit = sphereVsBox(new THREE.Vector3(0, 0.3, 0), 0.5, floor)
  check('hay contacto apoyada', hit !== null)
  near('normal hacia arriba', hit!.normal.y, 1)
  near('penetración', hit!.depth, 0.2, 1e-6)
}
{
  // Centro adentro: sale por la cara más cercana (acá, el techo de la caja).
  const b = box(0, 0, 0, 4, 2, 4)
  const hit = sphereVsBox(new THREE.Vector3(0, 0.4, 0), 0.3, b)
  check('contacto con el centro adentro', hit !== null)
  near('sale por arriba', hit!.normal.y, 1)
  // Faltan 0.6 hasta el techo de la caja, más el radio de la esfera.
  near('penetración centro-dentro', hit!.depth, 0.9, 1e-6)
}
{
  // Centro adentro y pegada a la cara -X: sale por ahí.
  const b = box(0, 0, 0, 4, 2, 4)
  const hit = sphereVsBox(new THREE.Vector3(-1.9, 0, 0), 0.2, b)
  check('sale por la cara más cercana', hit !== null)
  near('normal -X', hit!.normal.x, -1)
}

// ---------------------------------------------------------------- resolución

console.log('\n== resolveSphereBoxes ==')
{
  const floor = box(0, -0.5, 0, 10, 1, 10)
  const pos = new THREE.Vector3(0, 0.9, 0)
  const vel = new THREE.Vector3(0, -5, 0)
  const impact = resolveSphereBoxes(pos, vel, 0.9125, [floor], 0.6)
  near('saca la esfera de la caja', pos.y, 0.9125, 1e-6)
  // Rebote 60%: -5 -> +3
  near('refleja la normal con e=0.6', vel.y, 3, 1e-6)
  near('reporta el impacto', impact, 5, 1e-6)
}
{
  const floor = box(0, -0.5, 0, 10, 1, 10)
  const pos = new THREE.Vector3(0, 0.9, 0)
  const vel = new THREE.Vector3(4, -5, 0)
  resolveSphereBoxes(pos, vel, 0.9125, [floor], 0.6, 0)
  near('la tangencial se conserva', vel.x, 4, 1e-6)
  near('la normal se refleja', vel.y, 3, 1e-6)
}
{
  // Apoyada: velocidad normal ínfima, no debe rebotar (si no, vibra).
  const floor = box(0, -0.5, 0, 10, 1, 10)
  const pos = new THREE.Vector3(0, 0.9125, 0)
  const vel = new THREE.Vector3(0, -0.2, 0)
  resolveSphereBoxes(pos, vel, 0.9125, [floor], 0.6)
  near('sin micro-rebote al apoyarse', vel.y, 0, 1e-6)
}

// ---------------------------------------------------------------- masa

console.log('\n== choque por masas (auto 180 vs pelota 30) ==')
{
  const carPos = new THREE.Vector3(0, 0, 0)
  const carVel = new THREE.Vector3(10, 0, 0)
  const ballPos = new THREE.Vector3(1.4, 0, 0)
  const ballVel = new THREE.Vector3(0, 0, 0)

  const touched = sphereVsSphere(carPos, carVel, 0.62, 180, ballPos, ballVel, 0.9125, 30, 0.45)
  check('se tocan', touched)
  check('el balón sale disparado', ballVel.x > 10, `ballVel.x=${ballVel.x}`)
  check('el balón va más rápido que el auto', ballVel.x > carVel.x, `car=${carVel.x}`)
  check('el auto apenas se frena', carVel.x > 7 && carVel.x < 10, `carVel.x=${carVel.x}`)
  // Momento: 180*10 antes, igual después.
  near('el momento se conserva', 180 * carVel.x + 30 * ballVel.x, 1800, 1e-6)
}
{
  // Sin contacto si no se superponen.
  const a = new THREE.Vector3(0, 0, 0)
  const av = new THREE.Vector3(5, 0, 0)
  const b = new THREE.Vector3(5, 0, 0)
  const bv = new THREE.Vector3(0, 0, 0)
  const touched = sphereVsSphere(a, av, 0.6, 180, b, bv, 0.9, 30, 0.45)
  check('sin superposición no hay choque', !touched)
  near('nadie cambió de velocidad', av.x, 5)
}

// ---------------------------------------------------------------- rampa

console.log('\n== rampa al pie de la pared ==')
{
  // Rampa de la pared izquierda: sube desde x=-38.96 en el piso hasta la pared.
  const ramp = [plane(-38.96, 0, 0, 1, 1, 0)]

  const againstWall = new THREE.Vector3(-40.05, 0.9125, 0)
  const wallVel = new THREE.Vector3(0, 0, 0)
  resolveSpherePlanes(againstWall, wallVel, 0.9125, ramp, 0.6)
  check('la saca de la pared', againstWall.x > -40.05, `x=${againstWall.x}`)
  check('y la levanta sobre la rampa', againstWall.y > 0.9125, `y=${againstWall.y}`)

  // En medio de la cancha la rampa no debe tocar nada.
  const mid = new THREE.Vector3(-20, 0.9125, 0)
  const midBefore = mid.clone()
  resolveSpherePlanes(mid, new THREE.Vector3(), 0.9125, ramp, 0.6)
  near('en el medio no interviene (x)', mid.x, midBefore.x)
  near('en el medio no interviene (y)', mid.y, midBefore.y)

  // Arriba y lejos de la pared tampoco.
  const high = new THREE.Vector3(-40, 6, 0)
  const highBefore = high.clone()
  resolveSpherePlanes(high, new THREE.Vector3(), 0.9125, ramp, 0.6)
  near('a 6 de altura no interviene', high.y, highBefore.y)
}

// ---------------------------------------------------------------- arrastre

console.log('\n== arrastre ==')
{
  const vel = new THREE.Vector3(10, 0, 0)
  applyDrag(vel, 0.0306, 1)
  near('un segundo de arrastre', vel.x, 10 * Math.exp(-0.0306), 1e-9)
}
{
  const vel = new THREE.Vector3(10, 0, 0)
  // Vida media: ln2 / k segundos para caer a la mitad.
  applyDrag(vel, 0.0306, Math.LN2 / 0.0306)
  near('cae a la mitad en su vida media', vel.x, 5, 1e-6)
}

// ---------------------------------------------------------------- gol

console.log('\n== gol ==')
{
  const lineZ = 51.2
  const mouth = { halfWidth: 8.92755, height: 6.42775 }
  const inside = (x: number, y: number, z: number): boolean =>
    insideGoal(new THREE.Vector3(x, y, z), lineZ, 1, mouth.halfWidth, mouth.height, 0.9125)
  const blue = (x: number, y: number, z: number): boolean =>
    insideGoal(new THREE.Vector3(x, y, z), -lineZ, -1, mouth.halfWidth, mouth.height, 0.9125)

  check('adentro del arco', inside(0, 3, 55))
  check('todavía no cruzó del todo', !inside(0, 3, 51.5))
  check('afuera por el parante', !inside(10, 3, 55))
  check('por encima de la travesaña', !inside(0, 7, 55))
  check('justo al borde del parante entra', inside(8.5, 3, 55))

  // Arco azul, en z negativo: con el signo bien aplicado sólo dispara de su lado.
  check('arco azul', blue(0, 3, -55))
  check('el arco azul no dispara en el centro', !blue(0, 0.93, 0))
  check('el arco azul no dispara en el otro arco', !blue(0, 3, 55))
  check('el arco naranja no dispara en el centro', !inside(0, 0.93, 0))
  check('el arco naranja no dispara en el otro arco', !inside(0, 3, -55))
}

console.log(`\n${passed} pasaron, ${failed} fallaron`)
if (failed > 0) {
  console.log('\nFallos:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
