# JOURNAL · Imperios hacia AoE2

Historial append-only del loop de calidad. Cada fila es un ciclo cerrado con capturas
deterministas y un juez ciego. No se reescriben filas viejas: si algo se corrige, se
agrega una nota al final.

Convención de puntajes: escala 0–10, promedio aritmético de las dimensiones medidas.
Aceptación de un ciclo: `SORPRENDIDO: SÍ` + promedio ≥ 8.5 + ninguna dimensión < 7.

---

## Baseline — 2026-11-12

**Qué se midió:** juez ciego sobre **3 capturas del estado inicial** (menú, arranque,
primer vistazo de partida). Sin código, sin roadmap, sin puntajes previos a la vista.

| Campo | Valor |
|---|---|
| Fecha | 2026-11-12 |
| Fase | baseline (estado inicial, pre-loop) |
| Capturas | 3 (estado inicial) |
| Promedio | **3.13 / 10** |
| Mínima | 1.5 (juice) |
| Verdicto | **SORPRENDIDO: NO** |

### Detalle por dimensión (rúbrica v0, 8 ejes)

| Eje medido (v0) | Puntaje | Lectura del juez |
|---|---:|---|
| HUD | 3.0 | Barra superior presente pero plana; números sin jerarquía ni iconografía AoE2 |
| Art | 2.5 | Materiales y paleta de prototipo; siluetas genéricas, cero dirección de arte |
| Legibilidad | 3.0 | No se distingue clase de unidad ni bando a distancia de juego |
| Diorama | 3.5 | Hay intento de composición, pero la cámara/escala no leen como diorama |
| Juice | 1.5 | Nada se mueve con peso: sin impactos, sin feedback, sin audio |
| Info | 4.0 | La información existe pero no está donde el jugador la busca |
| Densidad | 2.5 | Mapa vacío: grandes zonas sin nada que mirar |
| Potencial | 5.0 | La base técnica está; el techo visual todavía no se tocó |

Promedio: (3.0 + 2.5 + 3.0 + 3.5 + 1.5 + 4.0 + 2.5 + 5.0) / 8 = **3.125 ≈ 3.13**

> **Nota de calibración:** el baseline se puntuó con la rúbrica v0 de 8 ejes. La rúbrica
> vigente (`RUBRIC.md`) tiene 10 dimensiones. Mapeo aproximado, **no** re-puntuación:
> HUD→HUD/UX AoE2 (3.0) · Art→art direction (2.5) · Diorama→diorama isométrico (3.5) ·
> Juice→audio/juice (1.5) · Densidad→contenido y densidad (2.5) · Info→legibilidad/
> información (4.0). Quedaron **sin medir**: economía de aldeanos, combate/counters/
> proyectiles, niebla/exploración, pathfinding/formaciones, tech tree/edades, IA legítima.
> El primer ciclo con la rúbrica nueva debe puntuar las 10 y **no** comparar promedios
> entre rúbricas distintas; la comparación válida es por dimensión mapeada.

### Top brechas del baseline (orden de impacto)

1. **Sin audio ni VFX.** No hay impacto: ni partículas, ni sacudida, ni sonido de
   combate o de recolección. Es lo que más rompe la fantasía AoE2.
2. **Command card ausente + bugs de layout.** No hay panel de acciones al seleccionar;
   el HUD se desacomoda y la información queda fuera de lugar.
3. **Terreno muerto.** El suelo es una superficie sin vida: sin variación, sin detalles
   que den escala ni sensación de mapa.
4. **Legibilidad de clases y bando.** A distancia de juego no se distingue infantería de
   blindado, ni propio de enemigo.
5. **Minimapa decorativo.** Ocupa espacio, no informa: no se lee dónde hay base, recursos
   ni ejército.
6. **Estado de partida invisible.** Recursos, población, era y cola de producción no se
   leen de un vistazo: el jugador no sabe en qué situación está.
