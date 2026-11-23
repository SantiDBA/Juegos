# Juez ciego · ciclo-66-cadaveres · 2026-11-23

**Capturas evaluadas:** shots/ciclo-66-cadaveres/ (7/7)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 4.0 | 02-arranque.png, 03-economia.png, 03b-nodos.png, 03c-nodo-agotado.png: no observable en esta sesión; las imágenes no pudieron ser inspeccionadas por la herramienta de visión disponible. |
| 2 | Combate / counters / proyectiles | 4.0 | 04-combate.png, 04-combate-zoom.png, 07-late-game.png, 08-asedio.png, 08-asedio-zoom.png: no observable en esta sesión; las imágenes no pudieron ser inspeccionadas por la herramienta de visión disponible. |
| 3 | Niebla / exploración | 4.0 | 05-fog.png: no observable en esta sesión; la imagen no pudo ser inspeccionada por la herramienta de visión disponible. |
| 4 | Pathfinding / formaciones | 4.0 | 04-combate.png, 06c-formacion.png, 06c-formacion-zoom.png, 07-late-game.png: no observable en esta sesión; las imágenes no pudieron ser inspeccionadas por la herramienta de visión disponible. |
| 5 | Tech tree / edades | 4.0 | 02-arranque.png, 05-fog.png, 07-late-game.png, 09-research.png, 09b-avance-era.png: no observable en esta sesión; las imágenes no pudieron ser inspeccionadas por la herramienta de visión disponible. |
| 6 | Contenido y densidad | 4.0 | 01-menu.png, 02-arranque.png, 07-late-game.png: no observable en esta sesión; las imágenes no pudieron ser inspeccionadas por la herramienta de visión disponible. |
| 7 | IA legítima | 4.0 | 04-combate.png, 07-late-game.png, 08-asedio.png: no observable en esta sesión; las imágenes no pudieron ser inspeccionadas por la herramienta de visión disponible. |
| 8 | HUD / UX AoE2 | 4.0 | 01-menu.png, 02-arranque.png, 03-economia.png, 06-ui.png, 06b-unidades.png: no observable en esta sesión; las imágenes no pudieron ser inspeccionadas por la herramienta de visión disponible. |
| 9 | Art direction / diorama isométrico | 4.0 | 01-menu.png, 02-arranque.png, 07-late-game.png: no observable en esta sesión; las imágenes no pudieron ser inspeccionadas por la herramienta de visión disponible. |
| 10 | Audio / juice | 3.0 | 04-combate.png, 04-combate-zoom.png, 07-late-game.png, 08-asedio.png: no observable en esta sesión; la ausencia no pudo verificarse ni descartarse por falta de acceso visual. |

**Promedio:** 3.90 · **Mínima:** 3.0 · **Dimensiones < 7:** 10

**Veredicto — SORPRENDIDO: NO**
No se pudo inspeccionar visualmente ninguna captura en esta sesión, por lo que no hay evidencia observable que sostenga sorpresa ni calidad AoE2.

## Top 7 brechas
1. Inspección visual bloqueada — 01-menu.png — impide evaluar primera impresión, identidad y jerarquía visual del jugador.
2. Inspección visual bloqueada — 02-arranque.png — impide confirmar escala inicial, HUD completo y densidad del mapa.
3. Inspección visual bloqueada — 03-economia.png / 03-economia-zoom.png — impide verificar ciclo económico, aldeanos, nodos y colas visibles.
4. Inspección visual bloqueada — 04-combate.png / 04-combate-zoom.png — impide evaluar proyectiles, impactos, bajas y legibilidad del combate.
5. Inspección visual bloqueada — 05-fog.png — impide juzgar niebla, estados explorado/visible y coherencia con minimapa.
6. Inspección visual bloqueada — 06-ui.png / 06b-unidades.png / 06c-formacion.png — impide verificar command card, selección, formación y UX de control.
7. Inspección visual bloqueada — 07-late-game.png / 08-asedio.png / 09-research.png / 09b-avance-era.png — impide evaluar escala tardía, asedio, progreso tecnológico y salto de era.

## 5 cambios para el próximo ciclo
1. Ejecutar el juicio con `games/imperios/quality/judge.sh ciclo-66-cadaveres <modelo>` en sesión headless aislada — Dimensiones 1-10 — permite que el juez vea cada PNG y emita evidencia real por captura.
2. Asegurar que el juez lea cada captura individualmente con una llamada de lectura y luego inspección visual por imagen — Dimensiones 1-10 — evita lecturas inválidas o binarias no visibles que invalidan el puntaje.
3. Conservar los recortes `-zoom.png` junto a los frames completos y hacerlos accesibles al juez — Dimensiones 2, 4, 10 — habilita verificación de proyectiles, líneas de formación y feedback fino.
4. Entregar el veredicto solo cuando cada imagen leída coincida con el archivo pedido — Dimensiones 1-10 — garantiza trazabilidad entre evidencia y archivo.
5. Mantener `quality/calibration/` fuera del contexto del juez y registrar cualquier fallo de lectura en notas — Dimensiones 1-10 — preserva la validez del juicio ciego y su auditabilidad.

## Riesgos / notas
- Las 15 capturas requeridas existen en `/Users/santiago/Github/Juegos/games/imperios/quality/shots/ciclo-66-cadaveres/`, pero ninguna pudo ser inspeccionada visualmente en esta sesión: la herramienta de visión no pudo acceder a la imagen adjunta por el flujo disponible.
- Por regla de ausencia/no observabilidad se aplicó techo ≤4 en dimensiones 1-9 y ≤3 en dimensión 10 (audio/juice). Estos puntajes no representan calidad visual observada; representan imposibilidad de verificación.
- No se leyó nada de `games/imperios/quality/calibration/`. No se consultó código, historial ni puntajes previos.
