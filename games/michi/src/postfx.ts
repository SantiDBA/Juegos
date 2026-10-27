import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { TUNING } from './config'

/**
 * Cadena de post-proceso: escena + bloom + salida a pantalla.
 *
 * El umbral es alto a propósito: sólo florecen los elementos emisivos (la
 * flecha guía, los iconos, las chispas) y no las paredes iluminadas. Si el
 * dispositivo no soporta los targets de float, el constructor tira y `main.ts`
 * cae al render directo.
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

  render(dt: number): void {
    this.composer.render(dt)
  }

  dispose(): void {
    this.composer.dispose()
    this.bloom.dispose()
  }
}
