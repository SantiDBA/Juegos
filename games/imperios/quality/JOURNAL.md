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

## Ciclo 02 — 2026-11-13 · niebla, barras y juice de combate

**Qué se hizo:** niebla de guerra 3 estados (desconocido/explorado/visible) con visión por
unidad/edificio, espejada en minimapa y con overlay en el render; IA y auto-adquisición
pasan a `nearestVisibleEnemy` (sin omnisciencia); barras de vida por equipo visibles solo al
daño/selección; eventos de combate drenados a VFX (tracer, impacto, muerte); capturas nuevas
que acreditan posturas, formación en cuña y asedio a la base enemiga.

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Fase | ciclo-02 (niebla/HP/VFX) |
| Capturas | 10 (shots/ciclo-02-fog-combate/) |
| Promedio | **4.75 / 10** |
| Mínima | 2.5 (economía) |
| Verdicto | **SORPRENDIDO: NO** |

### Detalle por dimensión (rúbrica v1, 10 ejes)

| Dimensión | fase-0 | ciclo-01 | ciclo-02 |
|---|---:|---:|---:|
| 1. Economía de aldeanos | 2.5 | 3.0 | 2.5 |
| 2. Combate/counters/proyectiles | 3.0 | 4.0 | 4.0 |
| 3. Niebla/exploración | 1.5 | 2.0 | **6.0** |
| 4. Pathfinding/formaciones | 2.5 | 6.0 | 6.0 |
| 5. Tech tree/edades | 4.5 | 5.0 | 5.5 |
| 6. Contenido y densidad | 3.5 | 4.0 | 3.5 |
| 7. IA legítima | 4.5 | 4.0 | **5.5** |
| 8. HUD/UX AoE2 | 5.0 | 6.0 | 6.0 |
| 9. Art direction/diorama | 2.5 | 4.0 | 4.0 |
| 10. Audio/juice | 1.5 | 2.0 | 4.5 |

Promedio: (2.5+4.0+6.0+6.0+5.5+3.5+5.5+6.0+4.0+4.5)/10 = **4.75**

### Hallazgos del juez → ciclo 03

1. Economía invisible: 8-10 trabajadores con carga, ciclo nodo→depósito, nodos que se agotan.
2. Barras al 55-60% del cuerpo, pegadas y con offset anti-solape; visibles solo heridas/seleccionadas.
3. Huella física del combate: fogonazo, cráter, humo bajo 50%, despojos 8-10 s.
4. Niebla de dos estados legibles (gris azulado recordado vs negro), borde sin escalones y silueta gris de edificio recordado.
5. La era debe verse en el mundo (material/silueta del TC por era) y barra de investigación en curso.
6. Capturas de economía deben mostrar partida real (los 5300/25300 restan credibilidad).

> Topes del renderer 3D actual: arte ≤5, densidad ≤6, combate ≤6.5, juice ≤6. Niebla y HUD
> no están topadas y siguen cortas por decisión de producto.

---

## Ciclo 03 — 2026-11-13 · economía visible y huella de combate

**Qué se hizo:** economía real en capturas (ingenieros trabajando con carga coloreada por
recurso y nodo con cantidad restante), barras de vida más chicas con color por equipo y
visibilidad al daño/selección, VFX con pools (fogonazo, tracer, cráter persistente, humo en
edificios heridos, despojos), Ayuntamiento con material/silueta por era, barra de
investigación/avance de era en el HUD, dev hook `assignEconomy/gatherAll/focus`.

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Fase | ciclo-03 (economía/HP/juice/edades) |
| Capturas | 11 (shots/ciclo-03-economia/) |
| Promedio | **5.30 / 10** |
| Mínima | 4.0 (pathfinding/formaciones; art direction) |
| Verdicto | **SORPRENDIDO: NO** |

### Detalle por dimensión (rúbrica v1, 10 ejes)

| Dimensión | fase-0 | ciclo-01 | ciclo-02 | ciclo-03 |
|---|---:|---:|---:|---:|
| 1. Economía de aldeanos | 2.5 | 3.0 | 2.5 | **6.0** |
| 2. Combate/counters/proyectiles | 3.0 | 4.0 | 4.0 | **6.0** |
| 3. Niebla/exploración | 1.5 | 2.0 | 6.0 | 6.0 |
| 4. Pathfinding/formaciones | 2.5 | 6.0 | 6.0 | 4.0 |
| 5. Tech tree/edades | 4.5 | 5.0 | 5.5 | **7.0** |
| 6. Contenido y densidad | 3.5 | 4.0 | 3.5 | 4.0 |
| 7. IA legítima | 4.5 | 4.0 | 5.5 | 5.0 |
| 8. HUD/UX AoE2 | 5.0 | 6.0 | 6.0 | 5.0 |
| 9. Art direction/diorama | 2.5 | 4.0 | 4.0 | 4.0 |
| 10. Audio/juice | 1.5 | 2.0 | 4.5 | **6.0** |

Promedio: (6.0+6.0+6.0+4.0+7.0+4.0+5.0+5.0+4.0+6.0)/10 = **5.30**

### Brechas del juez → ciclo 04

1. `07-late-game` no muestra late game: encuadre sobre terreno vacío. Fotografiar 25-30
   unidades propias en dos bloques + enemigo compuesto + Ayuntamiento en cuadro.
2. Población imposible (25/18, 30/18, 35/18) por spawns del dev hook: respetar el tope o
   construir viviendas; recursos a 4 dígitos y reloj de partida.
3. Command card fija de texto que se solapa con la ayuda de cámara: contextual, con íconos
   y sin superposición; panel de selección con retrato y filas por unidad.
4. La barra de investigación/avance no aparece en ninguna captura: escenario que inicie una
   investigación y capture mientras corre.
5. Combate en amasijo (facciones atravesándose) y vehículos interpenetrados: separación por
   radio para vehículos y frente legible.
6. Mapa de prototipo: clusters de bosque, vetas, caminos y aldea satélite.
7. Economía: ciclo visible (tránsito a depósito) y nodo desgastándose entre capturas.

> Topes del renderer 3D: cámara cónica (no diorama 2:1), sprites de HP contra-escalados,
> niebla festoneada y props planos. HUD, coherencia de población, separación de vehículos,
> densidad y encuadres NO están topados.

---

## Ciclo 04 — 2026-11-13 · HUD coherente, reloj, progreso y late game encuadrado

**Qué se hizo:** HUD con íconos por recurso, reloj de partida, población con estado de
tope (rojo al llegar al cap), era como chip en una línea, panel de ayuda oculto tras "?"
(elimina la superposición con el panel de acciones), separación de vehículos por radio
(ingeniero 0.75 / infantería 0.85 / dron 0.9 / vehículos 1.45), dev hook con tope de
población (`spawn` respeta popCap), `gatherNode`, `research`, `advanceEra`, `focus`, y
escenarios nuevos `03c-nodo-agotado`, `09-research`, `09b-avance-era`. Capturas con la
investigación y el avance de era corriendo en cuadro, nodo desgastado entre tomas (410→276),
late game encuadrando TC propio + viviendas + fábrica + 34/58 población legal.

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Fase | ciclo-04 (HUD/progreso/coherencia) |
| Capturas | 14 (shots/ciclo-04-hud/) |
| Promedio | **5.30 / 10** |
| Mínima | 4.0 (contenido/densidad; pathfinding/formaciones) |
| Verdicto | **SORPRENDIDO: NO** (juez ciego del ciclo 04, 2026-11-13) |

### Cambios acreditables (observados en capturas 09/09b/07/03c/02)

- `09-research.png`: barra de progreso visible ("Investigando Motor de Combustión · 45s · 0%")
  y `07-late-game.png`: barra en curso ("Investigando Motor de Combustión · 46%") con base propia en cuadro.
- `09b-avance-era.png`: barra dorada de avance de era ("Avanzando a Era del Acero · 44%").
- `03c-nodo-agotado.png`: nodo materiales 276 tras 20 s de recolección (era 410) + hint de selección.
- `02-arranque.png`: top bar con reloj (0:01) y 6 chips iconizados, sin corte de línea.
- `07-late-game.png`: 34/58 de población (tope respetado), TC propio y ejército propio en bloque.
- `06b/06c/08` siguen sin interpenetración de vehículos por la separación por radio.

### Pendientes / riesgos

