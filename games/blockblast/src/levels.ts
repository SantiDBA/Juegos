/**
 * Definición de niveles.
 *
 * El tablero arranca VACÍO en cada nivel. Es lo que hace `1010!`: sin bloques
 * de salida no hay forma de "colocar en cualquier lado", hay que elegir dónde
 * poner cada pieza pensando en la línea que querés armar. Sembrar el tablero
 * al principio hacía que las primeras piezas no tuvieran contexto.
 */

/** Puntos necesarios para completar el nivel. */
export function targetForLevel(level: number): number {
  // Crecimiento exponencial moderado, ~1.35 por nivel.
  return Math.round(300 * Math.pow(1.35, level - 1))
}

/** Semilla estable por nivel, para que el nivel sea siempre el mismo. */
export function seedForLevel(level: number): number {
  return (level * 2654435761) >>> 0
}