7. **Escala anti-diorama.** El tamaño relativo de unidades, edificios y cámara impide la
   lectura de diorama isométrico típica de AoE2.

### Acciones derivadas (insumo del ciclo 01)

Las 5 primeras brechas (audio/VFX, command card, terreno, legibilidad, minimapa) son el
punto de partida del ciclo 01; 6 y 7 quedan en cola para el ciclo 02.

---

## Ciclo fase-0 — 2026-11-13

**Qué se hizo:** fundaciones internas (sin cambio visual esperado): tick fijo 20 tps,
RNG sembrado, bus de eventos, capa de comandos (`applyCommand`), navgrid, IA extraída a
`sim/ai.ts` sin trampas (construcción real con ingenieros) y dev hook `window.__imperios`
para capturas deterministas. Harness de calidad (README, RUBRIC, capture.mjs, shots).

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Fase | fase-0 (fundaciones) |
| Capturas | 7 (shots/fase-0/) |
| Promedio | **3.10 / 10** |
| Mínima | 1.5 (niebla; juice) |
| Verdicto | **SORPRENDIDO: NO** (esperado: fase interna) |

### Detalle por dimensión (rúbrica v1, 10 ejes)

| Dimensión | Puntaje |
|---|---:|
| 1. Economía de aldeanos | 2.5 |
| 2. Combate/counters/proyectiles | 3.0 |
| 3. Niebla/exploración | 1.5 |
| 4. Pathfinding/formaciones | 2.5 |
| 5. Tech tree/edades | 4.5 |
| 6. Contenido y densidad | 3.5 |
| 7. IA legítima | 4.5 |
| 8. HUD/UX AoE2 | 5.0 |
| 9. Art direction/diorama | 2.5 |
| 10. Audio/juice | 1.5 |

Promedio: (2.5+3.0+1.5+2.5+4.5+3.5+4.5+5.0+2.5+1.5)/10 = **3.10**

### Brechas elegidas para el ciclo 01 (juez)

1. Niebla de guerra inexistente (mapa resuelto desde el frame 1).
2. El mundo no reacciona: sin proyectiles, impactos, humo ni cadáveres.
3. El ejército no escala: unidades atravesándose, sin formaciones ni base enemiga visible.
4. La economía no se ve (aldeanos quietos, sin ciclo nodo→depósito).
5. Terreno plano con confeti, sin clusters de recursos ni caminos.
6. HUD con forma de app web: sin íconos, sin retrato, texto de ayuda superpuesto.
7. Las eras son una etiqueta: sin cambio de silueta/material entre edades.

> Nota: las capturas de fase-0 usan todavía el render Three.js actual; el renderer 2D
> isométrico llega en la fase 4 y es el que cambia de raíz las dimensiones 8-10.

---

## Ciclo 01 — 2026-11-13 · pathfinding, formaciones y stances

**Qué se hizo:** pathfinding A* sobre navgrid con colisión de edificios/bosques, suavizado
por línea de visión, movimiento consolidado (`followPath`) con slide y watchdog anti-atasco,
formaciones box/line/wedge al mover grupos, posturas (agresiva/defensiva/mantener/no atacar),
attack-move, patrulla (API) y shift-queue de waypoints. Sin cambio de renderer.

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Fase | ciclo-01 (pathfinding/formaciones/stances) |
| Capturas | 7 (shots/ciclo-01-pathfinding/) |
| Promedio | **4.00 / 10** |
| Mínima | 2.0 (niebla; juice) |
| Verdicto | **SORPRENDIDO: NO** |

### Detalle por dimensión (rúbrica v1, 10 ejes)

