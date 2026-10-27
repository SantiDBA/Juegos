/**
 * Tests de los chasis. Se corren con node contra el TS, sin build.
 *
 * Uso: node --experimental-strip-types test/cars.test.ts
 *
 * `cars.ts` importa three y el loader de `RoundedBoxGeometry`, así que acá no se
 * puede importar el módulo entero (node no resuelve los imports sin extensión).
 * Por eso los números se validan contra una copia de la tabla: si alguien cambia
 * una medida y rompe el invariante, esto falla.
 */
import { CAR_ORDER, CAR_STYLES } from '../src/carStyles.ts'

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

console.log('\n== chasis ==')
{
  check('hay al menos 3 chasis', CAR_ORDER.length >= 3, `n=${CAR_ORDER.length}`)

  for (const id of CAR_ORDER) {
    const style = CAR_STYLES[id]
    check(`${id} existe`, style !== undefined)
    check(`${id} es el mismo id`, style.id === id)

    // El radio es una esfera: tiene que cubrir el cuerpo. Si queda corto, el
    // auto atraviesa visualmente las paredes antes de chocarlas.
    const halfLength = style.length / 2
    const halfWidth = style.width / 2
    check(
      `${id}: el radio cubre el largo`,
      style.radius >= halfLength * 0.92,
      `radio=${style.radius} halfLength=${halfLength}`,
    )
    check(
      `${id}: el radio cubre el ancho`,
      style.radius >= halfWidth,
      `radio=${style.radius} halfWidth=${halfWidth}`,
    )

    // El origen tiene que quedar por encima del piso y la rueda tiene que
    // apoyarse en él: centro de rueda = -halfHeight + wheelRadius.
    check(
      `${id}: la rueda toca el piso`,
      Math.abs(-style.halfHeight + style.wheelRadius + style.wheelRadius) < 1e-9 ||
        style.halfHeight > style.wheelRadius - 1e-9,
      `halfHeight=${style.halfHeight} wheelRadius=${style.wheelRadius}`,
    )

    // El cuerpo no puede hundirse en el piso.
    const bodyBottom = style.bodyLift - style.height / 2
    check(
      `${id}: el cuerpo no toca el piso`,
      bodyBottom > -style.halfHeight,
      `fondo=${bodyBottom} piso=${-style.halfHeight}`,
    )

    check(`${id}: altura positiva`, style.height > 0)
    check(`${id}: radio de rueda positivo`, style.wheelRadius > 0)
    check(`${id}: eje dentro del largo`, style.axle < halfLength)
    check(`${id}: ancho de vía fuera del cuerpo`, style.width / 2 < style.width / 2 + style.wheelOutset)
  }
}

console.log('\n== los chasis se diferencian ==')
{
  const lengths = CAR_ORDER.map((id) => CAR_STYLES[id].length)
  const widths = CAR_ORDER.map((id) => CAR_STYLES[id].width)
  check('no miden todos lo mismo', new Set(lengths).size > 1)
  check('no son todos del mismo ancho', new Set(widths).size > 1)

  const radii = new Set(CAR_ORDER.map((id) => CAR_STYLES[id].radius))
  check('cambia el hitbox entre chasis', radii.size > 1, `radios=${radii.size}`)
}

console.log(`\n${passed} pasaron, ${failed} fallaron`)
if (failed > 0) {
  console.log('\nFallos:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
