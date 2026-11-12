import * as THREE from 'three'

export function buildUnicorn(): THREE.Group {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ff, roughness: 0.6 })
  const maneMat = new THREE.MeshStandardMaterial({ color: 0xff7ad9, roughness: 0.7 })
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.6 })
  const hoofMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 })

  // Cuerpo
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.7), bodyMat)
  body.position.set(0, 1.1, 0)
  body.castShadow = true
  g.add(body)

  // Cuello
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 1.0, 8), bodyMat)
  neck.position.set(0.7, 1.7, 0)
  neck.rotation.z = -Math.PI / 2.2
  neck.castShadow = true
  g.add(neck)

  // Cabeza
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), bodyMat)
  head.position.set(1.35, 2.05, 0)
  head.castShadow = true
  g.add(head)

  // Hocico
  const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), bodyMat)
  muzzle.position.set(1.7, 1.95, 0)
  muzzle.rotation.z = -Math.PI / 2
  g.add(muzzle)

  // Cuerno
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 8), hornMat)
  horn.position.set(1.3, 2.45, 0)
  horn.rotation.z = -0.2
  horn.castShadow = true
  g.add(horn)

  // Orejas
  const earGeo = new THREE.ConeGeometry(0.08, 0.25, 4)
  const earL = new THREE.Mesh(earGeo, bodyMat); earL.position.set(1.2, 2.35, 0.22); earL.rotation.z = 0.3
  const earR = new THREE.Mesh(earGeo, bodyMat); earR.position.set(1.2, 2.35, -0.22); earR.rotation.z = 0.3
  g.add(earL, earR)

  // Crin (melena) a lo largo del cuello
  const mane = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.12), maneMat)
  mane.position.set(0.6, 2.1, 0)
  mane.rotation.z = -0.5
  g.add(mane)

  // Cola
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 0.9, 6), maneMat)
  tail.position.set(-0.9, 1.2, 0)
  tail.rotation.z = 0.6
  g.add(tail)

  // Patas
  const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.9, 6)
  const positions = [
    [0.5, 0.45, 0.25],
    [0.5, 0.45, -0.25],
    [-0.5, 0.45, 0.25],
    [-0.5, 0.45, -0.25],
  ] as const
  for (const [lx, ly, lz] of positions) {
    const leg = new THREE.Mesh(legGeo, bodyMat)
    leg.position.set(lx, ly, lz)
    leg.castShadow = true
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.12, 6), hoofMat)
    hoof.position.set(lx, 0.06, lz)
    g.add(leg, hoof)
  }

  // Ojos
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a })
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat); eyeL.position.set(1.55, 2.1, 0.22)
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat); eyeR.position.set(1.55, 2.1, -0.22)
  g.add(eyeL, eyeR)

  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true })

  return g
}