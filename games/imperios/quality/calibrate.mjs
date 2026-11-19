#!/usr/bin/env node
/**
 * Imperios · calibración del instrumento (el juez de visión)
 * =========================================================
 *
 * El loop mide "qué tan cerca de AoE2" está el juego con un juez de visión que
 * mira PNGs. Antes de culpar al juego por no ser legible, hay que saber QUÉ
 * resuelve el instrumento. Este script genera una imagen de referencia con una
 * escalera de anchos de línea y de tamaños de texto al mismo tamaño que un frame
 * completo, y un recorte central nativo del mismo archivo.
 *
 * Con eso se mide, para el pipeline real:
 *   - el ancho de línea más fino que el juez resuelve en el frame completo
 *     (que el modelo de visión reescala) vs en el recorte nativo (sin reescalar);
 *   - el tamaño de texto mínimo legible en cada caso.
 *
 * No mide al juego: mide al juez. El resultado es el piso contra el que se
 * interpretan los veredictos de dim 2/10 ("no veo trazadoras" puede ser el
 * instrumento, no el juego).
 *
 * USO
 * ---
 *   node games/imperios/quality/calibrate.mjs
 *   # escribe: quality/calibration/line-ladder.png  y  line-ladder-zoom.png
 *
 * Requisitos: `agent-browser` en el PATH (o AGENT_BROWSER) y, para el recorte,
 * el mismo `sips` que usa capture.mjs (CAPTURE_CROP_TOOL).
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, 'calibration')
const BIN = process.env.AGENT_BROWSER || 'agent-browser'
const CROP_TOOL = process.env.CAPTURE_CROP_TOOL || 'sips'

// Mismas dimensiones que un frame completo del harness (escala 2× de 1280x577).
const W = Number(process.env.CAL_W ?? 2560)
const H = Number(process.env.CAL_H ?? 1154)
const CROP = Number(process.env.CAPTURE_ZOOM_CROP ?? 0.5)

const LINE_WIDTHS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]
const TEXT_SIZES = [6, 8, 10, 12, 14, 16, 20, 24, 32, 48]

function log(m) {
  process.stdout.write(`${m}\n`)
}

function run(args, { allowFail = false } = {}) {
  const res = spawnSync(BIN, args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 32 * 1024 * 1024 })
  if (res.error) throw new Error(`${BIN}: ${res.error.message}`)
  if (res.status !== 0 && !allowFail) {
    throw new Error(`Falló ${BIN} ${args[0]}\n${res.stderr || res.stdout}`)
  }
  return (res.stdout ?? '').trim()
}

function runTool(bin, args) {
  const res = spawnSync(bin, args, { encoding: 'utf8', timeout: 60_000 })
  return !res.error && res.status === 0
}

function pngSize(file) {
  const b = readFileSync(file)
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('no es PNG')
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

/**
 * HTML con canvas que dibuja la escalera. Fondo tostado como el terreno del
 * juego, líneas casi blancas: mide ancho+contraste a la vez, como los tracers.
 *
 * IMPORTANTE: la escalera va COMPACTA y CENTRADA (dentro del recorte central del
 * 50%), para que el frame completo y el recorte muestren exactamente los mismos
 * ítems: la única diferencia entre ambos es la resolución efectiva.
 */
function ladderHtml(w, h, widths, textSizes) {
  const barH = 180
  const lwStep = 100
  const tsStep = 110
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#7a5c34;overflow:hidden}
    canvas{display:block}
  </style></head><body><canvas id="c" width="${w}" height="${h}"></canvas>
  <script>
    const c=document.getElementById('c'),x=c.getContext('2d');
    x.fillStyle='#7a5c34';x.fillRect(0,0,${w},${h});
    const widths=${JSON.stringify(widths)};
    const ts=${JSON.stringify(textSizes)};
    const center=(n,step)=>(${w}-(n-1)*step)/2;
    // Título
    x.fillStyle='#1a1a1a';x.font='bold 30px monospace';
    x.fillText('CALIBRACIÓN DEL INSTRUMENTO · ¿qué es lo más fino que resolvés?', 40, 70);
    // Escalera de ANCHOS de línea (centrada)
    x.fillStyle='#1a1a1a';x.font='bold 26px monospace';
    x.textAlign='center';
    x.fillText('LÍNEAS: la más fina visible', ${Math.round(2560 / 2)}, 300);
    const barsY = 360, barH = ${barH};
    let bx = center(widths.length, ${lwStep});
    for(const lw of widths){
      x.fillStyle='#fff3c4';
      x.fillRect(bx-lw/2, barsY, lw, barH);
      x.fillStyle='#111';x.font='bold 20px monospace';
      x.fillText(lw+'px', bx, barsY+barH+28);
      bx+=${lwStep};
    }
    // Escalera de TEXTOS (centrada)
    x.fillStyle='#1a1a1a';x.font='bold 26px monospace';
    x.fillText('TEXTO "Ea8": el tamaño más chico legible', ${Math.round(2560 / 2)}, 660);
    let tx = center(ts.length, ${tsStep});
    for(const s of ts){
      x.fillStyle='#fff3c4';x.font='bold '+s+'px monospace';
      x.textBaseline='middle';
      x.fillText('Ea8', tx, 760);
      x.fillStyle='#111';x.font='bold 18px monospace';x.textBaseline='alphabetic';
      x.fillText(s+'px', tx, 812);
      tx+=${tsStep};
    }
    x.textAlign='left';
  </script></body></html>`
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const html = ladderHtml(W, H, LINE_WIDTHS, TEXT_SIZES)
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`

  log(`\nImperios · calibración del juez`)
  log(`  canvas ${W}x${H}  crop ${Math.round(CROP * 100)}%  bin ${BIN}`)

  run(['close', '--all'], { allowFail: true })
  run(['set', 'viewport', String(W), String(H)])
  run(['open', dataUrl])
  run(['wait', '500'], { allowFail: true })

  const full = join(OUT_DIR, 'line-ladder.png')
  run(['screenshot', full])
  log(`  ✓ ${full}`)

  const size = pngSize(full)
  const cw = Math.round(size.w * CROP)
  const ch = Math.round(size.h * CROP)
  const zoom = join(OUT_DIR, 'line-ladder-zoom.png')
  if (runTool(CROP_TOOL, ['-c', String(ch), String(cw), full, '--out', zoom])) {
    log(`  ✓ ${zoom}  (${cw}x${ch})`)
  } else {
    log(`  ! no pude recortar con "${CROP_TOOL}" (${zoom})`)
  }

  run(['close', '--all'], { allowFail: true })
  log(`
Ahora preguntale al juez (misma clase de modelo que puntúa el loop):
  en line-ladder.png      → ancho de línea más fino visible / texto mínimo legible
  en line-ladder-zoom.png → lo mismo, sobre el recorte nativo
La diferencia entre ambos es el costo de reescalado del frame completo.
`)
}

main()