- Veredicto completo: HUD 7.0 / Economía 6.0 / Tech 6.0 / IA 6.0 / Combate 5.0 / Niebla 5.0 /
  Juice 5.0 / Art 5.0 / Path 4.0 / Densidad 4.0.
- Topes del renderer 3D intactos: cámara cónica, HP sprites contra-escalados, niebla
  festoneada, props planos. El renderer 2D isométrico (fase 4) sigue siendo el siguiente
  bloque grande del plan (destraba art direction, densidad y combate legible).
- Top-7 (juez): combate pegoteado sin counters legibles; niebla en escalera dura; mapa
  paupérrimo (1 bioma); juice invisible en stills (tracer/fogonazos no capturables); sin
  formaciones en pantalla; command card texto-plano sin íconos/retrato; esquina superior
  izquierda con 'cuña beige' sin resolver (cielo/void).
- Acción ciclo 05: suavizar borde de niebla (pendiente 3 celdas + explorado ≥40% más oscuro
  en vista), poblar 03-economia (bosque denso, ruinas, camino, agua), íconos 32px + retrato
  con vida + cola de entrenamiento del Ayuntamiento visible, sacudida breve de cámara en
  cañonazos, y aumentar vida/tamaño de trazadoras para que sean legibles en stills.

---

## Historial de ciclos

| Fecha | Fase / feature | Shots | Puntajes | Veredicto | Cambios |
|---|---|---|---|---|---|
| 2026-11-13 | fase-0 · fundaciones (tick fijo, RNG, eventos, comandos, navgrid, IA sin trampas, dev hook) | `shots/fase-0/` (7) | 3.10 (mín 1.5; sin cambio visual esperado) | NO | harness de capturas + juez ciego + JOURNAL |
| 2026-11-13 | ciclo-01 · pathfinding A*, colisiones, formaciones box/line/wedge, stances, attack-move, shift-queue | `shots/ciclo-01-pathfinding/` (7) | 4.00 (mín 2.0; pathfinding 2.5→6.0, HUD 5.0→6.0, combate 3.0→4.0, art 2.5→4.0) | NO (visual topado por renderer 3D; formaciones no acreditadas por captura) | A*+navgrid+followPath con slide/watchdog; stances + botones; formaciones y cola de waypoints |
| 2026-11-13 | ciclo-02 · niebla 3 estados, barras por equipo, VFX de combate, capturas de formación/asedio | `shots/ciclo-02-fog-combate/` (10) | 4.75 (mín 2.5; niebla 2.0→6.0, IA 4.0→5.5, juice 2.0→4.5, eco 3.0→2.5) | NO (niebla y HUD funcionan; arte/combate topados por renderer 3D) | visión por equipo + nearestVisibleEnemy; overlay de niebla + minimapa enmascarado; HP por equipo al daño; tracer/impacto/muerte; escenarios 06b/06c/08 |
| 2026-11-13 | ciclo-03 · economía visible, HP chicas, VFX con cráteres/despojos, era visual, barra de investigación | `shots/ciclo-03-economia/` (11) | 5.30 (mín 4.0; eco 2.5→6.0, combate 4.0→6.0, juice 4.5→6.0, edades 5.5→7.0) | NO (piezas correctas; HUD/población/encuadres a corregir) | cargo por recurso, nodos con cantidad, HP por equipo, pools muzzle/impact/cráter/humo/wreck, TC por era, barra de progreso, assignEconomy real |
| 2026-11-13 | ciclo-04 · HUD con íconos/reloj, progreso de era/investigación visible, población legal, separación vehículos, escenarios 03c/09/09b | `shots/ciclo-04-hud/` (14) | 5.30 (mín 4.0; HUD 7.0, eco 6.0, tech 6.0, IA 6.0; path/densidad 4.0) | NO (juez ciego; retrato/cola de producción y densidad sin resolver) | chips con ícono + reloj, barra prog. investigación/era, ayuda oculta tras "?", spawn con tope, separation por radio vehículo |
| 2026-11-13 | ciclo-05 · niebla suavizada (bilinear) y mundo más poblado (más nodos/anillos) | `shots/ciclo-05-niebla/` (14) | 4.30 (mín 2.0; niebla 5.0, HUD 6.0, path 5.0, contenido 5.0, IA 5.0; eco 4.0, tech 4.0, art 4.0, combate 3.0, juice 2.0) | NO (borde fog mejoró, pero combate/juice/economía visibles y progresión siguen pobres) | fog 360×360 bilineal con alpha interpolada; más clusters de recursos en dos anillos cerca de bases y mapa |
| 2026-11-13 | ciclo-06 · niebla explorada más oscura + VFX persistentes/visibles en stills (trazadoras, fogonazos, impactos) | `shots/ciclo-06-juice-fog/` (14) | 4.70 (mín 3.5; niebla 6.5, HUD 5.5, tech 5.5, path 5.0, contenido 4.5, eco 4.0, combate 4.0, art 4.0, IA 4.0, juice 3.5) | NO (3 estados de fog más legibles; combate/economía/HUD/densidad/arte aún débiles) | explorado alpha 185; beams/muzzle/flash/ring con hold+lifetime y mayor tamaño/opacidad para capturas |
| 2026-11-13 | ciclo-07 · HUD/selección tipo AoE2, economía visible (carga/nodos/depósito), niebla más contrastada, mapa y capturas de combate ajustadas | `shots/ciclo-07-hud-economia/` (14) | 5.30 (mín 4.0; niebla 7.0, HUD 6.5, eco 6.0, tech 6.0, path 5.0, contenido 5.0, combate 4.5, IA 4.5, juice 4.5, art 4.0) | NO (HUD y economía mucho más legibles; combate/arte/densidad/IA siguen lejos de AoE2) | command card en slots + selección con HP/barras/chips multi; cargo de ingeniero escalado, labels de nodo siempre visibles, indicador dropoff; fog explorado alpha 140; más nodos cerca de bases; escenarios 04/08 con choque más activo |
| 2026-11-13 | ciclo-08 · evento/VFX de depósito, combate/huella más legible, props de densidad, HUD icónica y escenas IA/asedio reforzadas | `shots/ciclo-08-deposito-combate/` (14) | 4.20 (mín 3.0; niebla 5.0, tech 5.0, IA 5.0, HUD 5.0, eco 4.0, combate 4.0, densidad 4.0, juice 4.0, path 3.0, art 3.0) | NO (señales de depósito/impacto aisladas; juez ve ciclo económico no cerrado, combate sin consecuencias claras, formaciones débiles y arte/topes 3D) | evento deposit + spawnDepositFx; trazadoras/muzzle/impactos/sparks/deaths más notorios y persistentes; arbustos/piedras/huellas decorativas; iconos en command card/selección; 03-economía y 07/08 con retorno/entrega y base+oleada/asedio activos |
| 2026-11-13 | ciclo-09 · formaciones con spacing/anclaje, fog 3 estados nítida, depósito/combate más legibles y props/capturas ajustadas | `shots/ciclo-09-formacion-fog-claridad/` (14) | 4.90 (mín 4.0; niebla 6.0, HUD 6.0, combate 5.0, path 5.0, tech 5.0, densidad 5.0, IA 5.0, eco 4.0, art 4.0, juice 4.0) | NO (fog/UI/formación mejoran; economía no inequívoca, combate sin bajas/huellas claras y arte 3D tope fase 4) | FORMATION_SPACING 2.05 + llegada/anclaje y separación atenuada cerca de home; fog RGBA bilineal (visible claro, explorado penumbra fría, no visto negro); spawnDepositFx y cráteres/manchas/wreck/rubble más grandes/persistentes; más props/caminos; minimapa y capturas 03/05/06c ajustadas |
| 2026-11-13 | ciclo-10 · carga/dropoff y depósito más visibles, huellas de combate persistentes, disciplina en contacto, detalles de era y props temáticos | `shots/ciclo-10-economia-bajas-eras/` (14) | 4.40 (mín 3.0; niebla 5.0, path 5.0, tech 5.0, HUD 5.0, art 5.0, eco 4.0, combate 4.0, densidad 4.0, IA 4.0, juice 3.0) | NO (juez no ve cambios inequívocos en stills: carga/entrega, bajas/huellas y salto de era poco legibles; arte 3D tope fase 4) | cargo+marker alto y pulso en ingenieros; dropoff con aro/beacon; depósito/cráteres/manchas/wreck/rubble/scorch más grandes y persistentes (caps/vidas); dress-ranks y settling en combate; adornos por era en edificios; arboledas/cercas/campos decorativos |
| 2026-11-13 | ciclo-11 · carga billboard/dropoff alto, depósitos y huellas de combate muy persistentes, capturas eco/formación pausadas | `shots/ciclo-11-carga-huellas-claridad/` (14) | 4.50 (mín 3.0; combate 5.0, niebla 5.0, path 5.0, tech 5.0, HUD 5.0, juice 5.0, eco 4.0, IA 4.0, art 4.0, densidad 3.0) | NO (carga/dropoff y huellas aún no inequívocas/consistentes en stills; formaciones se rompen en combate; densidad/identidad de era pobres; arte 3D tope fase 4) | cargo BasicMaterial grande + billboard/icono y pulso; dropoff con aro/beacon alto + cap; depósito/impacto/cráter/mancha/wreck doble/rubble/scorch más grandes, contrastados y duraderos (caps/evicción por hold); 03-economia cerrada/pausada con portadores seleccionados y 06c pausada |
| 2026-11-14 | ciclo-12 · carga billboard alta por recurso, dropoff con aro/beacon, huellas de combate más grandes y persistentes, formación sostenida en contacto, niebla con memoria gris-azul y adornos/paleta por era | `shots/ciclo-12-carga-huella-formacion-era-fog/` (14) | 5.20 (mín 4.0; eco 6.0, niebla 6.0, HUD 6.0, tech 5.5, path 5.0, densidad 5.0, IA 5.0, juice 5.0, art 4.5, combate 4.0) | NO (economía y niebla-memoria ya se leen; el still de `04-combate` no muestra choque y las huellas/formación bajo presión siguen sin evidencia clara; densidad e identidad de era débiles; arte 3D tope fase 4) | caja/log billboard grande por recurso + anillo en ingenieros con carga; dropoff con aro+beacon+cap; cráteres/manchas/wreck/scorch/rubble más grandes y duraderos con más props temáticos; dress-ranks+settling+leash en contacto; fog con velo gris-azul de memoria vs negro; UI/minimapa alineados a memoria |

