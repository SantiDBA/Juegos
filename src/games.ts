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
  {
    id: 'rocket',
    title: 'rocket',
    tagline: 'Mete la pelota en el arco rival. Boost, saltá y volá.',
    colors: { from: '#1d3fae', to: '#0a0d18', accent: '#ff8a3d' },
    glyph: '⚽',
    tags: ['soccar', '3d', 'autos'],
    status: 'ready',
    bestKey: 'rocket.bestGoals',
    bestFormat: 'score',
  },
  {
    id: 'michi',
    title: 'michi',
    tagline: 'Cuidá a tu gato sin final: comé, bañate, jugá, dormí y pasá por el arenero.',
    colors: { from: '#5a3320', to: '#0e0b09', accent: '#ffb45c' },
    glyph: '🐱',
    tags: ['3d', 'simulación', 'sin final'],
    status: 'ready',
    bestKey: 'michi.bestCares',
    bestFormat: 'score',
  },
  {
    id: 'unicornio',
    title: 'unicornio',
    tagline: 'Encontrá el castillo escondido en el campo. Explorá bosques y montañas.',
    colors: { from: '#3a1f5e', to: '#0e0b18', accent: '#ff7ad9' },
    glyph: '🦄',
    tags: ['3d', 'exploración', 'aventura'],
    status: 'ready',
    bestKey: 'unicornio.bestTime',
  },
  {
    id: 'commandcode-of-duty',
    title: 'CommandCode of Duty',
    tagline: 'FPS táctico en primera persona. Eliminá a los enemigos y completá el objetivo.',
    colors: { from: '#1a1a1a', to: '#0a0a0a', accent: '#ff3333' },
    glyph: '🎯',
    tags: ['3d', 'fps', 'shooter'],
    status: 'ready',
    bestKey: 'commandcode-of-duty.bestScore',
    bestFormat: 'score',
  },
  {
    id: 'imperios',
    title: 'Imperios 1800-2100',
    tagline: 'RTS inspirado en AoE II: recolectá, construí, avanzá de era y conquistá del vapor a la era autónoma.',
    colors: { from: '#3a2a18', to: '#0b0e14', accent: '#d4a64a' },
    glyph: '⚙',
    tags: ['3d', 'rts', 'estrategia'],
    status: 'wip',
  },
]