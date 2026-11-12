import * as THREE from 'three'
import { TUNING } from './config'
import { createTerrainMaterial } from './terrainShader'

export interface Box { min: THREE.Vector3; max: THREE.Vector3 }

export interface World {
  terrain: THREE.Mesh
  heightAt: (x: number, z: number) => number
  trees: THREE.Group
  treePositions: THREE.Vector3[]
  grass: THREE.Group
  castle: THREE.Group
  castlePos: THREE.Vector3
  spawn: THREE.Vector3
  colliders: Box[]
  dispose: () => void
}

// Terreno: combinación de senos para dar montañas y valles sin Perlin.
function heightFn(x: number, z: number): number {
  const s = TUNING.worldSize
  // Borde: subir hacia los bordes para simular montañas en los límites.
  const nx = x / s
  const nz = z / s
  const edge = Math.max(Math.abs(nx), Math.abs(nz))
  const edgeH = Math.pow(edge, 2.2) * TUNING.terrainHeight * 0.9

  const h =
    Math.sin(x * 0.025) * 4 +
    Math.cos(z * 0.031) * 3.5 +
    Math.sin((x + z) * 0.018) * 5 +
    Math.cos((x - z) * 0.022) * 3 +
    Math.sin(x * 0.07) * 1.2 +
    Math.cos(z * 0.06) * 1.2

  let height = h + edgeH
  // Valle central un poco más bajo para que el campo sea jugable.
  height -= Math.exp(-(nx * nx + nz * nz) * 3) * 4
  if (height < 0) height = 0
  return height
}