### Juez ciego · ciclo-07-hud-economia (evidencia sobre capturas)

| # | Dimensión | Puntaje | Evidencia |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | 03-economia/03b-nodos/03c-nodo-agotado: ingenieros junto a nodos con **cajas de carga coloreadas** visibles, **etiquetas de cantidad** sobre nodos siempre presentes y decrecientes (remanente legible), anillo/indicador de depósito en edificios dropoff cerca de TC; se intuye flujo nodo→trabajo/deposito, pero falta ver entrega/descarga animada inequívoca en un mismo still. |
| 2 | Combate / counters / proyectiles | 4.5 | 04-combate/08-asedio/07-late-game: HP bars verdes/rojas y **trazadoras/ráfagas e impactos/chispas** visibles en choques, pero masas aún algo apelotonadas, sin proyectiles por tipo/counters claramente legibles ni bajas/cadáveres contundentes. |
| 3 | Niebla / exploración | 7.0 | 05-fog/02-arranque: tres estados distinguibles (negro no visto, **penumbra gris** explorado, área visible iluminada) con borde suave; minimapa refleja ocultamiento/visión; buena legibilidad táctica básica. |
| 4 | Pathfinding / formaciones | 5.0 | 06b-unidades/06c-formacion/04-combate: selección de 6 milicias ordenadas y grupo en **formación en cuña** visible en 06c, pero en combate (04/08) se pierde el frente limpio y hay amontonamiento. |
| 5 | Tech tree / edades | 6.0 | 09-research/09b-avance-era/02-arranque/07-late-game: barra/progreso de **investigación** y **avance de era** con nombre y tiempo/% visible, badge de era cambia (Autónoma en late game), pero el salto visual de edificios/unidades entre eras sigue limitado. |
| 6 | Contenido y densidad | 5.0 | 02-arranque/03-economia/03b-nodos/07-late-game: más **clusters de recursos** cerca de las bases que antes y algo más de ocupación, pero terreno/bioma plano y repetitivo, pocos props/variación ambiental. |
| 7 | IA legítima | 4.5 | 04-combate/07-late-game/08-asedio: enemigo con unidades/estructuras presentes y combatiendo, pero base/composición/intención estratégica poco legible en capturas. |
| 8 | HUD / UX AoE2 | 6.5 | 06-ui/06b-unidades/09-research/09b-avance-era/03-economia: **command card en grilla de slots** con acciones/costos, **panel de selección** jerárquico con barra de HP prominente y estado/cola, **multi-selección en chips** con mini-HP (06b), topbar con recursos/era/población/reloj y minimapa enmarcado; aún sin iconografía rica/retratos AoE2 completos. |
| 9 | Art direction / diorama isométrico | 4.0 | 01-menu/02-arranque/07-late-game: cámara/escala comprensibles pero estética 3D genérica, materiales planos y poca identidad de diorama; **topado por renderer 3D actual (fase 4 2D isométrico pendiente)**. |
| 10 | Audio / juice | 4.5 | 04-combate/08-asedio/07-late-game: flashes, trazadoras e impactos/anillos visibles en stills y cráteres/feedback parcial, pero falta peso sistemático (humo/polvo/muertes claras) y audio no observable. |

**Promedio:** 5.30 · **Mínima:** 4.0 · **Dimensiones < 7:** 8 · **Veredicto:** SORPRENDIDO: NO

### Top 7 brechas (ciclo 07)
1. **Combate aún ilegible** (2, 04-combate/08-asedio) — impactos/counters/bajas no se leen de un vistazo.
2. **Economía sin entrega visible** (1, 03-economia/03c) — falta ver descarga en depósito y ciclo completo claro.
3. **Arte/renderer topado** (9, 02/07) — sin 2D isométrico/sprites no hay diorama ni siluetas AoE2.
4. **Densidad/biomas pobres** (6, 02/03b) — mapa plano y repetitivo.
5. **IA sin intención legible** (7, 07/08) — falta base/composición/plan visible.
6. **Formaciones se rompen en combate** (4, 04/06c) — frente/espaciado no se sostiene.
7. **Progresión de era poco expresiva** (5, 09/07) — cambios visuales/tecnológicos limitados.

### 5 cambios para el ciclo 08
1. **Combate legible en stills**: proyectiles/trazadoras más gruesas y contrastadas por tipo, flash de disparo + impacto + sangre/chispa y cadáver/resto visible en `04-combate`/`08-asedio` (mueve 2,10).
2. **Ciclo económico explícito**: mostrar animación/estado de descarga en depósito y carga claramente llena/vacía en tránsito en `03-economia/03c` (mueve 1).
3. **Densidad y composición de mapa**: clusters más ricos, variación de props/vegetación y mejor lectura de zonas en `02-arranque/03b` (mueve 6,9 dentro del tope 3D).
4. **HUD/command card más icónica**: iconos/retratos más grandes, estados/colas y costos más claros en `06-ui/06b/09` (mueve 8).
5. **IA/intención visible**: base enemiga más desarrollada y composición/oleadas reconocibles en `07-late-game/08-asedio` (mueve 7).

