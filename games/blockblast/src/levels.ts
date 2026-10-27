/**
 * Definición de niveles.
 *
 * El tablero arranca VACÍO en cada nivel. Es lo que hace `1010!`: sin bloques
 * de salida no hay forma de "colocar en cualquier lado", hay que elegir dónde
 * poner cada pieza pensando en la línea que querés armar.
 */

/** Puntos necesarios para completar el nivel. */
export function targetForLevel(level: number): number {
  // Crecimiento ~1.2 por nivel. Con 1.35 la meta se disparaba: el nivel 10 pedía
  // ~4.100 puntos y el 20, ~700.000, así que la progresión dejaba de sentirse y
  // se volvía una espera. Más plano, cada nivel sigue siendo un escalón real.
  return Math.round(300 * Math.pow(1.2, level - 1))
}