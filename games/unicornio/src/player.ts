import * as THREE from 'three'
import { TUNING } from './config'
import type { Box } from './world'

export class PlayerController {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  yaw = 0
  pitch = 0

  private colliders: Box[]
  private heightAt: (x: number, z: number) => number
  private wishDir = new THREE.Vector3()

  constructor(spawn: THREE.Vector3, colliders: Box[], heightAt: (x: number, z: number) => number) {
    this.colliders = colliders
    this.heightAt = heightAt
    this.position.copy(spawn)
  }

  reset(spawn: THREE.Vector3): void {
    this.position.copy(spawn)
    this.velocity.set(0, 0, 0)
    this.yaw = 0
    this.pitch = 0
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * TUNING.mouseSensitivity
    this.pitch -= dy * TUNING.mouseSensitivity
    const limit = Math.PI / 2 - 0.05
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch))
  }

  forwardVector(out: THREE.Vector3): THREE.Vector3 {
    return out.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    )
  }

  update(input: { forward: number; strafe: number; run: boolean }, dt: number): void {
    const speed = (input.run ? TUNING.runSpeed : TUNING.walkSpeed)
    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    const targetX = -sin * input.forward + cos * input.strafe
    const targetZ = -cos * input.forward - sin * input.strafe
    const len = Math.hypot(targetX, targetZ)

    if (len > 0.0001) {
      this.wishDir.set((targetX / len) * speed, 0, (targetZ / len) * speed)
    } else {
      this.wishDir.set(0, 0, 0)
    }

    const a = TUNING.accel * dt
    this.velocity.x = approach(this.velocity.x, this.wishDir.x, a)
    this.velocity.z = approach(this.velocity.z, this.wishDir.z, a)

    if (len < 0.0001) {
      const f = Math.max(0, 1 - TUNING.friction * dt)
      this.velocity.x *= f
      this.velocity.z *= f
    }

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt

    // colisiones horizontales con colliders
    const r = TUNING.playerRadius
    for (const b of this.colliders) {
      if (this.position.y + TUNING.playerHeight <= b.min.y) continue
      if (this.position.y >= b.max.y) continue
      const cx = clamp(this.position.x, b.min.x, b.max.x)
      const cz = clamp(this.position.z, b.min.z, b.max.z)
      const dx = this.position.x - cx
      const dz = this.position.z - cz
      const distSq = dx * dx + dz * dz
      if (distSq >= r * r) continue
      if (distSq > 1e-8) {
        const dist = Math.sqrt(distSq)
        const push = r - dist
        this.position.x += (dx / dist) * push
        this.position.z += (dz / dist) * push
      } else {
        this.position.x += r
      }
    }

    // límites del mundo
    const half = TUNING.worldSize / 2 - 2
    this.position.x = clamp(this.position.x, -half, half)
    this.position.z = clamp(this.position.z, -half, half)

    // seguir terreno
    const gy = this.heightAt(this.position.x, this.position.z)
    this.position.y = gy + 0.05
  }
}

function approach(cur: number, target: number, maxDelta: number): number {
  if (cur < target) return Math.min(cur + maxDelta, target)
  if (cur > target) return Math.max(cur - maxDelta, target)
  return cur
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}