### Juez ciego · ciclo-08-deposito-combate (2026-11-13)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 4.0 | 03-economia: ingenieros en zona de recursos/edificios pero sin carga en mano ni entrega en depósito inequívoca; 03b-nodos: cantidades numéricas legibles y trabajadores adyacentes; 03c-nodo-agotado: nodo reducido/vacío vs 03b, pero ciclo nodo→carga→depósito→retorno no cerrado en still. |
| 2 | Combate / counters / proyectiles | 4.0 | 04-combate: fogonazos y trazas amarillas con impactos puntuales; 08-asedio: cruce de fuego y ataque a estructuras con defensores; 07-late-game: efectos dispersos a mayor escala; sin cadáveres/restos/huellas persistentes claros ni counters/frentes legibles. |
| 3 | Niebla / exploración | 5.0 | 05-fog: negro no explorado vs área visible clara, minimapa refleja lo revelado; 02-arranque/03b: terreno descubierto coherente; distinción explorado-en-penumbra vs visible poco nítida. |
| 4 | Pathfinding / formaciones | 3.0 | 06c-formacion: grupo separado pero nube irregular sin filas/frente/bloque compacto; 04-combate/07-late-game: amasijos sin orientación ni formación reconocible. |
| 5 | Tech tree / edades | 5.0 | 09-research/09b-avance-era: indicadores de investigación y avance de era en UI; 02-arranque vs 07-late-game: unidades/estructuras más avanzadas, pero salto tecnológico poco transformador en siluetas/materiales/lectura. |
| 6 | Contenido y densidad | 4.0 | 02-arranque/03b: árboles, rocas y nodos agrupados con algo de contexto; 05-fog: terreno uniforme, baja variación de bioma/props, sectores vacíos y repetición. |
| 7 | IA legítima | 5.0 | 07-late-game: base enemiga desarrollada con múltiples edificios y unidades; 08-asedio: defensores y atacantes con cruce de fuego; 04-combate: enemigos activos; sin composición táctica/plan coordinado claramente legible. |
| 8 | HUD / UX AoE2 | 5.0 | 06-ui/06b-unidades: top bar recursos/población, minimapa, command card con iconos y panel de selección con retrato/nombre/HP; iconos ayudan pero faltan costos/atajos/colas con progreso y jerarquía integrada. |
| 9 | Art direction / diorama isométrico | 3.0 | 01-menu: tipografía sobre fondo oscuro; 02/03b/07: cámara 3D con modelos simples, materiales planos e iluminación básica, sin ilusión de diorama/miniatura AoE2. **Topado por renderer 3D actual (fase 4 2D isométrico pendiente).** |
| 10 | Audio / juice | 4.0 | 04-combate/07-late-game: fogonazos y trazadoras; 08-asedio: humo/impactos visibles; no se observan cadáveres/escombros/huellas persistentes claros ni feedback sistemático sostenido. |

**Promedio:** 4.20 · **Mínima:** 3.0 · **Dimensiones < 7:** 10 · **Veredicto:** SORPRENDIDO: NO

### Top 7 brechas (ciclo 08)
1. **Economía sin ciclo cerrado legible** (1, 03-economia/03b/03c) — no se ve entrega/descarga inequívoca nodo→carga→depósito→retorno.
2. **Combate sin consecuencias persistentes ni frente táctico** (2, 04-combate/07-late-game/08-asedio) — efectos sueltos, sin cadáveres/huellas/lectura de bajas y dominio.
3. **Formaciones y orden espacial ausentes** (4, 06c-formacion/04-combate) — grupos como nubes sin frente/filas/orientación.
4. **Dirección de arte sin diorama** (9, 01-menu/02-arranque/07-late-game) — look 3D genérico; tope fase 4.
5. **Mapa con baja densidad e identidad** (6, 02-arranque/03b/05-fog) — vacío/repetición, poca orientación.
6. **Niebla/estados poco diferenciados** (3, 05-fog) — explorado vs visible no nítido.
7. **Progresión e intención enemiga poco legibles** (5,7, 07-late-game/08-asedio/09-research/09b) — salto de era y plan/composición del rival poco claros.

### 5 cambios para el ciclo 09
1. **Ciclo económico inequívoco**: ingenieros con carga visible en tránsito, estado/animación de entrega y destello/marca clara en dropoff al depositar en `03-economia/03c` (mueve 1,10).
2. **Consecuencias de combate persistentes y claras**: cadáveres/escombros/manchas y huellas de impacto duraderas y legibles en `04-combate/07-late-game/08-asedio` (mueve 2,10).
3. **Formaciones tácticas reconocibles**: filas/columnas alineadas con frente y orientación común al mover/seleccionar en `06c-formacion` y mantener lectura en combate (mueve 4).
4. **Densidad temática y legibilidad de mapa**: clusters densos (bosques/canteras/granjas), caminos/props de escala y mejor composición sin romper juego en `02-arranque/03b` (mueve 6,9 dentro del tope 3D).
5. **Niebla 3 estados nítida + HUD estratégico**: negro/explorado-en-penumbra/visible bien diferenciados (vista y minimapa) y señales de era/progreso más evidentes en `05-fog/09-research/09b` (mueve 3,5,8).

### Juez ciego · ciclo-09-formacion-fog-claridad (2026-11-13)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 4.0 | 03-economia: top bar recursos/población y unidades cerca de trabajo, pero sin ciclo nodo→carga→depósito→retorno legible; 03b-nodos: nodos marcados y trabajadores dispersos sin carga distinguible; 03c-nodo-agotado: cambio/agote del nodo visible pero entrega/VFX de depósito no inequívocos en still. |
| 2 | Combate / counters / proyectiles | 5.0 | 04-combate: choque con humo/disparos/efectos puntuales sin trayectorias nítidas ni líneas claras; 08-asedio: explosiones/fuego sobre estructuras con impactos difíciles de atribuir; 07-late-game: masas con humo disperso, bajas/counters/foco no legibles de un vistazo. |
| 3 | Niebla / exploración | 6.0 | 05-fog: tres estados distinguibles (negro no explorado, penumbra fría/gris explorada, área visible nítida) en vista y minimapa; borde geométrico/duro y memoria del terreno explorado pobre vs AoE2. |
| 4 | Pathfinding / formaciones | 5.0 | 06c-formacion: bloque/cuña aproximada con frente común, más asentado pero con separación irregular y filas no limpias; 06b-unidades: grupo más desparramado; 04-combate: vuelve el apelotonamiento sin frente sostenido. |
| 5 | Tech tree / edades | 5.0 | 09-research: panel TECNOLOGÍAS con ítems/estados visibles; 09b-avance-era: progreso de avance en UI; 02-arranque vs 07-late-game: unidades/estructuras más avanzadas pero salto de era poco transformador en siluetas/materiales/lectura. |
| 6 | Contenido y densidad | 5.0 | 02-arranque: terreno con árboles, rocas/relieve y edificios iniciales con sectores vacíos amplios; 03b-nodos: clusters y algo más de props/caminos pero repetición alta y poca identidad por zonas. |
| 7 | IA legítima | 5.0 | 04-combate: fuerzas enemigas enfrentando; 07-late-game/08-asedio: base/estructuras rivales, defensas y mezcla de unidades sugieren oposición activa; economía/plan/coordinación no legibles en stills. |
| 8 | HUD / UX AoE2 | 6.0 | 06-ui: top bar recursos/población/era, minimapa, command card en grilla y panel de selección con retrato/vida/stats; 03-economia/09-research: funcional y legible pero genérico, sin jerarquía/iconografía/peso AoE2. |
| 9 | Art direction / diorama isométrico | 4.0 | 01-menu: identidad convencional; 02-arranque/07-late-game: render 3D cenital con iluminación/materiales planos, siluetas/escala sin ilusión de miniatura AoE2. **Topado por renderer 3D actual (fase 4 2D isométrico pendiente).** |
| 10 | Audio / juice | 4.0 | 04-combate/08-asedio: humo/fogonazos/explosiones aisladas; 07-late-game: efectos dispersos pero sin rastro claro de impactos persistentes (cráteres/manchas/wreck/rubble), muertes con despojos legibles ni feedback sistemático. |

**Promedio:** 4.90 · **Mínima:** 4.0 · **Dimensiones < 7:** 10 · **Veredicto:** SORPRENDIDO: NO

### Top 7 brechas (ciclo 09)
1. **Economía sin ciclo de trabajo inequívoco** (1, 03-economia/03b/03c) — no se lee quién recolecta, qué carga, dónde entrega ni respuesta del depósito.
2. **Combate sin consecuencias persistentes ni bajas legibles** (2,10, 04-combate/07-late-game/08-asedio) — sin peso, pérdidas/huellas duraderas que expliquen el resultado.
3. **Dirección de arte 3D genérica, no diorama AoE2** (9, 01-menu/02-arranque/07-late-game) — identidad/plástica lejos de referencia; tope fase 4.
4. **Formaciones asentadas pero sin disciplina** (4, 06c-formacion/06b-unidades/04-combate) — cuña sin filas/espaciado/orientación consistentes, se degrada al chocar.
5. **Niebla con estados distinguibles pero bordes/memoria pobres** (3, 05-fog) — transición dura y poca memoria visual del terreno explorado.
6. **Salto de eras y tecnología sin transformación visible** (5, 09-research/09b-avance-era/02-arranque/07-late-game) — progreso no se siente en siluetas/arsenal/mundo.
7. **Densidad y composición del mapa insuficientes** (6, 02-arranque/03b-nodos) — vacíos amplios y props repetidos; rutas/zonas/escala poco legibles.

