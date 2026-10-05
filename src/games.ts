/**
 * Registro de juegos del menú.
 *
 * Una entrada por juego: para publicar uno nuevo alcanza con agregarlo acá y a
 * `vite.config.ts` (la entrada HTML del build). El menú no conoce ningún otro
 * detalle de cada juego.
 */
export interface Game {
  /** Nombre de la carpeta bajo `games/`: también es el id de la ruta. */
  id: string
  title: string
  tagline: string
  /** Colores de la tarjeta: fondo y acento. */
  colors: { from: string; to: string; accent: string }
  /** Emoji o glifo grande de la portada. */
  glyph: string
  /** Etiquetas cortas de abajo. */
  tags: string[]
  /** Estado: jugable, en construcción, etc. */
  status: 'ready' | 'wip'
  /** Récords que el juego publica en `localStorage` bajo esta clave. */
  bestKey?: string
  /**
   * Cómo se formatea el récord en la tarjeta. Por defecto es un tiempo en
   * segundos; `score` lo muestra como puntaje entero.
   */
  bestFormat?: 'time' | 'score'
}

export const GAMES: Game[] = [
  {
    id: 'coho',
    title: 'coho',
    tagline: 'Juntá todos los orbes antes de que se te acabe el tiempo.',
    colors: { from: '#0f3b3a', to: '#0b0d12', accent: '#57e0c8' },
    glyph: '◍',
    tags: ['primera persona', 'contrarreloj', 'sigilo'],
    status: 'ready',
    bestKey: 'coho.bestTime.enemies',
  },
  {
    id: 'pacman3d',
    title: 'pacman3d',
    tagline: 'Juntá todos los puntos del laberinto sin que te agarren.',
    colors: { from: '#2b1a5e', to: '#05060d', accent: '#ffd400' },
    glyph: '●',
    tags: ['laberinto', 'arcade', 'fantasmas'],
    status: 'ready',
    bestKey: 'pacman3d.bestScore',
    bestFormat: 'score',
  },
  {
    id: 'blockblast',
    title: 'blockblast',
    tagline: 'Completá una fila o columna entera. El color no importa.',
    colors: { from: '#1e4a6b', to: '#0e1018', accent: '#7fd4ff' },
    glyph: '▦',
    tags: ['puzzle', 'líneas', 'planificar'],
    status: 'ready',
    bestKey: 'blockblast.bestScore',
    bestFormat: 'score',
  },
]