export function buildWorld(scene: THREE.Scene, seed: number): World {
  const colliders: Box[] = []
  const rng = mulberry32(seed)

  // --- Terreno simple con vertex colors (funciona seguro)
  const seg = TUNING.terrainSegments
  const size = TUNING.worldSize
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, heightFn(x, z))
  }
  geo.computeVertexNormals()

  // Colorear por altura
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const t = Math.min(1, y / TUNING.terrainHeight)
    let r, g, b
    if (t < 0.35) { r = 0.18 + t * 0.4; g = 0.45 + t * 0.3; b = 0.16 + t * 0.2 }
    else if (t < 0.7) { const u = (t - 0.35) / 0.35; r = 0.35 + u * 0.3; g = 0.38 + u * 0.15; b = 0.28 + u * 0.15 }
    else { const u = (t - 0.7) / 0.3; r = 0.65 + u * 0.3; g = 0.65 + u * 0.3; b = 0.7 + u * 0.25 }
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const sunDir = new THREE.Vector3(0.3, 0.7, 0.4).normalize()
  const terrainMat = createTerrainMaterial({
    uColorGrass: new THREE.Color(0x2f7a3a),
    uColorDirt: new THREE.Color(0x6b4a2a),
    uColorRock: new THREE.Color(0x7a7a7a),
    uColorSnow: new THREE.Color(0xf0f4fa),
    uWorldSize: TUNING.worldSize,
    uTerrainHeight: TUNING.terrainHeight,
    uSunDirection: sunDir,
  })
  const terrain = new THREE.Mesh(geo, terrainMat)
  terrain.receiveShadow = true
  scene.add(terrain)

  const heightAt = (x: number, z: number): number => heightFn(x, z)

  // --- Árboles: InstancedMesh para rendimiento + variación por instancia
  // Geometrías base (tronco + copa baja)
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 1 })
  // Copa: cone + sphere blend (low poly but nice)
  const leafGeo = new THREE.ConeGeometry(1.6, 3.2, 7)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f5e2e, roughness: 0.9, flatShading: true })

  // Combinar tronco + copa en una geometría para 1 draw call por árbol
  // Pero es más simple: 2 InstancedMesh (trunks + leaves)
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, TUNING.treeCount)
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, TUNING.treeCount)
  trunkMesh.castShadow = true
  trunkMesh.receiveShadow = true
  leafMesh.castShadow = true
  leafMesh.receiveShadow = true
  // No añadir a scene aún; lo haremos via el group

  const treePositions: THREE.Vector3[] = []
  const dummy = new THREE.Object3D()
  const half = size / 2 - 8
  let placed = 0
  let attempts = 0
  while (placed < TUNING.treeCount && attempts < TUNING.treeCount * 8) {
    attempts++
    const x = (rng() * 2 - 1) * half
    const z = (rng() * 2 - 1) * half
    const h = heightFn(x, z)
    if (h > TUNING.terrainHeight * 0.55) continue
    const eps = 0.5
    const sx = (heightFn(x + eps, z) - heightFn(x - eps, z)) / (2 * eps)
    const sz = (heightFn(x, z + eps) - heightFn(x, z - eps)) / (2 * eps)
    if (Math.hypot(sx, sz) > 0.6) continue

    const sc = 0.7 + rng() * 0.7
    const ry = rng() * Math.PI * 2

    dummy.position.set(x, h, z)
    dummy.scale.setScalar(sc)
    dummy.rotation.y = ry
    dummy.updateMatrix()

    trunkMesh.setMatrixAt(placed, dummy.matrix)
    leafMesh.setMatrixAt(placed, dummy.matrix)

    // Ajustar copa arriba del tronco
    const leafMatrix = dummy.matrix.clone()
    leafMatrix.setPosition(x, h + 2.2 * sc, z)
    leafMesh.setMatrixAt(placed, leafMatrix)

    treePositions.push(new THREE.Vector3(x, h, z))

    colliders.push({
      min: new THREE.Vector3(x - 0.6 * sc, h, z - 0.6 * sc),
      max: new THREE.Vector3(x + 0.6 * sc, h + 4.5 * sc, z + 0.6 * sc),
    })
    placed++
  }
  // Escalar a 0 las instancias no usadas para que no aparezcan en (0,0,0)
  const zeroScale = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = placed; i < TUNING.treeCount; i++) {
    trunkMesh.setMatrixAt(i, zeroScale)
    leafMesh.setMatrixAt(i, zeroScale)
  }
  trunkMesh.instanceMatrix.needsUpdate = true
  leafMesh.instanceMatrix.needsUpdate = true

  // Wrapper group
  const trees = new THREE.Group()
  trees.add(trunkMesh)
  trees.add(leafMesh)
  scene.add(trees)

  // --- Hierba instanciada
  const grassCount = 6000
  const grassGeo = new THREE.PlaneGeometry(0.12, 0.55)
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x3a8a3a,
    roughness: 0.9,
    side: THREE.DoubleSide,
    alphaTest: 0.5,
  })
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount)
  grassMesh.castShadow = false
  grassMesh.receiveShadow = false
  const grassDummy = new THREE.Object3D()
  let gPlaced = 0
  let gAttempts = 0
  while (gPlaced < grassCount && gAttempts < grassCount * 6) {
    gAttempts++
    const x = (rng() * 2 - 1) * half
    const z = (rng() * 2 - 1) * half
    const h = heightFn(x, z)
    if (h > TUNING.terrainHeight * 0.45) continue
    const eps = 0.5
    const sx = (heightFn(x + eps, z) - heightFn(x - eps, z)) / (2 * eps)
    const sz = (heightFn(x, z + eps) - heightFn(x, z - eps)) / (2 * eps)
    if (Math.hypot(sx, sz) > 0.5) continue
    const sc = 0.7 + rng() * 0.6
    grassDummy.position.set(x, h + 0.27 * sc, z)
    grassDummy.scale.setScalar(sc)
    grassDummy.rotation.y = rng() * Math.PI * 2
    grassDummy.updateMatrix()
    grassMesh.setMatrixAt(gPlaced, grassDummy.matrix)
    gPlaced++
  }
  const zeroScaleG = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = gPlaced; i < grassCount; i++) grassMesh.setMatrixAt(i, zeroScaleG)
  grassMesh.instanceMatrix.needsUpdate = true
  const grass = new THREE.Group()
  grass.add(grassMesh)
  scene.add(grass)

  // --- Castillo mejorado: modular con almenas, ventanas, interior básico
  const castleAngle = seed * 0.7 + 1.2
  const castleDist = size * 0.38
  const castleX = Math.cos(castleAngle) * castleDist
  const castleZ = Math.sin(castleAngle) * castleDist
  const castleY = heightFn(castleX, castleZ)

  const castle = new THREE.Group()
  scene.add(castle)
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8f9a, roughness: 0.8, metalness: 0.1 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.85 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.7, metalness: 0.1 })
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.2, metalness: 0.8, emissive: 0x2a2a4a, emissiveIntensity: 0.3 })
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })

  const wallH = 6
  const wallT = 1
  const w = 14
  const gate = 4
  const sideW = (w - gate) / 2

  // Muros con textura de piedra (usamos BoxGeometry pero con UVs para triplanar en shader sería mejor; por ahora standard)
  // Norte
  const wallGeo = new THREE.BoxGeometry(w, wallH, wallT)
  const m1 = new THREE.Mesh(wallGeo, stoneMat); m1.position.set(0, wallH / 2, -w / 2); m1.castShadow = true; castle.add(m1)
  // Sur: dos segmentos con puerta
  const sideGeo = new THREE.BoxGeometry(sideW, wallH, wallT)
  const m2a = new THREE.Mesh(sideGeo, stoneMat); m2a.position.set(- (gate + sideW) / 2, wallH / 2, w / 2); m2a.castShadow = true; castle.add(m2a)
  const m2b = new THREE.Mesh(sideGeo, stoneMat); m2b.position.set((gate + sideW) / 2, wallH / 2, w / 2); m2b.castShadow = true; castle.add(m2b)
  // Este / Oeste
  const wallGeoV = new THREE.BoxGeometry(wallT, wallH, w)
  const m3 = new THREE.Mesh(wallGeoV, stoneMat); m3.position.set(-w / 2, wallH / 2, 0); m3.castShadow = true; castle.add(m3)
  const m4 = new THREE.Mesh(wallGeoV, stoneMat); m4.position.set(w / 2, wallH / 2, 0); m4.castShadow = true; castle.add(m4)

  // Almenas en todos los muros (crenelations)
  const merlonW = 0.8, merlonH = 1.0, merlonD = 0.8
  const merlonGeo = new THREE.BoxGeometry(merlonW, merlonH, merlonD)
  const gap = 1.6
  for (let side = 0; side < 4; side++) {
    const isHorizontal = side < 2 // 0=N, 1=S, 2=E, 3=W
    const len = isHorizontal ? w : w
    const count = Math.floor(len / gap)
    for (let i = 0; i < count; i++) {
      const offset = -len / 2 + gap / 2 + i * gap
      const m = new THREE.Mesh(merlonGeo, darkMat); m.castShadow = true
      if (side === 0) m.position.set(offset, wallH + merlonH / 2, -w / 2) // Norte
      else if (side === 1) {
        // Sur: saltar la puerta
        if (offset > -gate/2 && offset < gate/2) continue
        m.position.set(offset, wallH + merlonH / 2, w / 2)
      } else if (side === 2) m.position.set(w / 2, wallH + merlonH / 2, offset) // Este
      else m.position.set(-w / 2, wallH + merlonH / 2, offset) // Oeste
      castle.add(m)
    }
  }

  // Ventanas estrechas (saeteras) en muros
  const windowGeo = new THREE.BoxGeometry(0.3, 1.2, wallT + 0.2)
  const winY = [2.0, 4.0]
  for (const y of winY) {
    // Norte
    const wn1 = new THREE.Mesh(windowGeo, windowMat); wn1.position.set(-2.5, y, -w/2 + 0.05); castle.add(wn1)
    const wn2 = new THREE.Mesh(windowGeo, windowMat); wn2.position.set(2.5, y, -w/2 + 0.05); castle.add(wn2)
    // Este
    const we1 = new THREE.Mesh(windowGeo, windowMat); we1.position.set(w/2 - 0.05, y, -2.5); we1.rotation.y = Math.PI/2; castle.add(we1)
    const we2 = new THREE.Mesh(windowGeo, windowMat); we2.position.set(w/2 - 0.05, y, 2.5); we2.rotation.y = Math.PI/2; castle.add(we2)
    // Oeste
    const ww1 = new THREE.Mesh(windowGeo, windowMat); ww1.position.set(-w/2 + 0.05, y, -2.5); ww1.rotation.y = -Math.PI/2; castle.add(ww1)
    const ww2 = new THREE.Mesh(windowGeo, windowMat); ww2.position.set(-w/2 + 0.05, y, 2.5); ww2.rotation.y = -Math.PI/2; castle.add(ww2)
  }

  // Torres en esquinas (más altas, con techo cónico)
  const towerGeo = new THREE.CylinderGeometry(1.8, 2.2, wallH + 4, 8)
  const towerRoofGeo = new THREE.ConeGeometry(2.6, 3, 8)
  const corners = [[-w / 2, -w / 2], [w / 2, -w / 2], [-w / 2, w / 2], [w / 2, w / 2]]
  for (const [cx, cz] of corners) {
    const t = new THREE.Mesh(towerGeo, darkMat)
    t.position.set(cx, (wallH + 4) / 2, cz)
    t.castShadow = true
    castle.add(t)
    const r = new THREE.Mesh(towerRoofGeo, roofMat)
    r.position.set(cx, wallH + 4 + 1.5, cz)
    r.castShadow = true
    castle.add(r)
    // Almenas en torre
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const mx = cx + Math.cos(a) * 2.0
      const mz = cz + Math.sin(a) * 2.0
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), darkMat)
      m.position.set(mx, wallH + 4.4, mz)
      m.castShadow = true
      castle.add(m)
    }
    colliders.push({
      min: new THREE.Vector3(castleX + cx - 2.2, castleY, castleZ + cz - 2.2),
      max: new THREE.Vector3(castleX + cx + 2.2, castleY + wallH + 7, castleZ + cz + 2.2),
    })
  }

  // Puerta: arco con dintel y jambas decorativas
  const lintelGeo = new THREE.BoxGeometry(gate, 0.6, wallT + 0.2)
  const lintel = new THREE.Mesh(lintelGeo, darkMat)
  lintel.position.set(0, 4.2, w / 2)
  lintel.castShadow = true
  castle.add(lintel)
  const jambGeo = new THREE.BoxGeometry(0.5, 4, wallT + 0.2)
  const jambL = new THREE.Mesh(jambGeo, darkMat); jambL.position.set(-gate/2, 2, w / 2); jambL.castShadow = true; castle.add(jambL)
  const jambR = new THREE.Mesh(jambGeo, darkMat); jambR.position.set(gate/2, 2, w / 2); jambR.castShadow = true; castle.add(jambR)

  // Suelo interior (para que se vea al entrar)
  const floorGeo = new THREE.PlaneGeometry(w - 2, w - 2)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.01, 0)
  floor.receiveShadow = true
  castle.add(floor)

  // Columna central decorativa
  const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, wallH - 1, 8)
  const pillar = new THREE.Mesh(pillarGeo, stoneMat)
  pillar.position.set(0, (wallH - 1) / 2, 0)
  pillar.castShadow = true
  castle.add(pillar)

  // Antorcha interior (mango + llama emisiva + luz)
  const torchMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff6a1a, emissiveIntensity: 2.0, roughness: 0.3 })
  const torchHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), torchMat)
  torchHandle.position.set(-3, 0.8, -3)
  torchHandle.castShadow = true
  castle.add(torchHandle)
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), flameMat)
  flame.position.set(-3, 1.75, -3)
  castle.add(flame)
  const torchLight = new THREE.PointLight(0xff7a2a, 2.5, 12, 2)
  torchLight.position.set(-3, 1.75, -3)
  torchLight.castShadow = false
  castle.add(torchLight)

  // Muros colliders (sin rotación del castillo)
  const wallHh = wallH
  const t = 1.0
  // Norte
  colliders.push({ min: new THREE.Vector3(castleX - w/2, castleY, castleZ - w/2 - t/2), max: new THREE.Vector3(castleX + w/2, castleY + wallHh, castleZ - w/2 + t/2) })
  // Sur: dos segmentos con hueco central (puerta)
  colliders.push({ min: new THREE.Vector3(castleX - w/2, castleY, castleZ + w/2 - t/2), max: new THREE.Vector3(castleX - gate/2, castleY + wallHh, castleZ + w/2 + t/2) })
  colliders.push({ min: new THREE.Vector3(castleX + gate/2, castleY, castleZ + w/2 - t/2), max: new THREE.Vector3(castleX + w/2, castleY + wallHh, castleZ + w/2 + t/2) })
  // Este
  colliders.push({ min: new THREE.Vector3(castleX + w/2 - t/2, castleY, castleZ - w/2), max: new THREE.Vector3(castleX + w/2 + t/2, castleY + wallHh, castleZ + w/2) })
  // Oeste
  colliders.push({ min: new THREE.Vector3(castleX - w/2 - t/2, castleY, castleZ - w/2), max: new THREE.Vector3(castleX - w/2 + t/2, castleY + wallHh, castleZ + w/2) })

  castle.position.set(castleX, castleY, castleZ)
  // Sin rotación para que colliders y visual coincidan (la puerta queda al sur fijo).

  // --- Spawn: centro del campo, en el valle
  const spawn = new THREE.Vector3(0, heightFn(0, 0) + 2, 0)

  const dispose = (): void => {
    scene.remove(terrain)
    scene.remove(trees)
    scene.remove(grass)
    scene.remove(castle)
    geo.dispose()
    if (terrainMat.uniforms && terrainMat.uniforms.uDetailNormal) {
      terrainMat.uniforms.uDetailNormal.value.dispose()
    }
    terrainMat.dispose()
    trunkGeo.dispose(); trunkMat.dispose()
    leafGeo.dispose(); leafMat.dispose()
    grassGeo.dispose(); grassMat.dispose()
    // castle geoms/mats
    wallGeo.dispose(); wallGeoV.dispose()
    sideGeo.dispose(); merlonGeo.dispose()
    windowGeo.dispose()
    towerGeo.dispose(); towerRoofGeo.dispose()
    lintelGeo.dispose(); jambGeo.dispose()
    floorGeo.dispose(); floorMat.dispose()
    pillarGeo.dispose()
    torchHandle.geometry.dispose(); torchMat.dispose(); flame.geometry.dispose(); flameMat.dispose()
    stoneMat.dispose(); darkMat.dispose(); roofMat.dispose(); windowMat.dispose(); woodMat.dispose()
  }

  return {
    terrain, heightAt, trees, treePositions, grass, castle, castlePos: new THREE.Vector3(castleX, castleY, castleZ),
    spawn, colliders, dispose,
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}