### 5 cambios para el ciclo 10
1. **Ciclo económico visible en pantalla**: estado de carga claro en ingenieros (recurso en mano/sobre unidad), retorno y destello/contador/marca inequívoca en depósito al entregar en `03-economia/03b/03c` (mueve 1,10).
2. **Consecuencias de combate obvias y persistentes**: cadáveres/wreck marcados, cráteres/manchas/rubble que permanezcan y se distingan tras impactos/bajas en `04-combate/07-late-game/08-asedio` (mueve 2,10).
3. **Formaciones con disciplina en destino**: filas/espaciado uniforme, alineación por frente y orientación consistente al asentarse y mejor conservación al contacto en `06c-formacion`/combate (mueve 4).
4. **Identidad visual por era**: siluetas/conjuntos de edificios y unidades claramente distintos entre arranque y late game (comparación `02-arranque` vs `07-late-game`/`09b-avance-era`) dentro del tope 3D (mueve 5,9).
5. **Mapa con clusters temáticos legibles**: bosques densos, caminos base-recursos, grupos de props y variación de terreno manteniendo pasillos jugables en `02-arranque/03b-nodos` (mueve 6,9).

### Juez ciego · ciclo-10-economia-bajas-eras (2026-11-13)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 4.0 | 03-economia/03b-nodos/03c-nodo-agotado: trabajadores y nodos/depósitos visibles, pero sin caja/marca de carga, color por recurso ni pulso inequívoco a distancia; entrega sin aro/beacon destacado en dropoff ni ciclo de acarreo claramente legible. 02-arranque: economía inicial sin ciclo obvio. |
| 2 | Combate / counters / proyectiles | 4.0 | 04-combate/08-asedio/07-late-game: choques con disparos y algo de humo/fogonazos, pero sin proyectiles con trayectoria/impacto claros, counters por tipo ni bajas con lectura fuerte; 06b-unidades sin estados de daño diferenciados en combate. |
| 3 | Niebla / exploración | 5.0 | 05-fog: masa no explorada y área visible con minimapa coherente; transición funcional pero genérica 3D, sin memoria explorada rica ni bordes con carácter AoE2. 02-arranque: borde visible sin tensión de descubrimiento marcada. |
| 4 | Pathfinding / formaciones | 5.0 | 06c-formacion: grupo con orientación/separación aproximadas pero sin filas/frente rígidos ni disciplina evidente cerca del slot; 04-combate/07-late-game: en contacto se leen como agrupaciones más que bloques formados. |
| 5 | Tech tree / edades | 5.0 | 09-research/09b-avance-era: indicios de investigación/avance en UI; 02-arranque vs 07-late-game: unidades/estructuras más avanzadas, pero salto de siluetas/materiales/detalles por era (vivienda/cuartel/almacén/fábrica/torre) no contundente a simple vista. |
| 6 | Contenido y densidad | 4.0 | 02-arranque/03b-nodos/05-fog: árboles, rocas y parches de recursos, pero abundan claros vacíos y repetición; props temáticos no conforman trama densa ni identidad de zonas. |
| 7 | IA legítima | 4.0 | 04-combate/07-late-game/08-asedio: fuerzas enemigas y enfrentamientos, pero sin base enemiga desarrollada con economía/defensa clara ni composición/plan de presión evidentes. |
| 8 | HUD / UX AoE2 | 5.0 | 03-economia/06-ui/09-research: recursos/población, minimapa y paneles presentes; command card, retrato, costos, colas y jerarquía básicos y lejos de AoE2. 01-menu funcional sin identidad de diorama. |
| 9 | Art direction / diorama isométrico | 5.0 | 01-menu/02-arranque/07-late-game: cámara/escala 3D consistentes, pero materiales simples, iluminación/plástica genérica y paleta poco unificada; siluetas y sensación de miniatura no alcanzan AoE2. **Tope renderer 3D actual (fase 4 2D isométrico pendiente).** |
| 10 | Audio / juice | 3.0 | 04-combate/08-asedio/07-late-game: algunos fogonazos/humo aislados, pero sin cadáveres, manchas, cráteres, wreck/rubble/escombros ni huellas persistentes de edificios destruidos claramente visibles. |

**Promedio:** 4.40 · **Mínima:** 3.0 · **Dimensiones < 7:** 10 · **Veredicto:** SORPRENDIDO: NO

### Top 7 brechas (ciclo 10)
1. **Economía sin feedback inequívoco de carga/entrega** (1, 03-economia/03b/03c) — no se lee quién transporta qué, cuánto ni dónde entrega; dropoff/deposito poco reconocible.
2. **Batalla sin huella persistente legible** (2,10, 04-combate/07-late-game/08-asedio) — faltan cadáveres, cráteres, manchas y escombros/huella de destrucción duraderos y claros.
3. **Formaciones sin disciplina de frente/filas** (4, 06c-formacion/04-combate) — no se sostienen alineación, filas y frente en contacto.
4. **Progresión de eras poco distinguible** (5,9, 02-arranque/07-late-game/09b-avance-era) — salto de siluetas/materiales/detalles por era no se siente.
5. **Mapa temático poco denso y vacío** (6, 02-arranque/03b-nodos/05-fog) — props/clusters sin trama densa ni identidad de zonas.
6. **IA oponente sin intención legible** (7, 04-combate/07-late-game/08-asedio) — sin base/composición/plan de presión creíbles.
7. **HUD/UX insuficiente para decisiones RTS** (8, 03-economia/06-ui/09-research) — command card, selección y jerarquía lejos del estándar AoE2.

### 5 cambios para el ciclo 11
1. **Carga y entrega imposibles de confundir**: marcador de recurso muy grande/sobresaliente en ingenieros con carga y beacon/anillo de depósito + FX de entrega de larga duración y alto contraste en `03-economia/03b/03c` (mueve 1,10).
2. **Secuelas de combate persistentes e inequívocas**: cadáveres/wreck, manchas, cráteres y escombros/footprint de edificios destruidos grandes, contrastados y duraderos visibles en `04-combate/07-late-game/08-asedio` (mueve 2,10).
3. **Disciplina de formación sostenida**: filas/columnas alineadas, frente y separación uniformes al asentarse y mayor conservación al combatir en `06c-formacion`/combates (mueve 4).
4. **Identidad visual por era evidente**: cambios de silueta/material/detalle claramente reconocibles entre arranque y late game en edificios/unidades clave (comparar `02-arranque` vs `07-late-game/09b-avance-era`) dentro del tope 3D (mueve 5,9).
5. **Mapa con identidad temática y densidad legible**: clusters de bosque/campos/cercas/caminos y zonas diferenciadas sin tapar juego en `02-arranque/03b-nodos/05-fog` (mueve 6).

### Juez ciego · ciclo-11-carga-huellas-claridad (2026-11-13)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 4.0 | 03-economia/03b-nodos/03c-nodo-agotado: ingenieros y nodos con indicadores pequeños, pero sin caja de carga grande/alta inequívoca ni ícono de recurso siempre legible a distancia; dropoff no destaca como aro/beacon/columna dominante y el ciclo nodo→carga→depósito→vuelta no se lee de un vistazo. 02-arranque sin líneas de acarreo visibles. |
| 2 | Combate / counters / proyectiles | 5.0 | 04-combate/07-late-game/08-asedio: choques con fogonazos, estelas, humo y edificios dañados/marcas puntuales, pero sin trayectorias/foco/counters claros ni cadáveres, wreck dobles, cráteres y huella persistente sistemáticos e inequívocos en todas las escenas. |
| 3 | Niebla / exploración | 5.0 | 05-fog: franja oscura de no explorado con borde visible y minimapa coherente; lectura más binaria, sin estado intermedio de terreno explorado en penumbra/memoria tipo AoE2. |
| 4 | Pathfinding / formaciones | 5.0 | 06c-formacion: bloque en filas con frente y separación razonable (pausada), pero 04-combate/07-late-game muestran nubes al pelear y pérdida de disciplina/bloques bajo presión. |
| 5 | Tech tree / edades | 5.0 | 02-arranque/06b/06c/04/05/07/08/09-research/09b-avance-era: etiquetas de era, unidades y UI de investigación/avance visibles; salto visual de edificios/props/entorno entre eras débil, progresión leída más por HUD que por siluetas/materiales. |
| 6 | Contenido y densidad | 3.0 | 02-arranque/03b-nodos/05-fog: amplias planicies vacías y repetitivas con pocos árboles/props y clusters puntuales; sin composición temática rica (caminos, cultivos, variación de bioma) que habite el mapa. |
| 7 | IA legítima | 4.0 | 04-combate/07-late-game/08-asedio: presencia enemiga y presión visibles, pero sin economía enemiga legible, composición planificada, defensa coherente ni intención estratégica evidente. |
| 8 | HUD / UX AoE2 | 5.0 | 02-arranque/03-economia/06-ui: recursos, población, era, minimapa y paneles de selección/acciones/costos presentes; funcionales pero genéricos, sin jerarquía/estética AoE2, tooltips, atajos ni cola rica claramente visible. |
| 9 | Art direction / diorama isométrico | 4.0 | 01-menu con identidad ilustrada; 02-arranque/03b-nodos/07-late-game: vista 3D isométrica consistente pero materiales simples, terreno plano, sombras/luz poco modeladas y siluetas sin peso de diorama AoE2. **Tope renderer 3D actual (fase 4 2D isométrico pendiente).** |
| 10 | Audio / juice | 5.0 | 04-combate/07-late-game/08-asedio/03c-nodo-agotado: fogonazos, humo, explosiones y algo de daño/marcas, pero feedback no consistente ni uniforme (sin cadáveres/wreck dobles, cráteres grandes contrastados y persistencia inequívoca en todos los combates). |

