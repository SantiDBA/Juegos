# Juez ciego · ciclo-57-instrumento · 2026-11-19

**Capturas evaluadas:** shots/ciclo-57-instrumento/ (13 frames completos + 6 recortes de detalle)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: 12 ingenieros seleccionados con estado (7 "Lleva Suministros", 2 "Recolecta Suministros", 1 "Recolecta Materiales", 2 "Inactivo"), nodos con cifras (170, 131) y población 49/78; `03b-nodos.png` "Restante 68 · 30%". Pero `03c-nodo-agotado.png` no cambia el modelo del nodo y no hay líneas de tránsito legibles en el mapa. |
| 2 | Combate / counters / proyectiles | 6.0 | `04-combate-zoom.png`: 4 trazadoras blancas rectangulares, fogonazo blanco/amarillo con destellos estelares y mancha roja de daño; `06c-formacion-zoom.png` infantería con fusil, cañón con ruedas y blindado distinguibles con barras de vida. Sin muertes, humo ni cadáveres; `04-combate.png` (frame completo) no muestra combate. |
| 3 | Niebla / exploración | 6.0 | `05-fog.png`: degradado suave y zonas ocultas creíbles, pero sólo dos estados (oscuro / nítido) sin penumbra de "explorado"; el minimapa muestra el mapa completo con marcadores y no espeja la niebla. |
| 4 | Pathfinding / formaciones | 5.0 | `06c-formacion-zoom.png`: grupos en nube, sin filas/columna/cuña ni frente definido, orientaciones mezcladas; `06b-unidades-zoom.png` siluetas amontonadas con anillos solapados y solapamiento parcial; sólo `07-late-game.png` insinúa algunas filas. |
| 5 | Tech tree / edades | 8.0 | `02-arranque.png` "Era del Vapor" → `05-fog.png` "Era del Motor" → `07-late-game.png` "Era Autónoma · era máx. IV alcanzada"; `09-research.png` "Motor de Combustión · 13% · 40s"; `09b-avance-era.png` "Era del Acero · 39% · 28s"; command card con 5 techs y costos. |
| 6 | Contenido y densidad | 6.0 | `02-arranque.png`: disco iluminado con árboles etiquetados (225), pilas de roca, caminos en "Y" y Ayuntamiento con cúpula, pero todo rodeado de vacío negro y terreno marrón desnudo con arbustos repetidos. |
| 7 | IA legítima | 6.0 | `07-late-game.png`: base enemiga densa bajo anillos naranjas con flecha de ataque y infantería enemiga al norte; `06c-formacion.png` masa roja con picas orientada al jugador. No se ve economía enemiga, defensas ni composición de apoyo. |
| 8 | HUD / UX AoE2 | 8.0 | `06-ui.png`: top bar (4 recursos con íconos, población, era, tiempo), command card con acciones y costos, panel "Ayuntamiento · 2200/2200 HP · productivo"; `03-economia.png` top bar con 49/78; minimapa y panel de unidades ociosas presentes. |
| 9 | Art direction / diorama isométrico | 6.0 | `01-menu.png` identidad con acento amarillo; `02-arranque.png` isométrico con sombras direccionales coherentes; `06c-formacion-zoom.png` / `07-late-game-zoom.png` low-poly plano, materiales mate sin rugosidad ni metal, y el fondo negro "espacial" rompe el diorama. |
| 10 | Audio / juice | 6.0 | `04-combate-zoom.png`: fogonazo con destellos, trazadoras y mancha de daño; `08-asedio-zoom.png` sin fogonazo, explosión ni humo; `03-economia-zoom.png` sin chispa de recolección; sin humo de bajas ni polvo de movimiento. |

**Promedio:** 6.30 · **Mínima:** 5.0 · **Dimensiones < 7:** 8

**Veredicto — SORPRENDIDO: NO**
El HUD y el tech tree convencen, pero combate sin bajas, formaciones en nube, niebla sin memoria y una toma de asedio sin asedio dejan el conjunto lejos de AoE2.

## Top 7 brechas
1. Combate sin muertes ni humo: ningún frame muestra cadáveres, humo o rastro de baja (`04-combate.png`, `08-asedio-zoom.png`) — el choque no se siente ganado ni perdido.
2. Formaciones en nube: racimos sin filas, frente ni orientación común, con solapamiento parcial (`06b-unidades-zoom.png`, `06c-formacion-zoom.png`) — el jugador no lee el orden de la tropa.
3. Niebla sin estado "explorado" ni minimapa espejo: sólo oscuro/nítido y minimapa con el mapa completo (`05-fog.png`) — se pierde la memoria de exploración.
4. Asedio sin asedio: `08-asedio.png` y `08-asedio-zoom.png` sin proyectiles, fogonazos, explosiones ni edificios dañados — la toma estrella no demuestra la mecánica.
5. Siluetas de clase indistinguibles a distancia: `06b-unidades.png` amontona figuras idénticas; las clases sólo aparecen al ampliar (`06c-formacion-zoom.png`) — no se reconocen counters sin zoom.
6. Mapa con vacío negro y terreno desnudo: `02-arranque.png` flota sobre negro y arbustos repetidos — el mapa no se siente habitado.
7. IA enemiga sin economía, defensa ni composición de apoyo visible: `07-late-game.png` muestra una masa y una base, no una partida en curso.

## 5 cambios para el próximo ciclo
1. Hacer visible la muerte (cadáver/humo/hierro que quede en el suelo) — dimensión 2/10 — que el combate se lea ganado o perdido en `04-combate.png`. — dim 2/10.
2. Al mover un grupo, formar filas/cuña con separación pareja y frente definido y sin solapamiento — dimensión 4 — bloque legible en `06c-formacion.png`. — dim 4.
3. Niebla con penumbra de explorado y minimapa que la espeje — dimensión 3 — sensación de mapa por descubrir en `05-fog.png`. — dim 3.
4. Que la toma de asedio muestre acción: proyectil con trayectoria, impacto y edificio dañado o derruido — dimensión 2/10 — probar la mecánica en `08-asedio.png`. — dim 2/10.
5. Diferenciar siluetas y materiales por clase (blindado vs infantería vs artillería) con metal y rugosidad — dimensión 9/2 — reconocer counters y elevar el diorama en `06c-formacion.png` / `07-late-game.png`. — dim 9/2.

## Riesgos / notas
- `04-combate.png` (frame completo) no muestra combate: sólo el recorte `04-combate-zoom.png` revela trazadoras e impacto, así que el combate no es legible a distancia de juego.
- `03c-nodo-agotado.png` no muestra panel de nodo agotado ni cambio de modelo; el desgaste es sólo numérico (`03b-nodos.png`: "68 rest. · 30%").
- `08-asedio.png` no muestra asedio (sin proyectiles, impactos ni derrumbe): la mecánica queda sin probar en captura.
- `07-late-game-zoom.png` centra la base (tejados rosas y flujo de recursos), no el ejército: no aporta a formaciones.
- Dimensiones 1, 3, 5, 6, 7, 8, 9 se puntúan sobre frame completo; el recorte no amplía nada.
- No observables en capturas: audio/feedback sonoro y sacudida de cámara; la dimensión 10 puntúa sólo el feedback visual presente.
