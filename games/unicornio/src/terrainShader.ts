import * as THREE from 'three'

// Shader de terreno "pro": triplanar + height blend + detail normals + splat por altura/pendiente
export const terrainVertexShader = /* glsl */`
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vElevation;
  varying float vSlope;

  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vUv = uv;
    vElevation = vWorldPos.y;
    // pendiente aprox desde normal
    vSlope = 1.0 - abs(vNormal.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const terrainFragmentShader = /* glsl */`
  uniform vec3 uColorGrass;
  uniform vec3 uColorDirt;
  uniform vec3 uColorRock;
  uniform vec3 uColorSnow;
  uniform float uWorldSize;
  uniform float uTerrainHeight;
  uniform sampler2D uDetailNormal;
  uniform float uTime;
  uniform vec3 uSunDirection;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vElevation;
  varying float vSlope;

  // Simple 2D noise para blend
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p); p *= 2.0; a *= 0.5;
    }
    return v;
  }

  vec3 heightBlend(vec3 a, vec3 b, float height, float transition, float noise) {
    float mask = smoothstep(-transition, transition, height + noise * 0.5);
    return mix(a, b, mask);
  }

  void main() {
    // Coords mundo escaladas
    vec2 worldXZ = vWorldPos.xz / uWorldSize * 8.0;
    float n = fbm(worldXZ * 2.0) * 0.5 + fbm(worldXZ * 8.0) * 0.25;

    // Altura normalizada 0..1
    float h = clamp(vElevation / uTerrainHeight, 0.0, 1.0);

    // Colores base por bioma (altura + pendiente)
    vec3 grass  = uColorGrass;
    vec3 dirt   = uColorDirt;
    vec3 rock   = uColorRock;
    vec3 snow   = uColorSnow;

    // Blend altura
    vec3 col = grass;
    float snowMask = smoothstep(0.78, 0.92, h);
    col = mix(col, snow, snowMask);
    float slopeFactor = smoothstep(0.55, 0.75, vSlope);
    col = mix(col, dirt, slopeFactor * 0.35);

    // Iluminación simple
    vec3 lightDir = normalize(uSunDirection);
    float NdotL = max(dot(vNormal, lightDir), 0.0);
    vec3 ambient = vec3(0.35, 0.38, 0.42);
    vec3 diffuse = col * NdotL * vec3(1.0, 0.95, 0.85) * 2.0;

    vec3 color = ambient + diffuse;

    // Niebla
    float fogFactor = smoothstep(60.0, 180.0, length(vWorldPos - vec3(0.0, 0.0, 0.0)));
    color = mix(color, vec3(0.75, 0.85, 0.95), fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`

// Material factory
export function createTerrainMaterial(uniforms: {
  uColorGrass: THREE.Color
  uColorDirt: THREE.Color
  uColorRock: THREE.Color
  uColorSnow: THREE.Color
  uWorldSize: number
  uTerrainHeight: number
  uSunDirection: THREE.Vector3
}): THREE.ShaderMaterial {
  // Generar noise procedural en canvas
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = img.data[i+1] = img.data[i+2] = v
    img.data[i+3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const proceduralNormal = new THREE.CanvasTexture(canvas)
  proceduralNormal.wrapS = proceduralNormal.wrapT = THREE.RepeatWrapping

  return new THREE.ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    uniforms: {
      uColorGrass: { value: uniforms.uColorGrass },
      uColorDirt: { value: uniforms.uColorDirt },
      uColorRock: { value: uniforms.uColorRock },
      uColorSnow: { value: uniforms.uColorSnow },
      uWorldSize: { value: uniforms.uWorldSize },
      uTerrainHeight: { value: uniforms.uTerrainHeight },
      uDetailNormal: { value: proceduralNormal },
      uTime: { value: 0 },
      uSunDirection: { value: uniforms.uSunDirection },
    },
  })
}