**Promedio:** 4.50 · **Mínima:** 3.0 · **Dimensiones < 7:** 10 · **Veredicto:** SORPRENDIDO: NO

### Top 7 brechas (ciclo 11)
1. **Carga y entrega no inequívocas** (1, 03-economia/03b/03c) — no se identifica al instante qué recurso lleva cada ingeniero ni el dropoff; ciclo de acarreo/entrega ambiguo.
2. **Huella de combate insuficiente y poco consistente** (2,10, 04-combate/07-late-game/08-asedio) — faltan cadáveres/wreck, cráteres/manchas y escombros persistentes, contrastados y sistemáticos.
3. **Densidad y composición temática pobres** (6, 02-arranque/03b-nodos/05-fog) — grandes vacíos/repetición, sin clusters y puntos de interés que habiten el mapa.
4. **Identidad visual por era poco diferenciada** (5,9, 02-arranque/07-late-game/09b-avance-era) — salto de siluetas/materiales/entorno entre eras débil más allá del HUD.
5. **Formación no se sostiene en combate** (4, 06c-formacion/04-combate/07-late-game) — disciplina se desarma al pelear, frentes/bloques ilegibles.
6. **Niebla sin memoria explorado/visible diferenciada** (3, 05-fog) — lectura binaria sin velo de terreno explorado tipo AoE2.
7. **IA oponente sin intención legible** (7, 04-combate/07-late-game/08-asedio) — sin economía/composición/defensa/plan creíbles en pantalla.

### 5 cambios para el ciclo 12
1. **Carga y dropoff de lectura instantánea**: caja/ícono por recurso (color/forma) muy grande y alto sobre cada ingeniero con carga y aro+beacon/columna permanente y brillante en depósitos, visibles al zoom de juego en `03-economia/03b/03c` (mueve 1).
2. **Huella de batalla persistente y contrastada**: cada baja deja mancha grande + silueta/wreck visibles y duraderos; impactos dejan cráter oscuro grande; edificios destruidos conservan scorch y escombros abundantes, de forma consistente en `04-combate/07-late-game/08-asedio` (mueve 2,10).
3. **Disciplina de formación en contacto**: filas/columnas alineadas, frente común y espaciado uniforme mantenidos también durante el combate en `06c-formacion` y choques (mueve 4).
4. **Salto visual explícito por era**: siluetas, materiales y paleta de edificios/props claramente distintos por era (identificables sin leer HUD) en comparación `02-arranque` vs `07-late-game/09b-avance-era` (mueve 5,9).
5. **Mapa habitado y niebla con memoria**: clusters temáticos densos (bosques con volumen, campos/caminos/bordes) y velo gris de terreno/estructuras recordadas vs negro no explorado en `02-arranque/03b-nodos/05-fog` (mueve 6,3).

### Brechas elegidas para el ciclo 12 (siguiente)
Priorizar 1-5 arriba; **fase 4 (renderer 2D isométrico)** sigue siendo el desbloqueo crítico para 9/6/1/5 y el techo AoE2 (criterio: SORPRENDIDO SÍ, promedio ≥ 8.5, ninguna dim < 7).

### Juez ciego · ciclo-12-carga-huella-formacion-era-fog (2026-11-14)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | 03-economia: 4 ingenieros seleccionados junto al bosque con **caja/log naranja grande por recurso** y anillo de carga inconfundibles a zoom de juego, campo de trigo y granja visibles; 03b-nodos/03c-nodo-agotado: panel de nodo con `205 rest · 91%` y cantidades flotantes sobre cada nodo. Falla que 03b y 03c son casi idénticas (el nodo no se ve consumido entre ambas) y no se ve la entrega en el depósito en el mismo cuadro. |
| 2 | Combate / counters / proyectiles | 4.0 | 04-combate: el still **no muestra el choque** (fog, bosque con etiquetas de nodo, milicias azules en formación y barra de avance de era); no hay trazadoras, impactos ni bajas legibles en esa captura. 07-late-game/08-asedio muestran masas enfrentadas con manchas/estelas, pero sin foco de fuego ni counters por tipo. |
| 3 | Niebla / exploración | 6.0 | 05-fog/02-arranque: se distinguen tres estados — negro no explorado, **velo gris-azul de terreno recordado** y área visible cálida — con minimapa coherente; borde de niebla todavía geométrico/en bloques y sin siluetas recordadas de edificios. |
| 4 | Pathfinding / formaciones | 5.0 | 06b-unidades/06c-formacion: bloque con separación y orientación aproximada, pero 06c no marca frente/filas limpias y 04-combate/07-late-game no permiten acreditar disciplina bajo presión; no se ve una cuña inconfundible. |
| 5 | Tech tree / edades | 5.5 | 09-research/09b-avance-era: barras de investigación/avance con nombre, `45S` y `0%` visibles; 07-late-game en Era Autónoma con arsenales más grandes. El salto de silueta/material/entorno entre `02-arranque` y `07-late-game` sigue leyéndose más por HUD que por arte. |
| 6 | Contenido y densidad | 5.0 | 02-arranque/03b-nodos/05-fog: más arboledas, campos de trigo, granjas y caminos que antes, pero persisten claros grandes vacíos y el terreno plano/repetitivo; sin variación de bioma ni zonas con identidad propia. |
| 7 | IA legítima | 5.0 | 07-late-game/08-asedio: base enemiga con edificios, torres/defensas y ejército compuesto presionando, minimapa con concentraciones rojas; no se lee economía enemiga ni un plan de presión más allá de "hay tropas". |
| 8 | HUD / UX AoE2 | 6.0 | 06-ui/03-economia/06b-unidades: topbar completo (recursos, población, era, reloj), command card en slots con costos y botones de era/investigación, panel de selección con HP grande y "Listo para producir", multi-selección con chips; falta retrato/cola de producción y jerarquía visual AoE2. |
| 9 | Art direction / diorama isométrico | 4.5 | 01-menu sin identidad ilustrada (overlay oscuro + tarjetas de texto); 02-arranque/07-late-game: cámara isométrica consistente y paleta algo más unificada, pero materiales planos, luz sin dirección dramática y siluetas sin peso de miniatura. **Tope renderer 3D actual (fase 4 2D isométrico pendiente).** |
| 10 | Audio / juice | 5.0 | 07-late-game/08-asedio: manchas de facción, estelas y columnas/beacons visibles; 04-combate no aporta evidencia por no mostrar choque. Feedback sin consistencia entre escenas (ni cadáveres/wreck dobles ni cráteres dominantes en todas). |

**Promedio:** 5.20 · **Mínima:** 4.0 · **Dimensiones < 7:** 10 · **Veredicto:** SORPRENDIDO: NO

