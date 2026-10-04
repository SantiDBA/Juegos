import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { TUNING } from './config'

/**
 * Cadena de post-proceso: render de escena + bloom + salida a pantalla.
 *
 * El bloom es lo que hace que los puntos y los fantasmas "acenten". El umbral
 * es bajo a propósito porque en este juego casi todo lo que brilla es un
 * elemento de juego: un umbral alto dejaría la escena plana y sin vida.
 *
 * Se puede desactivar si el dispositivo no da la talla; `main.ts` cae de vuelta
 * al render directo en ese caso.
 */
export class PostFX {
  readonly composer: EffectComposer
  readonly bloom: UnrealBloomPass

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    const size = renderer.getSize(new THREE.Vector2())
    this.bloom = new UnrealBloomPass(
      size,
      TUNING.bloomStrength,
      TUNING.bloomRadius,
      TUNING.bloomThreshold,
    )
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(width, height)
  }

  /** El bloom se sube durante el modo asustado para que el cambio se note. */
  setBloomStrength(strength: number): void {
    this.bloom.strength = strength
  }

  render(dt: number): void {
    this.composer.render(dt)
  }

  dispose(): void {
    this.composer.dispose()
    this.bloom.dispose()
  }
}