import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// El paquete es ESM, así que `__dirname` no existe: se deriva de la URL del
// propio archivo de configuración.
const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * Menú de juegos + cada juego como página aparte.
 *
 * Vite sirve una sola app con varias entradas HTML: el menú en `/` y cada
 * juego en `/games/<nombre>/`. Así un único dev server levanta todo y un
 * único build produce un sitio estático con todos los juegos.
 *
 * `base` es '/', no './': con varias páginas a distinta profundidad, rutas
 * relativas se rompen al navegar de un juego al menú.
 */
export default defineConfig({
  base: '/',
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      input: {
        // El menú.
        menu: `${root}index.html`,
        // Un juego por entrada. Al sumar uno nuevo, agregarlo acá.
        coho: `${root}games/coho/index.html`,
        pacman3d: `${root}games/pacman3d/index.html`,
      },
    },
  },
})