### Top 7 brechas (ciclo 12)
1. **La captura de combate no muestra combate** (2, 04-combate) — el still congela antes del choque; sin evidencia visual la dimensión no puede subir.
2. **Huella de batalla no sistemática** (2,10, 07-late-game/08-asedio) — manchas/estelas presentes pero sin cráteres, cadáveres/wreck y escombros dominantes y consistentes.
3. **Formación no acreditada bajo presión** (4, 06c-formacion/04-combate/07-late-game) — 06c no muestra frente/filas y no hay still de contacto con bloque formado.
4. **Identidad de era débil fuera del HUD** (5,9, 02-arranque vs 07-late-game/09b-avance-era) — sin cambio claro de silueta/material/paleta.
5. **Densidad y bioma pobres** (6, 02-arranque/03b-nodos/05-fog) — claros vacíos y terreno plano sin zonas diferenciadas.
6. **IA sin intención legible** (7, 07-late-game/08-asedio) — hay ejército, no se lee economía ni plan.
7. **Nodo agotado no visible** (1, 03b-nodos/03c-nodo-agotado) — ambas capturas casi idénticas; el consumo del nodo no se demuestra.

### 5 cambios para el ciclo 13
1. **Arreglar el encuadre de `04-combate`**: garantizar choque real en cuadro (milicias propias y enemigas en contacto, trazadoras/impactos y al menos una baja con mancha) antes de pausar (mueve 2,10).
2. **Secuelas persistentes por sistema**: cada baja deja mancha + wreck duradero y cada impacto deja cráter oscuro grande, de forma uniforme en `04-combate/07-late-game/08-asedio` (mueve 2,10).
3. **Still de formación en contacto**: `06c-formacion` con cuña/frente limpio + separación uniforme, y en `04-combate` el bloque propio conservando filas al pelear (mueve 4).
4. **Salto de era visible sin leer HUD**: paleta, materiales y siluetas de edificios/unidades claramente distintas entre `02-arranque` y `07-late-game/09b-avance-era` (mueve 5,9).
5. **`03c-nodo-agotado` con nodo realmente consumido** (remanente bajo/parche vacío) y `05-fog` con siluetas recordadas de edificios enemigos (mueve 1,3).

### Brechas elegidas para el ciclo 13 (siguiente)
Priorizar 1-5 arriba; **fase 4 (renderer 2D isométrico)** sigue siendo el desbloqueo crítico para 9/6/1/5 y el techo AoE2 (criterio: SORPRENDIDO SÍ, promedio ≥ 8.5, ninguna dim < 7).

---

### Juez ciego · ciclo-13-combate-fog-nodo · 2026-11-17

**Capturas evaluadas:** shots/ciclo-13-combate-fog-nodo/ (14/14)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 5.0 | 03-economia.png: varios ingenieros con cajas de carga naranja visibles en tránsito/retorno entre bosque y base; 03b-nodos.png: grupo de ingenieros trabajando un bosque seleccionado con panel “Bosque” y cantidad restante legible; 03c-nodo-agotado.png: el mismo tipo de nodo aparece reducido de escala con “10 rest · 1%” frente al lleno de 03b, consumo visible; 02-arranque.png: pocos trabajadores y sin líneas densas de acarreo. Ciclo parcialmente legible pero escaso y sin feedback de depósito destacado. |
| 2 | Combate / counters / proyectiles | 5.0 | 04-combate.png: choque frontal cuerpo a cuerpo y a distancia con barras de vida, fogonazos/estelas y varias unidades caídas con manchas oscuras en el suelo, contacto real en cuadro; 07-late-game.png y 08-asedio.png: enfrentamientos y asedio con humo, explosiones y daños visibles. Sin trayectorias de proyectil nítidas y consistentes, sin counters por tipo identificables y sin rastro/cadáveres sistemáticos en todas las escenas. |
| 3 | Niebla / exploración | 6.0 | 05-fog.png: se distinguen negro no explorado, zona gris-azulada de memoria explorada con siluetas claras de edificios enemigos recordados y área visible nítida; minimapa coherente con los tres estados; 02-arranque.png: borde de exploración presente. Bordes aún geométricos/bloqueados y memoria sin detalle fino del terreno. |
| 4 | Pathfinding / formaciones | 5.0 | 06c-formacion.png: bloque en cuña con separación y orientación aproximadas pero filas/frente irregulares; 06b-unidades.png: selección de 6 milicias agrupadas sin alineación estricta; 04-combate.png y 07-late-game.png: en contacto las unidades se mezclan en masa sin disciplina sostenida. |
| 5 | Tech tree / edades | 5.0 | 09-research.png: panel de tecnologías con investigación en curso y barra/progreso visible; 09b-avance-era.png: barra dorada de avance de era en el ayuntamiento; 02-arranque.png vs 07-late-game.png: mayor variedad de unidades/edificios en fase tardía, pero el salto de era se lee más por HUD/etiquetas que por siluetas y materiales transformados. |
| 6 | Contenido y densidad | 4.0 | 02-arranque.png, 03b-nodos.png y 05-fog.png: terreno mayormente plano con árboles dispersos, campos/nodos y algunos edificios, dejando amplias zonas vacías y repetitivas; 07-late-game.png: más estructuras y unidades pero poca variación de bioma, caminos o props que den identidad a zonas. |
| 7 | IA legítima | 5.0 | 07-late-game.png y 08-asedio.png: base enemiga con múltiples edificios/torres y ejército compuesto presionando o defendiendo; 04-combate.png: fuerza enemiga enfrentando activamente. No se observa economía enemiga, colas ni un plan estratégico legible más allá del choque. |
| 8 | HUD / UX AoE2 | 5.0 | 06-ui.png, 03-economia.png y 09-research.png: barra superior de recursos/población/era/tiempo, minimapa, command card con acciones y costos, panel de selección con nombre/vida/estadísticas y barras de progreso. Funcional pero genérico, sin iconografía, jerarquía ni estética de AoE2. |
| 9 | Art direction / diorama isométrico | 4.0 | 01-menu.png: pantalla genérica sin identidad de diorama; 02-arranque.png y 07-late-game.png: vista isométrica 3D consistente pero con materiales simples, iluminación plana, terreno uniforme y siluetas sin peso de miniatura ni paleta característica de AoE2. |
| 10 | Audio / juice | 5.0 | 04-combate.png: fogonazos, humo y manchas oscuras de bajas visibles en el contacto; 07-late-game.png y 08-asedio.png: explosiones, humo y señales de daño en edificios/unidades. Feedback presente en algunas escenas pero no sistemático ni persistente de forma uniforme (sin huellas duraderas claras en todo el combate). |

**Promedio:** 4.90 · **Mínima:** 4.0 · **Dimensiones < 7:** 10

**Veredicto — SORPRENDIDO: NO**
Se ven mejoras puntuales (choque y bajas en 04-combate, nodo consumido en 03c, siluetas en niebla) pero el conjunto sigue lejos del estándar AoE2 en arte, densidad y peso de juego.

## Top 7 brechas
1. Arte 3D genérico sin lectura de diorama — 01-menu.png, 02-arranque.png, 07-late-game.png — rompe la ilusión AoE2 (dim 9).
2. Mapa plano y poco habitado — 02-arranque.png, 03b-nodos.png, 05-fog.png — el mundo se siente vacío y sin identidad de zonas (dim 6).
3. Combate sin consecuencias persistentes y sistemáticas — 04-combate.png, 07-late-game.png, 08-asedio.png — impactos y bajas no dejan huella durable y consistente que explique la batalla (dim 2,10).
4. Formaciones sin disciplina en movimiento/contacto — 06c-formacion.png, 04-combate.png, 07-late-game.png — los bloques no sostienen frente/filas al pelear (dim 4).
5. Economía sin ciclo completo y denso — 03-economia.png, 02-arranque.png — pocos trabajadores, entrega/deposito poco celebrada y sin líneas de acarreo claras (dim 1).
6. Progresión de eras poco visible en el mundo — 02-arranque.png, 07-late-game.png, 09b-avance-era.png — el salto depende del HUD más que de siluetas/materiales (dim 5).
7. IA sin intención económica/estratégica legible — 07-late-game.png, 08-asedio.png — se ve ejército pero no plan ni producción rival (dim 7).