| Dimensión | fase-0 | ciclo-01 |
|---|---:|---:|
| 1. Economía de aldeanos | 2.5 | 3.0 |
| 2. Combate/counters/proyectiles | 3.0 | 4.0 |
| 3. Niebla/exploración | 1.5 | 2.0 |
| 4. Pathfinding/formaciones | 2.5 | **6.0** |
| 5. Tech tree/edades | 4.5 | 5.0 |
| 6. Contenido y densidad | 3.5 | 4.0 |
| 7. IA legítima | 4.5 | 4.0 |
| 8. HUD/UX AoE2 | 5.0 | **6.0** |
| 9. Art direction/diorama | 2.5 | 4.0 |
| 10. Audio/juice | 1.5 | 2.0 |

Promedio: (3.0+4.0+2.0+6.0+5.0+4.0+4.0+6.0+4.0+2.0)/10 = **4.00**

### Hallazgos del juez (acciones obligatorias para el ciclo 02)

1. **El harness no acredita formaciones/posturas**: ninguna captura selecciona unidades
   propias sin edificio. Agregar escenario `06b-unidades` (5 unidades seleccionadas + orden
   de formación) y hacer visible la formación elegida.
2. **Barras de vida desproporcionadas y todas verdes**: visibles solo al daño/selección,
   45-60% del ancho, verde propio / rojo enemigo, con merma real.
3. **Combate sin proyectiles/impactos/bajas visibles** y cortado por el HUD.
4. **Niebla de guerra ausente**: implementar dos estados y espejarla en minimapa.
5. **Economía sin ciclo visible** (aldeanos amontonados, recursos de debug): capturas de
   partida real + ciclo nodo→depósito + cola de producción.
6. **Base enemiga nunca en cuadro**: agregar escenario de asedio a la base enemiga.
7. Menú desactualizado: dice que niebla y pathfinding son "expansión futura" (ya no).

> El juez marcó como topadas por el renderer 3D actual: art direction, densidad, juice y
> legibilidad de combate. Se esperan mejoras plenas recién en la fase 4 (renderer 2D
> isométrico), pero economía, tech tree, IA, HUD y barras no tienen excusa.

---

## Historial de ciclos

| Fecha | Fase / feature | Shots | Puntajes | Veredicto | Cambios |
|---|---|---|---|---|---|
| 2026-11-13 | fase-0 · fundaciones (tick fijo, RNG, eventos, comandos, navgrid, IA sin trampas, dev hook) | `shots/fase-0/` (7) | 3.10 (mín 1.5; sin cambio visual esperado) | NO | harness de capturas + juez ciego + JOURNAL |
| 2026-11-13 | ciclo-01 · pathfinding A*, colisiones, formaciones box/line/wedge, stances, attack-move, shift-queue | `shots/ciclo-01-pathfinding/` (7) | 4.00 (mín 2.0; pathfinding 2.5→6.0, HUD 5.0→6.0, combate 3.0→4.0, art 2.5→4.0) | NO (visual topado por renderer 3D; formaciones no acreditadas por captura) | A*+navgrid+followPath con slide/watchdog; stances + botones; formaciones y cola de waypoints |

_Sin entradas todavía: el primer ciclo se registra después del baseline._

---

## Cómo se agrega una fila

1. Crear `quality/shots/<NN-feature>/` con las 7 capturas (`capture.mjs`).
2. Puntuar con `RUBRIC.md` en modo ciego y guardar la salida del juez.
3. Agregar la fila al final de la tabla con:
   - **fecha** `YYYY-MM-DD`;
   - **fase/feature**: `01-economia` + una línea de qué se hizo;
   - **shots**: carpeta (`shots/01-economia/`) y cuántas tomas;
   - **puntajes**: promedio, mínima y las dimensiones que se movieron
     (p. ej. `8.6 (mín 7.0; juice 6.8→8.0, dens 5.5→8.0)`);
   - **veredicto**: `SÍ` / `NO` + por qué en una línea;
   - **cambios**: el top-5 aplicado, en una línea.
4. Si el ciclo NO pasó, listar debajo las 5 brechas elegidas para el ciclo siguiente.