## 5 cambios para el próximo ciclo
1. Huellas de combate persistentes y uniformes (mancha + restos/cráter duraderos por baja/impacto visibles en todo choque) — 04-combate.png, 07-late-game.png, 08-asedio.png — mueve dim 2,10.
2. Formación en cuña/línea que conserve frente y espaciado al detenerse y al entrar en contacto — 06c-formacion.png, 04-combate.png — mueve dim 4.
3. Densidad temática del mapa: clusters claros de bosque/cultivo, caminos y props que rellenen vacíos sin tapar juego — 02-arranque.png, 03b-nodos.png — mueve dim 6 (dentro del tope 3D).
4. Feedback de depósito inequívoco y más ingenieros en ciclo visible (beacon/pulso al entregar y retorno claro) — 03-economia.png, 03b-nodos.png — mueve dim 1,10.
5. Diferenciación visual de era más marcada en edificios/unidades clave (silueta/paleta) apreciable en comparación arranque vs late game — 02-arranque.png, 07-late-game.png — mueve dim 5,9.

## Riesgos / notas
- Dim 9 (art direction/diorama) y el techo de 6 siguen limitados por el renderer 3D actual; la fase 4 (2D isométrico) es el desbloqueo estructural para alcanzar ≥8.5.
- El estado de audio real no es audible en capturas fijas; el puntaje de dim 10 se basó solo en feedback visual observable.
- 03c-nodo-agotado.png muestra consumo claro (10 rest · 1%) pero en un still aislado no prueba el ciclo completo de extracción en tiempo real.

---

### Juez ciego · ciclo-14-huellas-densidad-era-economia · 2026-11-17

**Capturas evaluadas:** shots/ciclo-14-huellas-densidad-era-economia/ (14/14)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | 03-economia.png: varios ingenieros con cajas de carga naranja visibles en tránsito/retorno cerca del ayuntamiento y del bosque, con destellos/halos de entrega en la zona de depósito que marcan el ciclo; 03b-nodos.png: grupo de ingenieros trabajando un nodo seleccionado con panel de cantidad restante; 03c-nodo-agotado.png: el mismo nodo aparece reducido con “10 rest · 1%”, evidenciando consumo. 02-arranque.png: economía inicial aún escasa. Ciclo nodo→carga→depósito más legible, pero sin líneas densas ni múltiples recursos explotados a la vez. |
| 2 | Combate / counters / proyectiles | 5.0 | 04-combate.png: choque frontal en cuadro con milicias/fusileros enfrentados, barras de vida, fogonazos y manchas/restos oscuros de bajas visibles en el suelo; 07-late-game.png y 08-asedio.png: combates/asedio con explosiones, humo y señales de daño/huellas en el terreno. Sin trayectorias de proyectil claras y consistentes, sin counters por tipo identificables y sin consecuencias persistentes uniformes en todas las escenas. |
| 3 | Niebla / exploración | 7.0 | 05-fog.png: tres estados diferenciados — negro no explorado, zona gris-azulada de memoria con siluetas claras de edificios enemigos recordados y área visible nítida — con minimapa coherente; 02-arranque.png: borde de exploración presente. Bordes de niebla aún geométricos y transición poco suave respecto al estándar AoE2. |
| 4 | Pathfinding / formaciones | 5.0 | 06c-formacion.png: grupo en cuña con separación y orientación reconocibles, pero filas/frente irregulares; 06b-unidades.png: milicias seleccionadas agrupadas sin alineación estricta; 04-combate.png y 07-late-game.png: al entrar en contacto las unidades se mezclan en masas sin disciplina sostenida. |
| 5 | Tech tree / edades | 5.0 | 09-research.png: investigación en curso con barra/progreso visible en UI; 09b-avance-era.png: barra dorada de avance de era en el ayuntamiento; 02-arranque.png vs 07-late-game.png: mayor variedad de unidades/edificios y tonos/materiales algo más diferenciados en la fase tardía, pero el salto de era sigue leyéndose más por HUD que por siluetas transformadas. |
| 6 | Contenido y densidad | 5.0 | 02-arranque.png y 03b-nodos.png: más agrupaciones de árboles/arbustos, parches de cultivo y caminos que antes, aportando algo de trama; 05-fog.png y 07-late-game.png: persisten amplias zonas de terreno plano y repetitivo sin variación de bioma ni identidad fuerte por zonas. |
| 7 | IA legítima | 5.0 | 07-late-game.png y 08-asedio.png: base enemiga con edificios/torres y ejército compuesto atacando o defendiendo; 04-combate.png: fuerza enemiga enfrentando activamente. No se observa economía enemiga, producción en cola ni un plan estratégico legible en las tomas. |
| 8 | HUD / UX AoE2 | 5.0 | 06-ui.png, 03-economia.png y 09-research.png: barra superior de recursos/población/era/tiempo, minimapa, command card con acciones y costos y panel de selección con nombre/vida/estadísticas. Funcional y legible, pero genérico y sin la iconografía, jerarquía ni estética de AoE2. |
| 9 | Art direction / diorama isométrico | 4.0 | 01-menu.png: pantalla sin identidad de diorama; 02-arranque.png y 07-late-game.png: vista 3D isométrica consistente con paletas algo más diferenciadas por era, pero materiales simples, iluminación plana y terreno uniforme sin peso de miniatura ni estilo AoE2. |
| 10 | Audio / juice | 5.0 | 04-combate.png, 07-late-game.png y 08-asedio.png: fogonazos, humo, explosiones y marcas de impacto/bajas visibles en el suelo; 03-economia.png: feedback de entrega más notorio en el depósito. El feedback existe en escenas clave pero no es sistemático, pesado ni persistente de forma uniforme en toda la batalla. |

**Promedio:** 5.20 · **Mínima:** 4.0 · **Dimensiones < 7:** 10

**Veredicto — SORPRENDIDO: NO**
Hay avances claros en niebla con memoria, nodo consumido y legibilidad parcial del ciclo/combate, pero el conjunto sigue lejos del estándar AoE2 en arte, densidad, disciplina y peso sistémico.

## Top 7 brechas
1. Arte 3D sin lectura de diorama — 01-menu.png, 02-arranque.png, 07-late-game.png — no transmite la miniatura habitable de AoE2 (dim 9).
2. Combate sin consecuencias persistentes y sistemáticas — 04-combate.png, 07-late-game.png, 08-asedio.png — faltan huellas duraderas uniformes (cadáveres/restos/cráteres) que cuenten la batalla (dim 2,10).
3. Formaciones sin disciplina sostenida — 06c-formacion.png, 04-combate.png, 07-late-game.png — el frente/filas se pierden al moverse o combatir (dim 4).
4. Mapa con densidad insuficiente e identidad débil — 02-arranque.png, 03b-nodos.png, 05-fog.png, 07-late-game.png — vacíos y repetición impiden un mundo habitado (dim 6).
5. Economía sin líneas densas ni circuito completo obvio — 03-economia.png, 02-arranque.png — pocos trabajadores y explotación limitada visible a la vez (dim 1).
6. Salto de eras poco transformador en el mundo — 02-arranque.png, 07-late-game.png, 09b-avance-era.png — la progresión se apoya en HUD más que en siluetas/materiales (dim 5).
7. IA sin intención económica/estratégica legible — 07-late-game.png, 08-asedio.png — ejército presente sin producción ni plan observable (dim 7).

## 5 cambios para el próximo ciclo
1. Huellas de combate duraderas y sistemáticas en todos los choques (manchas, restos/cadáveres y cráteres que permanezcan visibles) — 04-combate.png, 07-late-game.png, 08-asedio.png — mueve dim 2,10.
2. Formaciones que mantengan frente, filas y espaciado al asentarse y durante el contacto — 06c-formacion.png, 04-combate.png — mueve dim 4.
3. Densidad y composición temática mayores (bosques/cultivos/caminos/props que rellenen vacíos y definan zonas) — 02-arranque.png, 03b-nodos.png, 05-fog.png — mueve dim 6.
4. Economía más densa y legible con más ingenieros en ciclo simultáneo y depósitos claramente señalizados — 03-economia.png, 02-arranque.png — mueve dim 1,10.
5. Diferenciación de era más evidente en siluetas/materiales de edificios y unidades clave — 02-arranque.png, 07-late-game.png, 09b-avance-era.png — mueve dim 5,9.

## Riesgos / notas
- Dim 9 (art direction/diorama) permanece acotada por el renderer 3D actual; la fase 4 (2D isométrico) sigue siendo el desbloqueo para ≥8.5.
- El puntaje de dim 10 se basa solo en feedback visual observable en capturas fijas (audio no audible).
- 06b-unidades.png/06c-formacion.png dependen del tope de población/disponibilidad; la legibilidad de la cuña puede variar si el escuadrón es menor.


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
