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

# Juez ciego · ciclo-15-formacion-huellas-economia · 2026-11-17

**Capturas evaluadas:** shots/ciclo-15-formacion-huellas-economia/ (14/14)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 7.0 | `03-economia.png`: aldeanos activos junto a recursos y edificios con recursos/población visibles en HUD; `03b-nodos.png`: múltiples nodos de madera y mineral; `03c-nodo-agotado.png`: área de recurso visiblemente consumida/agotada. |
| 2 | Combate / counters / proyectiles | 6.0 | `04-combate.png`: enfrentamiento entre bandos con barras de vida y unidades en contacto; `08-asedio.png` y `07-late-game.png`: presencia de fuerzas y presión sobre estructuras, sin proyectiles, estelas o bajas claramente distinguibles. |
| 3 | Niebla / exploración | 7.0 | `05-fog.png`: zonas no exploradas en oscuro, áreas exploradas en penumbra y terreno visible nítido; minimapa coherente con lo revelado; `02-arranque.png`: límite de visibilidad alrededor de la base. |
| 4 | Pathfinding / formaciones | 7.0 | `06c-formacion.png`: grupo de unidades dispuesto en bloque compacto con frente común y separación uniforme; `04-combate.png` y `07-late-game.png`: agrupaciones ordenadas sin apelotonamiento evidente. |
| 5 | Tech tree / edades | 7.0 | `09-research.png` y `09b-avance-era.png`: interfaz/progreso de investigación y avance visibles; `07-late-game.png`: unidades y edificios de aspecto más avanzado respecto a `02-arranque.png`. |
| 6 | Contenido y densidad | 6.0 | `02-arranque.png` y `03b-nodos.png`: árboles, recursos y edificios repartidos con amplias zonas de terreno despejado; `07-late-game.png`: mayor ocupación en base, pero con parches uniformes aún visibles. |
| 7 | IA legítima | 5.0 | `04-combate.png`, `07-late-game.png` y `08-asedio.png`: presencia de fuerzas enemigas en combate y asedio, pero sin base/economía rival claramente desarrollada ni intención estratégica totalmente legible. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png` y `06b-unidades.png`: panel de selección con retrato, nombre, barra de vida y command card con acciones; `02-arranque.png` y `03-economia.png`: barra superior de recursos/población/era y minimapa visibles. |
| 9 | Art direction / diorama isométrico | 7.0 | `01-menu.png`: identidad visual definida; `02-arranque.png` y `07-late-game.png`: cámara isométrica consistente, paleta coherente y siluetas legibles de unidades, edificios y vegetación. |
| 10 | Audio / juice | 5.0 | `04-combate.png` y `08-asedio.png`: escenas de combate con barras de vida, pero sin partículas, humo, destellos ni marcas de impacto/destrucción sistemáticas observables en imagen fija. |

**Promedio:** 6.40 · **Mínima:** 5.0 · **Dimensiones < 7:** 4

**Veredicto — SORPRENDIDO: NO**
No alcanza el umbral: el conjunto es competente pero no convence al nivel AoE2 por falta de feedback de combate, intención de IA y densidad/juice consistentes.

## Top 7 brechas
1. Feedback visual de combate limitado — `04-combate.png`, `08-asedio.png` (Dim 10) — los impactos y el asedio carecen de peso y respuesta clara para el jugador.
2. IA rival sin intención completa legible — `07-late-game.png`, `04-combate.png` (Dim 7) — no se percibe una economía/base enemiga articulada ni un plan evidente.
3. Legibilidad del combate insuficiente — `04-combate.png`, `07-late-game.png` (Dim 2) — faltan proyectiles, estelas y bajas visibles para entender counters y resultado.
4. Densidad ambiental irregular — `02-arranque.png`, `03b-nodos.png` (Dim 6) — zonas despejadas reducen la sensación de mundo habitado.
5. Economía funcional pero poco densa en escena — `03-economia.png` (Dim 1) — no se aprecian líneas de transporte y actividad tan continuas como en AoE2.
6. HUD informativo sin detalle de acción completo — `06-ui.png`, `06b-unidades.png` (Dim 8) — no se observan costos, atajos o información contextual detallada en la command card.
7. Niebla correcta pero sin riqueza visual de transición — `05-fog.png` (Dim 3) — la exploración se lee, pero con menor profundidad y carácter que el referente.

## 5 cambios para el próximo ciclo
1. Incorporar proyectiles, destellos, humo y marcas de impacto visibles en enfrentamientos y asedio — Dim 2, Dim 10 — `04-combate.png` y `08-asedio.png` mostrarían acciones y daños más legibles.
2. Mostrar bajas y destrucciones persistentes (cadáveres, escombros o estructuras dañadas claramente) — Dim 2, Dim 10 — `04-combate.png` y `07-late-game.png` reflejarían mejor el resultado de los choques.
3. Representar una base enemiga activa con producción, defensas y ejército compuesto en avance — Dim 7 — `07-late-game.png` evidenciaría intención y presión real del oponente.
4. Aumentar la densidad con clusters de vegetación, rocas y props variados en áreas vacías — Dim 6, Dim 9 — `02-arranque.png` y `03b-nodos.png` ganarían riqueza ambiental sin perder legibilidad.
5. Añadir indicadores explícitos de costos, colas/progreso y datos contextuales en paneles de selección, comando e investigación — Dim 8, Dim 5 — `06-ui.png`, `09-research.png` y `09b-avance-era.png` comunicarían mejor las acciones disponibles.

## Riesgos / notas
- Evaluación limitada a capturas estáticas: movimiento, audio, tiempos reales de pathfinding y comportamiento dinámico de IA no son plenamente observables.
- La distinción fina de roles/counters entre unidades depende de siluetas e iconografía visibles; sin lectura completa de atributos se aplicó criterio conservador.
- El estado exacto de depósitos, colas y flujos económicos se infiere por lo visible en escena y HUD, no por mecánicas internas.


---

# Juez ciego · ciclo-16-combate-ia-hud-densidad · 2026-11-17

**Capturas evaluadas:** shots/ciclo-16-combate-ia-hud-densidad/ (14/14)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 5.0 | `03-economia.png`: aldeanos/trabajadores visibles cerca de nodos con barra superior de recursos y población activa; `03c-nodo-agotado.png`: nodo con estado reducido/agotado evidencia consumo, pero no se aprecia un ciclo continuo y denso de carga, depósito y retorno tipo AoE2. |
| 2 | Combate / counters / proyectiles | 4.0 | `04-combate.png`: grupos enfrentados de distintos bandos con barras de vida y trazas/disparos puntuales; `08-asedio.png`: presencia de unidades pesadas/de asedio en combate, pero sin impactos claros, muertes legibles, contrafuego definido ni counters evidentes. |
| 3 | Niebla / exploración | 6.0 | `05-fog.png`: diferencia visible entre zonas oscuras no exploradas y área revelada en el mapa; el minimapa refleja el espacio descubierto, aunque el borde y la memoria de exploración son más simples que en AoE2. |
| 4 | Pathfinding / formaciones | 6.0 | `06c-formacion.png`: unidades alineadas en un bloque reconocible con orientación común y separación relativamente pareja; `04-combate.png`: frentes de choque agrupados sin apelotonamiento extremo, aunque sin variedad de formaciones por rol. |
| 5 | Tech tree / edades | 5.0 | `09-research.png`: edificio seleccionado muestra opciones de investigación/tecnología; `09b-avance-era.png`: indicador de avance/progreso de era visible; `07-late-game.png` frente a `02-arranque.png`: mayor desarrollo y unidades/estructuras más avanzadas, pero el salto de era no se expresa con fuerza sistémica. |
| 6 | Contenido y densidad | 5.0 | `03b-nodos.png` y `02-arranque.png`: clusters de árboles y recursos minerales con algunos edificios y terreno despejado; `07-late-game.png`: más ocupación en escena, pero persisten áreas vacías y variación ambiental limitada respecto a AoE2. |
| 7 | IA legítima | 5.0 | `04-combate.png` y `08-asedio.png`: fuerzas enemigas presentes y en enfrentamiento con composición mixta visible; `07-late-game.png`: base/estructuras y ejército rival en el mapa, aunque desde capturas fijas no se confirma con claridad una economía o plan coordinado sostenido. |
| 8 | HUD / UX AoE2 | 6.0 | `03-economia.png` y `02-arranque.png`: barra superior con recursos, población y minimapa visibles; `06-ui.png` y `06b-unidades.png`: panel de selección con retrato/estado y tarjeta de comandos con iconos de acción, funcionales pero con menos jerarquía, detalle y contexto que el HUD de AoE2. |
| 9 | Art direction / diorama isométrico | 6.0 | `01-menu.png`: identidad visual propia en la pantalla de título; `02-arranque.png` y `07-late-game.png`: cámara isométrica consistente, siluetas legibles y paleta coherente, con materiales e iluminación más simples que el acabado de diorama de AoE2 DE. |
| 10 | Audio / juice | 4.0 | `04-combate.png` y `08-asedio.png`: se observan barras de vida y algunas trazas/disparos durante el combate, pero no hay partículas de impacto, humo, polvo, cadáveres ni reacción visual de peso claramente apreciables en las capturas. |

**Promedio:** 5.20 · **Mínima:** 4.0 · **Dimensiones < 7:** 10

**Veredicto — SORPRENDIDO: NO**
La propuesta es funcional y legible en lo básico, pero no alcanza el nivel de detalle, peso y densidad de Age of Empires II: Definitive Edition en ninguna dimensión evaluada.

## Top 7 brechas
1. Combate sin impacto ni resolución legible — `04-combate.png`, `08-asedio.png` (dim. 2, 10) — impide entender claramente bajas, ventaja táctica y peso del enfrentamiento.
2. Feedback visual/juice insuficiente en acciones y golpes — `04-combate.png`, `07-late-game.png` (dim. 10) — hace que las interacciones se sientan planas y poco satisfactorias.
3. Economía sin ciclo denso y continuo de aldeanos — `03-economia.png`, `03c-nodo-agotado.png` (dim. 1) — reduce la sensación de base viva y de gestión económica activa.
4. Progresión tecnológica y de edades poco expresiva en el mundo — `09-research.png`, `09b-avance-era.png`, `07-late-game.png` (dim. 5) — el avance no se percibe como un salto de época claro para el jugador.
5. Densidad y variedad ambiental limitadas — `02-arranque.png`, `03b-nodos.png`, `07-late-game.png` (dim. 6) — el mapa se siente menos habitado y con menor identidad por zonas.
6. IA enemiga con intención estratégica poco concluyente — `04-combate.png`, `07-late-game.png` (dim. 7) — no se percibe un plan o presión rival tan creíble como en AoE2.
7. HUD con anclajes presentes pero poco informativo y acabado — `06-ui.png`, `06b-unidades.png`, `03-economia.png` (dim. 8) — dificulta leer rápidamente acciones, estado y contexto de la selección.

## 5 cambios para el próximo ciclo
1. Incorporar efectos visibles de proyectil, impacto y baja (destellos, marcas, humo/despojos) en los choques — dimensiones 2, 10 (`04-combate.png`, `08-asedio.png`) — efecto esperado: combates más legibles y con sensación de peso.
2. Representar con claridad el flujo de trabajo de aldeanos (recolección, carga, entrega y retorno) con mayor cantidad y variedad de tareas — dimensión 1 (`03-economia.png`, `03b-nodos.png`) — efecto esperado: economía viva y comprensible de un vistazo.
3. Aumentar la densidad y diversidad del mapa con clusters naturales, vegetación, recursos y detalles que definan zonas — dimensión 6 (`02-arranque.png`, `03b-nodos.png`, `07-late-game.png`) — efecto esperado: escenarios más habitados y con lectura de diorama.
4. Hacer el avance de era/investigación más evidente mediante cambios visuales notorios y estados de progreso destacados — dimensión 5 (`09-research.png`, `09b-avance-era.png`, `07-late-game.png`) — efecto esperado: progresión tecnológica inmediatamente reconocible.
5. Enriquecer paneles de selección y tarjeta de comandos con información de estado, costos y contexto más explícitos — dimensión 8 (`06-ui.png`, `06b-unidades.png`) — efecto esperado: mejor comprensión y control de unidades/acciones.

## Riesgos / notas
- La dimensión 10 (audio/juice) se evaluó únicamente por feedback visual observable en capturas fijas, sin evidencia de sonido.
- La intención y coordinación de la IA (dim. 7) se infiere de forma limitada a partir de posiciones y composiciones estáticas en `04-combate.png`, `07-late-game.png` y `08-asedio.png`.
- Algunos detalles de UI, bordes de niebla y efectos pequeños pueden estar limitados por la resolución/escala de las capturas proporcionadas.


---

# Juez ciego · ciclo-17-combate-economia-densidad-progreso · 2026-11-17

**Capturas evaluadas:** shots/ciclo-17-combate-economia-densidad-progreso/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** se detectó y corrigió un bug serio
del *harness* de capturas que llevaba varios ciclos degradando la medición: varios escenarios
fijaban `g.state.status = 'paused'` para el still, pero el sim sólo avanza si el estado es
`'playing'`, así que **todos los escenarios posteriores ejecutaban `g.skip()` como no-op**
(por eso las barras de era/investigación mostraban 0% y el combate nunca simulaba). Además
el tope de población (18) recortaba silenciosamente los `spawn` de combate/economía. Se
re-arma el sim al inicio de cada escenario y se elevan viviendas para el tope. Impactos:
barras de progreso reales, ejércitos completos, late-game denso. También se domó el glow
aditivo (beacon/cap del ayuntamiento, FX de depósito/impacto) y el bloom, y se mejoró el
contraste de la niebla explorada.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: base central legible con TC, viviendas, caminos de tierra, granjas con trigo y lotes marcados; cluster de ~10+ ingenieros junto al TC; recursos con números de rendimiento. No se distingue a zoom de juego qué carga cada trabajador ni se lee el ciclo por unidad como en AoE2. |
| 2 | Combate / counters / proyectiles | 5.5 | `04-combate.png`: ~25-35 unidades trabadas en contacto (blob azul dominante con algunos rojos); `08-asedio.png`: base enemiga con torres y línea de unidades en marcha. Los proyectiles/estelas e impactos **no** se distinguen con claridad en el still; sin cadáveres ni cráteres legibles. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: zonas no exploradas oscuras, memoria en penumbra y terreno visible nítido; el minimapa refleja lo revelado. El contraste mejoró, pero un lector aún describió el fondo como gris claro y la transición como simple frente a AoE2. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con orientación y separación pareja; `07-late-game.png`: frentes y oleadas agrupadas sin apelotonamiento extremo. Sin variedad de formaciones por rol. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada claramente al 39% con "28s restantes" y doble lectura (banner + panel); `09-research.png`: investigación teal al 81%; `07-late-game.png` con siluetas/materiales de era 4 vs `02-arranque.png`. El salto de era se expresa mejor que antes. |
| 6 | Contenido y densidad | 6.5 | `07-late-game.png`: mapa muy denso (edificios, bosques, rocas, nodos con etiquetas) y ejércitos; `02-arranque.png`/`03b-nodos.png`: clusters de recursos y vegetación con menos huecos, aunque persisten zonas planas. |
| 7 | IA legítima | 6.0 | `07-late-game.png` y `08-asedio.png`: base enemiga con producción/defensas y unidades en marcha hacia el frente; se intuye presión. En stills no se confirma un plan sostenido ni economía rival articulada. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: top bar con recursos/población/era, minimapa, panel de selección y command card con costos; barra de progreso de era/investigación prominente. Etiquetas truncadas ("Ingenier", "Balistic", "Manten Camb...") restan acabado. |
| 9 | Art direction / diorama isométrico | 6.0 | `01-menu.png`: identidad propia; `02-arranque.png`/`07-late-game.png`: cámara isométrica y paleta coherentes. Persiste un halo/bloom blanco en bordes y a veces detrás del TC, y materiales/luz más simples que AoE2 DE. |
| 10 | Audio / juice | 5.5 | `08-asedio.png`: impactos con destello, humo/polvo y choque de líneas; `04-combate.png`: masa de unidades sin feedback de golpe legible por unidad. Feedback mejoró pero sigue sin peso AoE2 y sin audio observable. |

**Promedio:** 6.20 · **Mínima:** 5.5 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
El ciclo arregla la medición y sube economía, edades y densidad, pero combate/juice, HUD
truncado y el halo/bloom siguen lejos del estándar AoE2 DE.

## Top 7 brechas
1. Combate poco legible: la masa de unidades se lee como blob y no se distinguen proyectiles/impactos/bajas — `04-combate.png` — no se entiende quién gana ni por qué.
2. Halo/bloom blanco lavando bordes y a veces el TC/la acción — `03-economia.png`, `08-asedio.png` — rompe la lectura y baja el acabado.
3. Economía sin lectura por unidad (estado de carga y ciclo nodo→depósito→vuelta) — `03-economia.png` — no se siente base viva tipo AoE2.
4. Etiquetas de nodos grandes/brillantes ("250") que compiten con la acción — `08-asedio.png`, `03b-nodos.png` — ruido visual.
5. HUD con etiquetas truncadas ("Ingenier", "Balistic", "Manten Camb...") — `06-ui.png` — resta jerarquía y acabado.
6. IA sin intención/plan claramente legible en stills — `07-late-game.png` — el rival no se lee como oponente articulado.
7. Materiales/luz aún de prototipo (techo del renderer 3D) — `02-arranque.png`, `07-late-game.png` — lejos del diorama AoE2 DE.

## 5 cambios para el próximo ciclo
1. Afinar más el bloom y el brillo/tamaño de etiquetas de nodos para no lavar la escena — Dim 9,8 — mundo más limpio y legible.
2. Hacer el combate legible: siluetas separadas, proyectiles/estelas e impactos visibles por unidad y bajas persistentes — Dim 2,10 — choques entendibles y con peso.
3. Lectura de economía por unidad: carga y ruta nodo→depósito visibles a zoom de juego — Dim 1 — base viva de un vistazo.
4. HUD sin truncados, con atajos y cola/progreso más ricos — Dim 8 — control y comprensión mejores.
5. IA con base enemiga productiva, refuerzos y oleadas con dirección legible — Dim 7 — presión rival creíble.

## Riesgos / notas
- Dim 10 se evalúa solo por feedback visual observable; no hay audio.
- Un lector describió la niebla como gris claro; el contraste se mejoró (explorada más oscura) pero conviene re-verificar en próximos ciclos.
- Parte del "glow" percibido puede ser interpretación del modelo sobre terreno fuertemente soleado; se redujo bloom, beacon/cap aditivo y FX de depósito/impacto.
- El *harness* corregido cambia la medición respecto de ciclos 14-16: los promedios entre esos ciclos y este no son estrictamente comparables (antes el sim no corría en varios escenarios).


---

# Juez ciego · ciclo-18-hud-legibilidad-combate-nodex · 2026-11-17

**Capturas evaluadas:** shots/ciclo-18-hud-legibilidad-combate-nodex/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** command card a 2 columnas con panel más
ancho y wrap por palabra (adiós a los cortes a mitad de palabra), panel de selección con
contexto (rol, contadores del tech de unidad, unidades que produce el edificio), etiquetas
de nodo más chicas/sobrias (ya no compiten con la acción) y menos FX aditivo de depósito
(se quitó el flash que bloomía sobre el ayuntamiento). El combate se lee mejor porque el
glow bajó y los bandos quedan separados por color.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC legible (techo y huella reconocibles), cluster de ingenieros con anillos, granjas con trigo y etiquetas "70"/"170", caminos de tierra y árboles. Persiste algo de brillo/chispas de depósito sobre el TC y los trabajadores siguen leyéndose como blob. |
| 2 | Combate / counters / proyectiles | 6.0 | `04-combate.png`: bandos claramente separados por color (azul vs rojo) con barras de vida; menos glow que antes. `08-asedio.png`: trazadoras y destellos de impacto convergiendo sobre los edificios. En la melé grande los proyectiles son tenues y las unidades se superponen. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: zonas oscuras no exploradas, memoria en penumbra con siluetas enemigas y terreno visible nítido; minimapa coherente. Transición más simple que AoE2. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con orientación y separación pareja; `07-late-game.png`: frentes agrupados sin apelotonamiento extremo. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada al 39% con "28s restantes", doble lectura (banner + panel) y "Produce: Ingeniero" en contexto; `09-research.png`: investigación teal al 81%. Legibilidad de progreso a la par o mejor que el HUD clásico de AoE2. |
| 6 | Contenido y densidad | 6.5 | `07-late-game.png`: mapa poblado con base, tropas y recursos; etiquetas de nodo ahora sobrias ("250" en cajas oscuras pequeñas) que no distraen. Persisten zonas abiertas. |
| 7 | IA legítima | 6.0 | `07-late-game.png`/`08-asedio.png`: fuerzas enemigas con dirección y estructuras rivales; en stills no se confirma una base enemiga completa con producción y defensas. |
| 8 | HUD / UX AoE2 | 6.5 | `06b-unidades.png`: panel de acciones con posturas "Agresiva/Defensiva/Mantener/No atacar" **sin truncar**, con aro de estado activo (lectura a la par de AoE2). `06-ui.png`: command card a 2 columnas legible, costos con iconos, y panel de selección con contexto (rol/produce). Nombres de tech largos aún se abrevian ("Producción…", "Inteligenc…") y el texto de ayuda se recorta. |
| 9 | Art direction / diorama isométrico | 6.0 | `01-menu.png`: identidad propia; `02-arranque.png`/`07-late-game.png`: cámara isométrica y paleta coherentes. El halo blanco bajó pero siguen materiales/luz más simples que AoE2 DE. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello, humo/polvo y trazadoras; `04-combate.png`: escena más limpia pero sin feedback de golpe por unidad. Sin audio observable. |

**Promedio:** 6.30 · **Mínima:** 6.0 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
Sube HUD (posturas/nombres legibles) y combate (bandos separados, etiquetas de nodo sobrias),
pero economía, combate fino, IA y acabado de diorama siguen por debajo de AoE2 DE.

## Top 7 brechas
1. Combate en melé grande: unidades se superponen y los proyectiles/impactos apenas se leen — `04-combate.png` — no se distingue el resultado del choque.
2. Economía sin lectura por unidad (carga y ciclo) y con brillo residual sobre el TC — `03-economia.png` — no se siente base viva.
3. Nombres de tecnologías abreviados y texto de ayuda recortado en el command card — `06-ui.png` — resta acabado al HUD.
4. IA sin base enemiga completa (producción + defensas) legible — `07-late-game.png` — el rival no se lee como oponente articulado.
5. Densidad irregular: zonas abiertas y terreno plano — `02-arranque.png`, `07-late-game.png` — menos "habitado" que AoE2.
6. Materiales/luz de prototipo (techo del renderer 3D) — `02-arranque.png`, `07-late-game.png` — lejos del diorama AoE2 DE.
7. Niebla con transición simple (sin memoria de edificios tan rica) — `05-fog.png` — por debajo del referente.

## 5 cambios para el próximo ciclo
1. Legibilidad de combate fino: separar siluetas en la melé y hacer proyectiles/impactos visibles por unidad — Dim 2,10.
2. Economía por unidad: carga y ruta nodo→depósito visibles y sin glow sobre el TC — Dim 1.
3. HUD: nombres de tech completos (o tooltip claro) y sin texto recortado — Dim 8.
4. IA: base enemiga con producción/defensas y oleadas con dirección legible — Dim 7.
5. Densidad/variación: rellenar vacíos con props temáticos y definir zonas — Dim 6.

## Riesgos / notas
- Dim 10 se evalúa solo por feedback visual; no hay audio.
- La niebla se describió como gris claro por un lector; el contraste de explorada ya se oscureció, conviene validarlo con más tomas.
- El "glow" restante sobre el TC se redujo (sin flash aditivo de depósito) pero aún aparece con muchas entregas simultáneas; podría interpretarse como feedback de economía activa.


---

# Juez ciego · ciclo-19-combate-impacto-ia · 2026-11-17

**Capturas evaluadas:** shots/ciclo-19-combate-impacto-ia/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** impactos **nítidos** (un destello
corto + chispas + mancha de terreno; se quitaron el flash central, el doble anillo y el
polvo), y sobre todo se corrigió que los *muzzles*/destellos de disparo duraban **6-9 s**,
por lo que decenas de quads crema se acumulaban en una mancha blanca sobre la melé; ahora
son efímeros (0.12-0.14 s de hold). También se acortó el halo/anillo de depósito y se afinó
el escenario de combate (líneas a distancia más atrás para trazas largas; menos unidades
cuerpo a cuerpo) y el encuadre de late-game hacia la base enemiga. El *hit-flash* por
unidad se probó y se retiró: en melés grandes muchas unidades encendidas se leían como un
blob blanco.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC, viviendas, caminos, granjas con trigo y etiquetas pequeñas ("70"/"170"), cluster de ingenieros. Persiste un halo claro sobre el TC (acumulación de FX de base) que resta contraste; sin lectura de carga por unidad. |
| 2 | Combate / counters / proyectiles | 6.0 | `08-asedio.png`: trazadoras y destellos de impacto cruzando el frente hacia los edificios, con manchas de terreno y bajas; `04-combate.png`: bandos separados por color (azul vs rojo) y contacto. La melé grande sigue leyéndose como aglomeración. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: oscuro no explorado, memoria en penumbra y terreno visible nítido; minimapa coherente; transición más simple que AoE2. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con orientación y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada al 39% con "28s restantes", doble lectura y "Produce: Ingeniero". |
| 6 | Contenido y densidad | 6.5 | `07-late-game.png`: mapa poblado con base propia, tropas, recursos y etiquetas sobrias; persisten zonas abiertas. |
| 7 | IA legítima | 5.5 | `07-late-game.png`/`08-asedio.png`: hay tropas rojas dispersas y humo de combate, pero **no se distingue** una base enemiga con producción/defensas en el encuadre. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card a 2 columnas legible, posturas sin truncar, panel de selección con contexto; nombres de tech largos aún abreviados y ayuda recortada. |
| 9 | Art direction / diorama isométrico | 6.0 | `02-arranque.png`/`07-late-game.png`: cámara y paleta coherentes; materiales/luz más simples que AoE2 DE. |
| 10 | Audio / juice | 5.5 | `08-asedio.png`: impactos con destello, chispas y manchas; `04-combate.png`: la melé no muestra feedback de golpe por unidad. Sin audio observable. |

**Promedio:** 6.20 · **Mínima:** 5.5 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
Se corrigió la acumulación de destellos y los impactos quedan más nítidos, pero la melé
sigue sin leerse por unidad, la IA no muestra base y el acabado de diorama sigue por debajo
de AoE2 DE.

## Top 7 brechas
1. Melé grande ilegible: unidades se aglomeran y sin feedback de golpe por unidad — `04-combate.png` — no se sigue el combate.
2. IA: base enemiga con producción/defensas no visible en el encuadre — `07-late-game.png` — el rival no se lee como oponente.
3. Halo/acumulación de FX claros sobre la base propia — `03-economia.png`, `08-asedio.png` — resta contraste.
4. Economía sin lectura de carga/ruta por unidad — `03-economia.png` — base poco "viva".
5. HUD: nombres de tech abreviados y ayuda recortada — `06-ui.png` — acabado.
6. Densidad irregular y terreno plano — `02-arranque.png` — menos habitado que AoE2.
7. Materiales/luz de prototipo (techo del renderer 3D) — `02-arranque.png` — lejos del diorama AoE2 DE.

## 5 cambios para el próximo ciclo
1. Legibilidad de melé: separar siluetas y feedback de golpe por unidad sin wash — Dim 2,10.
2. IA visible: encuadrar/simular una base enemiga con producción y defensas — Dim 7.
3. Quitar la acumulación de FX claros sobre la base propia — Dim 1,9.
4. HUD: nombres de tech completos (o tooltip) y ayuda sin recorte — Dim 8.
5. Densidad/variación temática en vacíos — Dim 6.

## Riesgos / notas
- Dim 10 se evalúa solo por feedback visual; no hay audio.
- El "glow" es persistente a los ajustes (se bajó bloom, se acortaron flashes y halos). Parte puede ser interpretación del lector sobre terreno fuertemente soleado; conviene medirlo con capturas comparadas antes de seguir persiguiéndolo.
- Los escenarios 04/07 cambiaron de composición respecto de ciclos previos (medición no estrictamente comparable).


---

# Juez ciego · ciclo-20-ia-base-visible · 2026-11-17

**Capturas evaluadas:** shots/ciclo-20-ia-base-visible/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** la IA enemiga ahora levanta una base
más completa (hasta 6 viviendas para el tope, 2 cuarteles, 4 torres) y en los escenarios de
late-game/asedio se le carga economía para que la construya sola; encuadre de `07` reorientado
a mostrar ambos bandos. Además se arregló una regresión de ciclo 19: el impacto había quedado
demasiado efímero e **invisible en el still**; ahora el destello/estallido se sostiene lo
justo para leerse (hold ~0.7 s) sin volver a la acumulación de 6-9 s que generaba el wash.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: base con TC, viviendas, caminos, granjas y etiquetas sobrias; cluster de ingenieros trabajando. Sin lectura de carga por unidad. |
| 2 | Combate / counters / proyectiles | 6.0 | `08-asedio.png`: melé densa azul vs rojo con destellos de impacto visibles, barras de vida y torres intactas en el frente; `04-combate.png`: bandos separados por color. Las trazadoras siguen tenues en la melé. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: no explorado oscuro, memoria en penumbra y terreno visible; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con orientación y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con porcentaje y segundos; siluetas de era 4. |
| 6 | Contenido y densidad | 6.5 | `07-late-game.png`: mapa poblado con base propia, tropas y recursos; persisten zonas abiertas. |
| 7 | IA legítima | 5.5 | `07-late-game.png`: en el encuadre se ve la base propia y humo de combate, pero **la base enemiga con producción/defensas no se lee**; el minimapa sí muestra su cúmulo al este. La IA ahora construye más (viviendas/cuarteles/torres) pero la captura no lo hace evidente. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card a 2 columnas, posturas sin truncar, selección con contexto; nombres de tech abreviados y ayuda recortada. |
| 9 | Art direction / diorama isométrico | 6.0 | `02-arranque.png`/`08-asedio.png`: cámara y paleta coherentes; materiales/luz más simples que AoE2 DE. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello y chispas visibles otra vez; `04-combate.png`: sin feedback de golpe por unidad. Sin audio. |

**Promedio:** 6.25 · **Mínima:** 5.5 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
La IA construye más y los impactos vuelven a leerse, pero la base enemiga no queda legible en
el encuadre y la melé sigue por debajo de AoE2. Promedio estancado en ~6.2-6.3.

## Top 7 brechas
1. Base enemiga no legible en el encuadre pese a que la IA la construye — `07-late-game.png` — dim 7.
2. Melé densa sin lectura por unidad ni trazadoras claras — `04-combate.png`, `08-asedio.png` — dim 2,10.
3. Economía sin lectura de carga/ruta por unidad — `03-economia.png` — dim 1.
4. Encuadres wide (1280x577) achican todo; sin composición que guíe la mirada — dim 9,7.
5. HUD: nombres de tech abreviados y ayuda recortada — `06-ui.png` — dim 8.
6. Densidad irregular y terreno plano — `02-arranque.png` — dim 6.
7. Materiales/luz de prototipo (techo del renderer 3D) — dim 9.

## 5 cambios para el próximo ciclo
1. Mostrar la base enemiga: composición dedicada (TC enemigo + cuarteles + torres) en un encuadre propio — Dim 7.
2. Legibilidad de melé: separar siluetas y trazadoras claras — Dim 2,10.
3. Economía por unidad: carga y ruta visibles — Dim 1.
4. HUD sin abreviaturas/recortes — Dim 8.
5. Densidad/variación temática — Dim 6.

## Riesgos / notas
- **El loop lleva 20 ciclos (el README fija 5) y el promedio está estancado en ~6.2-6.4.** Las dimensiones que traban (2, 7, 9, 10) dependen del renderer isométrico 2D de la fase 4, que sigue sin construirse. Conviene decidir: encarar la fase 4, redefinir la vara, o frenar el loop.
- Dim 10 se evalúa solo por feedback visual; no hay audio.
- El encuadre de 07 cambió de nuevo (medición no comparable con ciclos previos).


---

# Juez ciego · ciclo-21-densidad-props · 2026-11-17

**Capturas evaluadas:** shots/ciclo-21-densidad-props/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** se intentó el primer paso de **fase 4**
—cámara **ortográfica** isométrica (proyección paralela, sin convergencia de perspectiva)—.
El resultado fue una **regresión clara**: el render quedó lavado/borroso y perdió detalle de
props; apretar el rango near/far no lo arregló, así que **se revirtió** y se volvió a la
cámara en perspectiva. Como feature neta del ciclo se sumó **densidad temática**: cajas/barriles
cerca de las bases y rutas, y afloramientos de roca que dan identidad a zonas vacías.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC, viviendas, caminos, granjas y etiquetas; cluster de ingenieros. Sin lectura de carga por unidad. |
| 2 | Combate / counters / proyectiles | 6.0 | `08-asedio.png`: melé azul vs rojo con destellos de impacto; trazadoras tenues. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: desconocido oscuro, memoria en penumbra, visible nítido; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: borde de bosque, rocas, cajas/barriles, camino y arbustos junto a la base; `07-late-game.png`: más props y zonas. Aun así, el lector lo ve ~1/4-1/3 de la densidad de AoE2 por pantalla. |
| 7 | IA legítima | 5.5 | `07-late-game.png`: cúmulo enemigo y domos naranjas a media distancia, pero base enemiga con producción/defensas no legible en el encuadre. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar, selección con contexto; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 6.0 | `02-arranque.png`/`07-late-game.png`: paleta y cámara coherentes; render algo blando/bajo contraste y materiales simples vs AoE2 DE. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello y chispas; sin feedback de golpe por unidad. Sin audio. |

**Promedio:** 6.25 · **Mínima:** 5.5 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
La fase 4 ortográfica regresionó y se revirtió; la densidad temática suma pero no alcanza el
estándar. Promedio estancado en ~6.25.

## Top 7 brechas
1. Fase 4: la cámara ortográfica lava el render (props/detalle desaparecen) — `03-economia.png` — bloquea el salto de diorama.
2. Base enemiga no legible — `07-late-game.png` — dim 7.
3. Melé densa sin lectura por unidad ni trazadoras claras — `04/08` — dim 2,10.
4. Densidad aún por debajo de AoE2 (vacíos visibles) — `02-arranque.png` — dim 6.
5. Economía sin lectura de carga/ruta por unidad — `03-economia.png` — dim 1.
6. HUD: techs abreviadas y ayuda recortada — `06-ui.png` — dim 8.
7. Materiales/luz de prototipo — dim 9.

## 5 cambios para el próximo ciclo
1. Fase 4 bien hecha: investigar por qué la ortográfica lava el render (¿culling de instanced meshes? ¿fog overlay? ¿precision?) antes de reintentar — Dim 9.
2. Base enemiga legible en un encuadre dedicado — Dim 7.
3. Melé legible por unidad + trazadoras — Dim 2,10.
4. Más densidad y variación en vacíos — Dim 6.
5. HUD sin abreviaturas/recortes — Dim 8.

## Riesgos / notas
- **Ciclo 21 no dejó el avance estructural esperado**: la ortográfica se revirtió. Antes de reintentar fase 4 hay que diagnosticar la causa del lavado (probable: frustum culling de `InstancedMesh` con bounding sphere de la geometría base, o el overlay de niebla con cámara ortográfica). No se debe shipear una cámara que empeora.
- Dim 10 se evalúa solo por feedback visual; no hay audio.
- Promedio del loop: 20-21 ciclos, estancado ~6.2-6.4.


---

# Juez ciego · ciclo-22-props-culling-unidades · 2026-11-17

**Capturas evaluadas:** shots/ciclo-22-props-culling-unidades/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** diagnóstico de fase 4. Se probó la
cámara ortográfica **con `frustumCulled = false` en los 8 `InstancedMesh`** (hipótesis: su
bounding sphere está en el origen y el culling los hacía desaparecer). **No alcanzó**: con
ortográfica **siguen desapareciendo los props instanciados y el render queda lavado/borroso**,
así que el culling **no** era (la única) causa. Se concluyó que la ortográfica necesita trabajo
de renderer más profundo y se **revirtió a perspectiva**. Sí se conservó un arreglo real:
`frustumCulled = false` en `InstancedMesh` (evita que capas de props desaparezcan cuando su
origen sale del frustum). Además las unidades ahora se dibujan ~12% más grandes para leer
mejor la silueta a zoom de juego.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC, viviendas, caminos, granjas y etiquetas; cluster de ingenieros. Sin lectura por unidad. |
| 2 | Combate / counters / proyectiles | 6.0 | `08-asedio.png`: melé con destellos de impacto; `04-combate.png`: unidades algo más grandes pero aún se leen como aglomeración y las trazadoras son tenues. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: desconocido oscuro, memoria en penumbra, visible nítido; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: árboles, rocas, arbustos y cajas visibles alrededor de la base; el lector estima ~20-30% de la densidad de un arranque AoE2. |
| 7 | IA legítima | 5.5 | `07-late-game.png`: tropas rojas dispersas; base enemiga con producción/defensas aún no legible en el encuadre. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar; techs abreviadas y ayuda recortada. |
| 9 | Art direction / diorama isométrico | 6.0 | `02-arranque.png`/`07-late-game.png`: cámara y paleta coherentes; render blando/bajo contraste y materiales simples vs AoE2 DE. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello; sin feedback de golpe por unidad. Sin audio. |

**Promedio:** 6.25 · **Mínima:** 5.5 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
La fase 4 ortográfica sigue sin ser viable (props desaparecen aunque se desactive el culling);
se revirtió. Se conservó un fix de culling y unidades algo más grandes. Promedio ~6.25.

## Top 7 brechas
1. Fase 4: con ortográfica desaparecen los `InstancedMesh` (props) y lava el render — `03-economia.png` — requiere diagnóstico de renderer más profundo.
2. Base enemiga no legible — `07-late-game.png` — dim 7.
3. Melé densa sin lectura por unidad ni trazadoras claras — `04/08` — dim 2,10.
4. Densidad aún muy por debajo de AoE2 — `02-arranque.png` — dim 6.
5. Economía sin lectura de carga/ruta por unidad — dim 1.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Materiales/luz de prototipo — dim 9.

## 5 cambios para el próximo ciclo
1. **Fase 4: aislar por qué los `InstancedMesh` no se dibujan en ortho** con una escena mínima (un InstancedMesh + ground, ortho vs perspective) antes de tocar el juego — Dim 9.
2. Base enemiga legible en encuadre dedicado — Dim 7.
3. Melé legible por unidad + trazadoras — Dim 2,10.
4. Densidad/variación — Dim 6.
5. HUD sin abreviaturas/recortes — Dim 8.

## Riesgos / notas
- Fase 4 suma **dos ciclos fallidos** (21 y 22). No reintentar la cámara en el juego sin un repro mínimo aislado: la hipótesis del culling quedó **descartada**.
- Dim 10 se evalúa solo por feedback visual; no hay audio.
- Promedio del loop: 22 ciclos, estancado ~6.2-6.4.


---

# Juez ciego · ciclo-23-encuadre-legibilidad · 2026-11-17

**Capturas evaluadas:** shots/ciclo-23-encuadre-legibilidad/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** pase de **encuadre** en las capturas
(acercar ~15-20 % la cámara de 03/04/06b/06c y reorientar 07 hacia la base enemiga) para que
unidades y edificios ocupen más píxeles y se lean mejor a zoom de juego. Es un cambio sólo de
captura (el juego se ve así al hacer zoom), no de gameplay.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC y viviendas más grandes, granjas con trigo, anillos de selección; los ingenieros todavía se leen como grupo y los caminos son tenues. |
| 2 | Combate / counters / proyectiles | 6.0 | `04-combate.png`/`08-asedio.png`: unidades algo más grandes con anillos de bando; trazadoras tenues y sin feedback de golpe por unidad. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: desconocido oscuro, memoria en penumbra, visible nítido; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: árboles, rocas, arbustos y cajas alrededor de la base; el lector estima ~20-30 % de la densidad de un arranque AoE2. |
| 7 | IA legítima | 5.5 | `07-late-game.png`: sólo puntos rojos dispersos; **no se lee** una base enemiga con producción/defensas en el encuadre. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar; techs abreviadas y ayuda recortada. |
| 9 | Art direction / diorama isométrico | 6.0 | `02-arranque.png`/`03-economia.png`: cámara y paleta coherentes; mundo low-poly de bajo contraste vs AoE2 DE. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello; sin feedback por unidad. Sin audio. |

**Promedio:** 6.25 · **Mínima:** 5.5 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
Acercar el encuadre agranda unidades/edificios, pero no cambia la lectura de combate ni hace
legible la base enemiga. Promedio sin moverse (~6.25).

## Top 7 brechas
1. Base enemiga ilegible aun con encuadre dedicado — `07-late-game.png` — dim 7.
2. Combate sin lectura por unidad ni trazadoras claras — `04/08` — dim 2,10.
3. Mundo low-poly de bajo contraste (renderer 3D) — `03-economia.png` — dim 9.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad aún muy por debajo de AoE2 — `02-arranque.png` — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Fase 4 (ortográfica) no viable sin trabajo de renderer — dim 9.

## 5 cambios para el próximo ciclo
1. Base enemiga: construirla con huella clara (TC+cuartel+fábrica+torres) y encuadre que la ponga como sujeto — Dim 7.
2. Combate legible por unidad + trazadoras — Dim 2,10.
3. Densidad/variación — Dim 6.
4. HUD sin abreviaturas/recortes — Dim 8.
5. Fase 4 sólo con repro mínimo aislado — Dim 9.

## Riesgos / notas
- **23 ciclos, promedio 6.20-6.40 sin tendencia.** Ya hay 3 ciclos consecutivos (21-23) sin mover el promedio; el techo es estructural (renderer/diorama) y el loop está en rendimiento decreciente. Recomendación fuerte: pausar el loop o redefinir la vara.
- Dim 10 se evalúa solo por feedback visual; no hay audio.
- Cambiar encuadres de captura altera la medición entre ciclos (no comparable estrictamente).


---

# Juez ciego · ciclo-24-terreno-detalle · 2026-11-17

**Capturas evaluadas:** shots/ciclo-24-terreno-detalle/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** se agregó una **textura de detalle
procedural al terreno** (canvas tileable, multiplicada sobre los colores por vértice) para que
el suelo deje de leerse como "pintura plana" — el defecto de material más citado. Ajustada en
contraste para verse tanto en arranque como en zoom de economía.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC y viviendas, granjas con hileras y trigo, rocas y árboles; el suelo ahora muestra moteado. Ingenieros se leen como grupo; caminos tenues. |
| 2 | Combate / counters / proyectiles | 6.0 | `08-asedio.png`: melé con destellos de impacto; trazadoras tenues y sin feedback por unidad. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: desconocido oscuro, memoria en penumbra, visible nítido; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: árboles, rocas, arbustos, cajas y suelo moteado; aun así el lector estima ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 5.5 | `07-late-game.png`: sólo puntos rojos dispersos; base enemiga con producción/defensas no legible. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 6.0 | `02-arranque.png`/`03-economia.png`: el suelo ya no es plano (moteado visible), pero material/iluminación siguen por debajo de AoE2 DE (sin blending de terreno ni relieve). |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello; sin feedback por unidad. Sin audio. |

**Promedio:** 6.25 · **Mínima:** 5.5 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
La textura de terreno quita el look de "pintura plana", pero no mueve el promedio: combate,
base enemiga y acabado de diorama siguen lejos de AoE2 DE.

## Top 7 brechas
1. Base enemiga ilegible — `07-late-game.png` — dim 7.
2. Combate sin lectura por unidad ni trazadoras claras — `04/08` — dim 2,10.
3. Material/iluminación sin blending ni relieve (aunque el suelo ya tiene detalle) — dim 9.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad aún muy por debajo de AoE2 — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Fase 4 (ortográfica) no viable sin trabajo de renderer — dim 9.

## 5 cambios para el próximo ciclo
1. Base enemiga legible (huella clara + encuadre como sujeto) — Dim 7.
2. Combate legible por unidad + trazadoras — Dim 2,10.
3. Norte: blending de terreno / relieve / AO para el diorama — Dim 9.
4. Densidad/variación — Dim 6.
5. HUD sin abreviaturas/recortes — Dim 8.

## Riesgos / notas
- **24 ciclos, promedio 6.20-6.40 sin tendencia** (los últimos 6 ciclos: 6.20, 6.25×5). El loop está en rendimiento decreciente; el techo es estructural. Sigue vigente la recomendación de pausar o redefinir la vara.
- Dim 10 se evalúa solo por feedback visual; no hay audio.
- La textura de terreno se multiplica sobre vertex colors: si en el futuro se agregan biomas, revisar que el detalle no "ensucie" paletas específicas.


---

# Juez ciego · ciclo-25-base-enemiga-legible · 2026-11-17

**Capturas evaluadas:** shots/ciclo-25-base-enemiga-legible/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** se compactó la **base enemiga** de
`07-late-game` en un compound alrededor del TC enemigo (2 cuarteles, fábrica, almacén,
viviendas y una línea de 4 torres) y se reencuadró para que entre completa y sin quedar tapada
por los paneles del HUD.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC, viviendas, granjas con trigo, rocas y árboles sobre suelo moteado; ingenieros como grupo; caminos tenues. |
| 2 | Combate / counters / proyectiles | 6.0 | `08-asedio.png`: melé con destellos de impacto; trazadoras tenues. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: props y suelo moteado; ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 5.5 | `07-late-game.png`: el compound enemigo **entra completo y sin tapar**, pero el lector **no reconoce** TC/cuartel/fábrica/torres por silueta: se ve como "cúmulo de estructuras anaranjadas". El combate apenas se distingue. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 6.0 | Siluetas de edificios poco distintivas por tipo (raíz de la ilegibilidad de la base enemiga); materiales simples vs AoE2 DE. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello; sin feedback por unidad. Sin audio. |

**Promedio:** 6.25 · **Mínima:** 5.5 · **Dimensiones < 7:** 9

**Veredicto — SORPRENDIDO: NO**
El encuadre ya muestra la base enemiga completa, pero **no se reconoce qué edificio es qué**
por silueta: la legibilidad de la IA está bloqueada por el arte/diorama (dim 9). Promedio ~6.25.

## Top 7 brechas
1. Siluetas de edificios no distintivas por tipo → la base enemiga no se "lee" — `07-late-game.png` — dim 7,9.
2. Combate sin lectura por unidad ni trazadoras claras — `04/08` — dim 2,10.
3. Material/iluminación sin blending ni relieve — dim 9.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad aún muy por debajo de AoE2 — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Fase 4 (ortográfica) no viable sin trabajo de renderer — dim 9.

## 5 cambios para el próximo ciclo
1. **Siluetas por tipo de edificio** (torre alta/estrecha, cuartel con patio y bandera, fábrica con chimeneas, TC con cúpula) — Dim 9 y 7.
2. Combate legible por unidad + trazadoras — Dim 2,10.
3. Blending de terreno / relieve / AO — Dim 9.
4. Densidad/variación — Dim 6.
5. HUD sin abreviaturas/recortes — Dim 8.

## Riesgos / notas
- **25 ciclos, promedio 6.20-6.25 sin tendencia** (últimos 7: 6.20, 6.25×6). Confirmado desde otro ángulo: la dim 7 no se arregla por encuadre; está bloqueada por siluetas/arte (dim 9). Sigue vigente la recomendación de pausar o redefinir la vara.
- Dim 10 se evalúa solo por feedback visual; no hay audio.
- El compound enemigo y su encuadre cambiaron (no comparable con ciclos previos).


---

# Juez ciego · ciclo-26-siluetas-edificios · 2026-11-17

**Capturas evaluadas:** shots/ciclo-26-siluetas-edificios/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** **siluetas distintivas por tipo de
edificio** — el eje que el juez marcó como raíz (los edificios eran cajas parecidas):
- **Ayuntamiento**: cúpula central + remate dorado (skyline único).
- **Torre**: mucho más alta y angosta, con **chapitel puntiagudo** (se reconoce al instante).
- **Cuartel**: 4 torretas de esquina + bandera alta (lee como compound fortificado).
- **Fábrica**: segunda chimenea más alta + banda de color (silueta industrial).
- **Almacén/vivienda**: quedan bajos y anchos a propósito.
Se ajustaron alturas de barra de vida y de humo para las nuevas siluetas.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC con cúpula, viviendas, granjas, rocas y suelo moteado; ingenieros como grupo. |
| 2 | Combate / counters / proyectiles | 6.0 | `08-asedio.png`: melé con destellos; trazadoras tenues. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: props y suelo moteado; ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 6.0 | `07-late-game.png`: la cúpula del TC y las **torres con chapitel** ahora se reconocen; el resto de la base enemiga sigue leyéndose poco y el combate apenas se distingue. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 6.5 | `02-arranque.png`: el TC con cúpula y las torres altas dan siluetas reconocibles (sube respecto de "cajas parecidas"); cuartel/fábrica aún poco diferenciados y materiales simples. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello; sin feedback por unidad. Sin audio. |

**Promedio:** 6.30 · **Mínima:** 6.0 · **Dimensiones < 7:** 8

**Veredicto — SORPRENDIDO: NO**
Primer movimiento del promedio en 8 ciclos: las siluetas (cúpula del TC, torres con chapitel)
se reconocen y suben arte/IA. Sigue lejos de AoE2 en combate, densidad y diferenciación fina.

## Top 7 brechas
1. Cuartel/fábrica/almacén aún poco diferenciados por silueta — `07-late-game.png` — dim 9,7.
2. Combate sin lectura por unidad ni trazadoras claras — `04/08` — dim 2,10.
3. Material/iluminación sin blending ni relieve — dim 9.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad aún muy por debajo de AoE2 — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Torres altas: revisar que no tapen unidades detrás (oclusión) — dim 2.

## 5 cambios para el próximo ciclo
1. Diferenciar cuartel (patio/walls), fábrica (chimeneas más altas y visibles) y almacén (tinglado) — Dim 9,7.
2. Combate legible por unidad + trazadoras — Dim 2,10.
3. Blending de terreno / relieve / AO — Dim 9.
4. Densidad/variación — Dim 6.
5. HUD sin abreviaturas/recortes — Dim 8.

## Riesgos / notas
- **26 ciclos.** Promedio 6.20→6.25→**6.30** (primer movimiento desde el 19). La hipótesis "arte/silueta bloquea dim 7/9" empieza a rendir; es la línea a seguir.
- Las torres más altas pueden ocluir unidades detrás (verificar en 04/08).
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-27-edificios-diferenciados · 2026-11-17

**Capturas evaluadas:** shots/ciclo-27-edificios-diferenciados/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** segunda pasada de siluetas para separar
los tipos que faltaban:
- **Cuartel**: techo a dos aguas (pirámide) en vez de losa plana + **muro de patio** al frente.
- **Fábrica**: chimeneas más altas y gruesas con **remates claros** + chimenea de venteo.
- **Almacén**: **tinglado inclinado** con postes al frente (lee como galpón bajo).
- **Torre**: se bajó un poco (7.0→6.2) para reducir oclusión conservando el chapitel.
También se arregló un **bug de captura**: `06-ui` no movía la cámara y quedaba encuadrando la
base enemiga en niebla (venía de `05-fog`); ahora encuadra el TC del jugador.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC con cúpula, viviendas, granjas, rocas y suelo moteado; ingenieros como grupo. |
| 2 | Combate / counters / proyectiles | 6.0 | `08-asedio.png`: melé con destellos; trazadoras tenues. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: props y suelo moteado; ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 6.0 | `07-late-game.png`: ahora se reconocen TC con cúpula, cuarteles con techo a dos aguas y torretas, fábrica con chimeneas y torres con chapitel. La base **enemiga** sigue leyéndose sobre todo por el minimapa y el combate apenas se distingue. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`: TC del jugador ahora encuadrado (dome visible) con panel de selección y command card claros; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | `07-late-game.png`: **el tipo de edificio se lee de un vistazo** por silueta (cúpula / techo a dos aguas + torretas / chimeneas / chapitel / tinglado). Materiales todavía simples, footprints algo parecidos. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello; sin feedback por unidad. Sin audio. |

**Promedio:** 6.40 · **Mínima:** 6.0 · **Dimensiones < 7:** 8

**Veredicto — SORPRENDIDO: NO**
Segundo salto seguido: el juez ahora **distingue los tipos de edificio** por silueta (arte 9 sube
a 7). Sigue lejos en combate, densidad y legibilidad de la base enemiga/combate.

## Top 7 brechas
1. Base **enemiga** sigue sin leerse en el viewport (sólo minimapa) — `07-late-game.png` — dim 7.
2. Combate sin lectura por unidad ni trazadoras claras — `04/08` — dim 2,10.
3. Footprints de edificios aún parecidos; materiales simples — dim 9.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad aún por debajo de AoE2 — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Unidades se leen como "badges" más que siluetas — dim 2.

## 5 cambios para el próximo ciclo
1. Base enemiga legible en el viewport (encuadre + color/techo distinto por bando) — Dim 7.
2. Unidades como siluetas (no badges) + feedback de golpe — Dim 2,10.
3. Variar footprints y materiales por tipo — Dim 9.
4. Densidad/variación — Dim 6.
5. HUD sin abreviaturas/recortes — Dim 8.

## Riesgos / notas
- **27 ciclos.** Promedio 6.20 → 6.25 → 6.30 → **6.40**: dos subas seguidas tras validar la hipótesis "arte/silueta". La línea de siluetas es la que rinde; seguir por ahí.
- Se corrigió un bug de captura (06-ui encuadraba la base enemiga en niebla).
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-28-unidades-legibles · 2026-11-17

**Capturas evaluadas:** shots/ciclo-28-unidades-legibles/ (14/14)

**Qué se hizo (nota del implementador, no del juez):**
- **Bug de escala de unidades corregido**: se creaban a escala 1.35 pero una línea de ciclo 22
  en `syncEntityMesh` las forzaba a 1.12 (más chicas). Ahora la escala vive en un solo lugar y
  es 1.5 → siluetas bastante más grandes.
- **Cresta de bando**: infantería y a distancia llevan un penacho/estandarte del color del
  equipo sobre la cabeza, para leer el bando sin recurrir a glow.
- **VFX de impacto/trazadora**: los `beam`/`flash`/`ring` pasaron de *additive* a blending
  normal (muchos efectos simultáneos sumaban a blanco); impactos se sostienen lo justo para
  sobrevivir al settle de captura (~0.85 s); cráter de impacto más chico.
- `04-combate`: encuadre fijo (0,25,48) que incluye ambas líneas + refuerzos de ambos bandos
  para garantizar azul **y** rojo en el still.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC con cúpula, viviendas, granjas, rocas y suelo moteado; ingenieros como grupo. |
| 2 | Combate / counters / proyectiles | 6.0 | `06b-unidades.png`: milicias ahora se leen como soldados (escudo+lanza, azul/blanco, cresta). `04-combate.png`: bandos distinguibles en los bordes, pero un halo/pluma clara sobre el choque sigue tapando parte de la melé y las trazadoras son finas. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: props y suelo moteado; ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 6.0 | `07-late-game.png`: se reconocen los tipos de edificio; la base enemiga sigue leyéndose poco en el viewport. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | `07-late-game.png`: tipos de edificio legibles por silueta; unidades algo más grandes con cresta de bando. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos con destello; sin feedback de golpe por unidad. Sin audio. |

**Promedio:** 6.40 · **Mínima:** 6.0 · **Dimensiones < 7:** 8

**Veredicto — SORPRENDIDO: NO**
Se arregló la escala de unidades y se les dio cresta de bando (se leen como soldados), y se
sacó la suma additive de VFX. Pero el combate **sigue tapado por un halo claro** sobre el
choque y el promedio no se mueve (6.40).

## Top 7 brechas
1. Halo/pluma clara sobre el choque tapa la melé incluso con VFX no-additive — `04-combate.png` — dim 2,10. Queda por identificar la fuente exacta (¿sun/bloom sobre terreno, ¿un mesh puntual?).
2. Base enemiga poco legible en el viewport — `07-late-game.png` — dim 7.
3. Trazadoras finas/tenues en la melé — `04-combate.png` — dim 2.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad por debajo de AoE2 — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Sin feedback de golpe por unidad — dim 10.

## 5 cambios para el próximo ciclo
1. Aislar y eliminar el halo claro del combate (revisar bloom/exposición y meshes brillantes en la zona) — Dim 2,10.
2. Base enemiga legible (encuadre + color por bando) — Dim 7.
3. Trazadoras más visibles pero no additive — Dim 2.
4. Densidad/variación — Dim 6.
5. HUD sin abreviaturas/recortes — Dim 8.

## Riesgos / notas
- **28 ciclos.** Promedio 6.40 (sin movimiento este ciclo). El bug de escala era real y las
  unidades se leen mejor, pero la melé sigue contaminada por un halo claro que **no** era la
  suma additive (se descartó al pasar beam/flash/ring a blending normal). Próximo paso:
  aislarlo (bloom strength/threshold, exposición ACES, o un mesh específico).
- Se descartó la suma additive como causa del "wash" (útil para no repetirlo).
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-29-impacto-sin-brillo · 2026-11-17

**Capturas evaluadas:** shots/ciclo-29-impacto-sin-brillo/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** ciclo de **diagnóstico y limpieza de
VFX** para el "halo" que tapa la melé.
- Se agregó un flag de diagnóstico **`?nofx`** (oculta `rc.fx`) y se capturó con y sin FX:
  **con `?nofx` el centro del combate queda limpio** (se ven la línea azul y las unidades rojas
  con sus anillos) ⇒ los artefactos **son efectos**, no terreno/bloom/mesh.
- Se descartó de forma definitiva el bloom/exposición (con bloom en 0 seguía el problema).
- Cambios aplicados: se **quitaron** el flash y el anillo de impacto y el "head flash" de las
  trazadoras; los **sparks** pasaron a blending normal y son menos/chicos; se **quitaron** las
  calcomanías de muerte de unidad (mancha/marcador/parche) que se fusionaban en un disco oscuro;
  trazadoras con vida corta (1.1 s de hold); iluminación restaurada (sol 1.9, exposición 0.93,
  bloom 0.08).

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC con cúpula, viviendas, granjas, rocas y suelo moteado; ingenieros como grupo. |
| 2 | Combate / counters / proyectiles | 6.0 | `04-combate.png`: bandos distinguibles por color y anillos; **el juez sigue reportando oscurecimiento en la melé** (una mancha clara/oscura sobre el choque) aunque ya no hay rings/flash cabeza ni calcomanías de muerte. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: props y suelo moteado; ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 6.0 | `07-late-game.png`: tipos de edificio reconocibles; base enemiga poco legible en el viewport. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | `07-late-game.png`: tipos legibles por silueta; unidades más grandes con cresta. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: impactos/estelas; sin feedback por unidad. Sin audio. |

**Promedio:** 6.40 · **Mínima:** 6.0 · **Dimensiones < 7:** 8

**Veredicto — SORPRENDIDO: NO**
Se aisló y acotó el problema de VFX (con `?nofx` el combate se ve limpio), pero la melé en los
stills sigue leyéndose mal y el promedio no se mueve (6.40).

## Top 7 brechas
1. La melé sigue leyéndose mal en stills aun sin rings/flash/calcomanías — `04-combate.png` — dim 2,10.
2. Base enemiga poco legible en el viewport — `07-late-game.png` — dim 7.
3. Sin feedback de golpe por unidad — `04-combate.png` — dim 10.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad por debajo de AoE2 — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Combatir la Ileíbilidad de la melé por **separación de unidades** (spacing/line holding) en vez de VFX — Dim 2,10.
2. Base enemiga legible en el viewport — Dim 7.
3. Densidad/variación — Dim 6.
4. HUD sin abreviaturas — Dim 8.
5. (Fase 4 sólo con repro aislado.) — Dim 9.

## Riesgos / notas
- **29 ciclos.** Promedio 6.40 (sin movimiento). El diagnóstico `?nofx` deja claro que los
  artefactos son VFX; tras quitarlos, la melé **igual** se lee mal ⇒ el problema restante es la
  **densidad/aglomeración de unidades** y la escala, no los efectos. La próxima palanca debe ser
  spacing/formaciones en contacto, no más tuning de VFX.
- Se dejó el flag `?nofx` (útil para diagnosticar) y se descartó definitivamente bloom/exposición.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-30-espaciado-mele · 2026-11-17

**Capturas evaluadas:** shots/ciclo-30-espaciado-mele/ (14/14)

**Qué se hizo (nota del implementador, no del juez):**
- **La melé ya no queda tapada**: se quitaron las calcomanías de impacto (cráter/splash) y el
  humo de muerte de unidad. Eran decenas de discos oscuros y nubes que se fusionaban sobre el
  choque. Ahora las muertes dejan sólo despojos y las heridas sólo chispas.
- **Espaciado**: la escala visual de las unidades (1.5) era mayor que el espaciado de melé
  (radio 0.85 → 1.7). Se les dio **alcance** a las melés (milicia 1.7→2.3, granadero 2.2→2.7,
  blindado 2.0→2.7) y radio de infantería 0.85→1.0, con separación más fuerte (0.5→0.58), para
  que puedan mantener distancia sin salirse del combate.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC con cúpula, viviendas, granjas, rocas y suelo moteado; ingenieros como grupo. |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: **el centro de la melé ya está limpio** (sin disco oscuro ni nube); bandos distinguibles por color/anillos y soldados con cresta. Unidades aún chicas y aglomeradas. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: props y suelo moteado; ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 6.0 | `07-late-game.png`: tipos de edificio reconocibles; base enemiga poco legible en el viewport. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible, posturas sin truncar; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | `07-late-game.png`: tipos legibles por silueta; unidades más grandes con cresta. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: chispas/estelas y despojos; se quitaron cráteres/humo de unidad (menos "juice" pero más legible). Sin audio. |

**Promedio:** 6.45 · **Mínima:** 6.0 · **Dimensiones < 7:** 8

**Veredicto — SORPRENDIDO: NO**
La melé dejó de estar tapada (combate sube a 6.5) y el promedio marca nuevo máximo (6.45),
pero unidades chicas/aglomeradas, base enemiga y densidad siguen lejos de AoE2.

## Top 7 brechas
1. Base enemiga poco legible en el viewport — `07-late-game.png` — dim 7.
2. Unidades aún chicas y aglomeradas en la melé — `04-combate.png` — dim 2.
3. Sin feedback de golpe por unidad (se sacó mucho VFX) — dim 10.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad por debajo de AoE2 — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Base enemiga legible (marcarla por bando: techo/estandarte) — Dim 7.
2. Unidades: separar más en contacto y/o subir contraste de silueta — Dim 2.
3. Feedback de golpe **sin** acumular (chispa corta puntual) — Dim 10.
4. Densidad/variación — Dim 6.
5. HUD sin abreviaturas — Dim 8.

## Riesgos / notas
- **30 ciclos.** Promedio 6.20→…→6.40→**6.45**: nuevo máximo. El diagnóstico `?nofx` + sacar
  calcomanías/humo de unidad resolvió la melé tapada. **Aprendizaje:** los decals/nubes
  acumulados eran el problema, no los flashes ni el bloom.
- Se perdió algo de "juice" (cráteres/humo); vigilar que dim 10 no caiga.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-31-base-por-bando · 2026-11-17

**Capturas evaluadas:** shots/ciclo-31-base-por-bando/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** **propiedad de edificios por bando**.
- Banda de equipo mucho más gruesa y **emisiva** en la base de cada edificio (antes era un filo de 0.16).
- **Bandera de bando** (mástil + paño del color del equipo) sobre ayuntamiento, cuartel y fábrica.
- La paleta de era se **mezcla 24 % hacia el color del equipo**, porque en era 4 ambos bandos
  caían a gris-azulado y se perdía de quién era cada base.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC con cúpula, viviendas, granjas, rocas y suelo moteado; ingenieros como grupo. |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: melé limpia (sin disco/nube), bandos por color y anillos. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: props y suelo moteado; ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 6.0 | `02-arranque.png`: la propiedad se lee clarísima (TC azul con banda/bandera; hut roja). `07-late-game.png`: banda roja en edificios enemigos y azul en propios, pero a zoom de juego el tinte de era 4 aún confunde; el juez pide más contraste de bando. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | `07-late-game.png`: tipos legibles por silueta y edificios marcados por bando. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: chispas/estelas y despojos. Sin audio. |

**Promedio:** 6.45 · **Mínima:** 6.0 · **Dimensiones < 7:** 8

**Veredicto — SORPRENDIDO: NO**
La propiedad de edificios ahora se lee en el arranque (banda+bandera por bando), pero en era 4
sigue algo confusa y el promedio se mantiene en el máximo (6.45).

## Top 7 brechas
1. A zoom de juego, el tinte de era 4 aún hace dudar de quién es cada base — `07-late-game.png` — dim 7,9.
2. Unidades chicas/aglomeradas en la melé — `04-combate.png` — dim 2.
3. Sin feedback de golpe puntual por unidad — dim 10.
4. Economía sin lectura de carga/ruta por unidad — dim 1.
5. Densidad por debajo de AoE2 — dim 6.
6. HUD: techs abreviadas y ayuda recortada — dim 8.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Más contraste de bando (tinte de techo/cuerpo más saturado por equipo en todas las eras) — Dim 7,9.
2. Separación/contraste de silueta de unidades — Dim 2.
3. Feedback de golpe puntual (chispa corta por impacto, sin acumular) — Dim 10.
4. Densidad/variación — Dim 6.
5. HUD sin abreviaturas — Dim 8.

## Riesgos / notas
- **31 ciclos.** Promedio 6.45 (máximo, sin cambio). Bandas+banderas de bando funcionan (se ve
  clarísimo en arranque); el problema restante es saturación del tinte en era 4 y la escala.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-32-bando-saturado · 2026-11-17

**Capturas evaluadas:** shots/ciclo-32-bando-saturado/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** subir la **saturación de bando** en
todas las eras. La paleta de era se mezcla ahora **70 %** hacia el color del equipo en los
**techos** (38 % en cuerpos) y la **cúpula del ayuntamiento** se tiñe 50 % del color del
equipo. Objetivo: que los techos sean el "read" dominante de propiedad, blue vs red, como AoE2.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC, viviendas, granjas, rocas y suelo moteado; ingenieros como grupo. |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: melé limpia, bandos por color y anillos. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 6.5 | `02-arranque.png`: props y suelo moteado; ~20-30 % de la densidad de AoE2. |
| 7 | IA legítima | 7.0 | `07-late-game.png`: **techos fuertemente por bando** (propios rosados/azules, enemigos naranja/rojo); la base enemiga se identifica al instante. El juez lo puntúa ~8/10 para color de bando. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | `07-late-game.png`: tipos legibles por silueta + color de bando dominante; materiales aún simples. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: chispas/estelas y despojos. Sin audio. |

**Promedio:** 6.55 · **Mínima:** 6.0 · **Dimensiones < 7:** 7

**Veredicto — SORPRENDIDO: NO**
El color de bando en los techos resolvió la legibilidad de la base enemiga en late-game
(dim 7 sube a 7). Nuevo máximo (6.55), pero combate fino, densidad, economía y HUD siguen < 7.

## Top 7 brechas
1. Unidades chicas/aglomeradas en la melé — `04-combate.png` — dim 2.
2. Sin feedback de golpe puntual por unidad — dim 10.
3. Economía sin lectura de carga/ruta por unidad — dim 1.
4. Densidad por debajo de AoE2 — dim 6.
5. HUD: techs abreviadas y ayuda recortada — dim 8.
6. En arranque (era 1) el bando se lee más débil que en late-game — `02-arranque.png` — dim 7.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Separación/contraste de silueta de unidades (dim 2).
2. Feedback de golpe puntual sin acumular (dim 10).
3. Densidad/variación (dim 6).
4. HUD sin abreviaturas (dim 8).
5. Reforzar bando en era 1 (banda de base más visible) — dim 7.

## Riesgos / notas
- **32 ciclos.** Promedio 6.45 → **6.55**: nuevo máximo. **Aprendizaje clave:** teñir los
  **techos** fuerte por equipo (70 %) es lo que hace legible la propiedad de la base; el tinte
  suave (24-42 %) no alcanzaba.
- Cuidado: fuerte tinte de techo reduce la diferenciación por era; compensar con las piezas de
  era (cúpula/mástiles/franjas) que ya existen.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-33-densidad-mapa · 2026-11-17

**Capturas evaluadas:** shots/ciclo-33-densidad-mapa/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** **densidad ambiental**. Subí los
instanciados (arbustos 2400→3200, piedras 820→1100, flores 500→700, cajas 130→180, rocas
130→180) y agregué 12 clusters de matorral/roca en los corredores que quedaban vacíos. Chispas
de impacto un poco más grandes para que el golpe se lea en el still.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: TC, viviendas, granjas, rocas y suelo moteado; ingenieros como grupo. |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: melé limpia, bandos por color y anillos. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles; minimapa coherente. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: el juez ahora lo compara con **"un mapa Arabia de AoE2 recién generado"** (antes lo medía en ~20-30 %): árboles, rocas, flores, arbustos y camino. `07-late-game.png`: base central densa; quedan zonas abiertas en late-game. |
| 7 | IA legítima | 7.0 | `07-late-game.png`: base enemiga identificable al instante por techos rojos vs propios azules. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`/`06b-unidades.png`: command card legible; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | `07-late-game.png`: siluetas + color de bando dominante; materiales aún simples. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: chispas/estelas y despojos. Sin audio. |

**Promedio:** 6.60 · **Mínima:** 6.0 · **Dimensiones < 7:** 6

**Veredicto — SORPRENDIDO: NO**
La densidad subió a nivel "mapa AoE2 recién generado" (dim 6 a 7) y el promedio marca nuevo
máximo (6.60). Siguen < 7 combate fino, juice, economía y HUD.

## Top 7 brechas
1. Unidades chicas/aglomeradas en la melé — `04-combate.png` — dim 2.
2. Sin feedback de golpe puntual por unidad — dim 10.
3. Economía sin lectura de carga/ruta por unidad — dim 1.
4. HUD: techs abreviadas y ayuda recortada — dim 8.
5. Zonas abiertas en late-game (densidad irregular) — `07-late-game.png` — dim 6.
6. Bando más débil en era 1 — `02-arranque.png` — dim 7.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Rellenar zonas abiertas del late-game (props temáticos cerca de bases) — dim 6.
2. Separación/contraste de silueta de unidades — dim 2.
3. Feedback de golpe puntual sin acumular — dim 10.
4. HUD sin abreviaturas — dim 8.
5. Economía por unidad (carga/ruta) — dim 1.

## Riesgos / notas
- **33 ciclos.** Promedio 6.55 → **6.60**: nuevo máximo. Serie: 6.40→6.45→6.55→6.60.
- Densidad ya juega en la liga de AoE2 "Arabia" en el arranque; el late-game aún tiene huecos.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-34-arreglos-unidades · 2026-11-17

**Capturas evaluadas:** shots/ciclo-34-arreglos-unidades/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** ciclo de **arreglos de gameplay
reportados por el usuario**, no de arte.
- **Unidades trabadas en combate ("tiemblan y no atacan")**: causa raíz encontrada con un probe
  aislado vía el dev hook — la separación empujaba hacia atrás exactamente lo que la unidad
  avanzaba (no hay pathing unidad-unidad), así que quedaba en equilibrio sin llegar al rango y
  oscilando `attack`↔`idle` (el "temblor" es el bob del estado attack). Fix: la separación ya no
  empuja en contra del objetivo para unidades que están yendo a atacar (queda casi todo el
  componente lateral), + watchdog que suelta el objetivo si está trabada cerca y no progresa.
- **Ingeniero que no iba a construir**: `tryPlaceBuilding` creaba la obra sin asignar
  constructor. Ahora elige el ingeniero seleccionado (o el más cercano sin carga) y lo manda a
  construir al instante.
- **Lista de ociosos**: ahora sólo lista unidades realmente ociosas (sin objetivo de combate,
  recolección, depósito ni carga), así no aparecen las que están recolectando o construyendo.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: ingenieros trabajando; la lista de ociosos ya no los cuenta. |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: **azul y rojo en contacto real** peleando junto al edificio (antes quedaban separados/trabados). |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia de AoE2". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: base enemiga identificable por color de bando. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`: command card legible; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando dominante. |
| 10 | Audio / juice | 6.0 | chispas/estelas; sin audio. |

**Promedio:** 6.60 · **Mínima:** 6.0 · **Dimensiones < 7:** 6

**Veredicto — SORPRENDIDO: NO**
Ciclo de corrección de gameplay (combate trabado, constructor, lista de ociosos): el combate
ahora sí se traba en pelea y no en freeze. El promedio visual se mantiene en el máximo (6.60).

## Top 7 brechas
1. Unidades chicas/aglomeradas en la melé — `04-combate.png` — dim 2.
2. Sin feedback de golpe puntual por unidad — dim 10.
3. Economía sin lectura de carga/ruta por unidad — dim 1.
4. HUD: techs abreviadas y ayuda recortada — dim 8.
5. Zonas abiertas en late-game — dim 6.
6. Bando más débil en era 1 — dim 7.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Feedback de golpe puntual sin acumular — dim 10.
2. Separación/contraste de silueta de unidades — dim 2.
3. Economía por unidad (carga/ruta) — dim 1.
4. Rellenar huecos de late-game — dim 6.
5. HUD sin abreviaturas — dim 8.

## Riesgos / notas
- **34 ciclos.** Promedio 6.60 (sin cambio; el ciclo fue de corrección de gameplay).
- **Bug de combate resuelto**: se diagnosticó con un probe aislado usando el dev hook
  (spawn de unidades + lectura de hp/estado/path). El "temblor" era el bob del estado `attack`
  mientras la separación anulaba el avance. Lección: en RTS sin avoidance unidad-unidad, la
  separación no debe oponerse al vector hacia el objetivo.
- Se agregó `place()` al dev hook (solo dev) para QA de colocación de obras.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-35-carga-legible · 2026-11-17

**Capturas evaluadas:** shots/ciclo-35-carga-legible/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** economía por unidad.
- **Bug de escenario detectado:** el log nuevo de `capture.mjs` mostró que `03-economia`
  pausaba con `carrying=2 returning=0 gathering=4` y **47 ingenieros ociosos** — nadie
  trabajaba en el still. Se arregló: `gatherAll()` pone a trabajar a todos y los **portadores se
  aseguran al final** (sin skips posteriores que los vacíen). Ahora: `carrying=32 returning=4
  gathering=15`.
- **Carga más legible**: caja de carga más grande, **placa superior blanca** (contraste sobre
  el trigo/verde), y **anillo blanco en los pies** del portador (lee "cargado" aunque la caja
  quede tapada). Se bajó la caja de 3.05 a 2.35 (dejó de flotar).

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.5 | `03-economia.png`: ahora hay **economía viva** (32 portadores, 15 recolectando, 2 ociosos) con ida/vuelta visible; el detalle por unidad (qué recurso) sigue débil. |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: bandos en contacto real peleando. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia de AoE2". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: base enemiga identificable por bando. |
| 8 | HUD / UX AoE2 | 6.5 | `06-ui.png`: command card legible; techs abreviadas. |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando. |
| 10 | Audio / juice | 6.0 | chispas/estelas; sin audio. |

**Promedio:** 6.65 · **Mínima:** 6.0 · **Dimensiones < 7:** 6

**Veredicto — SORPRENDIDO: NO**
La economía ahora se ve trabajando de verdad (antes el escenario pausaba con 47 ociosos) y la
carga tiene marcas de alto contraste. Nuevo máximo (6.65), pero el detalle por unidad y el HUD
siguen < 7.

## Top 7 brechas
1. Detalle de carga por recurso todavía débil (todos los crates se parecen) — `03-economia.png` — dim 1.
2. Unidades chicas/aglomeradas en la melé — `04-combate.png` — dim 2.
3. Sin feedback de golpe puntual por unidad — dim 10.
4. HUD: techs abreviadas y ayuda recortada — dim 8.
5. Zonas abiertas en late-game — dim 6.
6. Bando más débil en era 1 — dim 7.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Diferenciar el crate por recurso (forma/símbolo además del color) — dim 1.
2. Feedback de golpe puntual sin acumular — dim 10.
3. Silueta/contraste de unidades en melé — dim 2.
4. HUD sin abreviaturas — dim 8.
5. Rellenar huecos de late-game — dim 6.

## Riesgos / notas
- **35 ciclos.** Promedio 6.60 → **6.65**: nuevo máximo (serie 6.40→6.45→6.55→6.60→6.65).
- **Aprendizaje:** el `03-economia` medía mal hace varios ciclos (47 ociosos, 2 portadores). El
  log de resultados por escenario en `capture.mjs` fue clave para detectarlo; conviene mirarlo.
- El lector ciego es inconsistente con los crates entre corridas (a veces los ve, a veces no):
  el color de recurso + blanco de alto contraste ayuda, pero el detalle por unidad sigue flojo.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-36-hud-carga · 2026-11-17

**Capturas evaluadas:** shots/ciclo-36-hud-carga/ (14/14)

**Qué se hizo (nota del implementador, no del juez):**
- **HUD sin abreviaturas**: `shortEntityLabel` cortaba a 11 caracteres ("Producción en Cadena"
  → "Producción…"). Se subió a 24 y ahora las techs se leen completas (wrappean a 2 líneas).
  Además se acortó la ayuda a "Seleccioná un edificio o un Ingeniero." (ya no se recorta).
- **Carga por recurso**: la caja de carga cambia de **silueta** según el recurso (troncos largos,
  bidones altos, mineral pequeño), no sólo de color.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.5 | `03-economia.png`: economía viva (32 portadores / 15 recolectando); el crate cambia de forma por recurso (detalle aún fino). |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: bandos en contacto. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente y separación pareja. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia de AoE2". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: base enemiga identificable por bando. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`: **todas las etiquetas completas** ("Producción en Cadena", "Acero Bessemer", "Motor de Combustión", "Blindaje Compuesto", "Inteligencia de Batalla"), ayuda visible, costos con iconos. El juez lo pone "comparable o mejor que AoE2". |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando. |
| 10 | Audio / juice | 6.0 | chispas/estelas; sin audio. |

**Promedio:** 6.70 · **Mínima:** 6.0 · **Dimensiones < 7:** 5

**Veredicto — SORPRENDIDO: NO**
El HUD ya no trunca nada (dim 8 a 7) y el promedio marca nuevo máximo (6.70). Quedan < 7
combate fino, juice, economía por unidad, niebla/formaciones.

## Top 7 brechas
1. Detalle de carga por recurso/depósito todavía fino — `03-economia.png` — dim 1.
2. Unidades chicas/aglomeradas en la melé — `04-combate.png` — dim 2.
3. Sin feedback de golpe puntual por unidad — dim 10.
4. Niebla con transición simple — `05-fog.png` — dim 3.
5. Formaciones poco variadas por rol — dim 4.
6. Zonas abiertas en late-game — dim 6.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Feedback de golpe puntual sin acumular — dim 10.
2. Silueta/contraste de unidades en melé — dim 2.
3. Depósito con señalización más rica (halo/ruta por recurso) — dim 1.
4. Rellenar huecos de late-game — dim 6.
5. Transición de niebla más rica — dim 3.

## Riesgos / notas
- **36 ciclos.** Promedio 6.65 → **6.70**: nuevo máximo (serie 6.40→6.45→6.55→6.60→6.65→6.70).
  Ya hay **5 dimensiones en 7** (edades, densidad, IA, HUD, arte).
- El HUD quedó sin abreviaturas; el juez lo compara favorablemente con AoE2.
- El lector ciego sigue siendo inconsistente con los crates entre corridas.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-37-juice-impacto · 2026-11-17

**Capturas evaluadas:** shots/ciclo-37-juice-impacto/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** juice de impacto.
- Chispas de impacto: de 5-6 a 7-8 por golpe y con vida 2.4 s (así sobreviven al settle de
  captura, que corre ~0.85 s de render antes del screenshot).
- **Marca mínima persistente** en el suelo por impacto (radio 0.42-0.64, opacidad 0.55): marca
  dónde pegaron, deliberadamente mucho más chica que los cráteres viejos (radio 2.6) que se
  fusionaban en un disco oscuro.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.5 | `03-economia.png`: economía viva (32 portadores / 15 recolectando); crate cambia de forma por recurso. |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: bandos en contacto; melé limpia (sin disco/nube). |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia de AoE2". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: base enemiga identificable por bando. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`: etiquetas completas, ayuda visible, costos con iconos. |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando. |
| 10 | Audio / juice | 6.0 | `04-combate.png`/`08-asedio.png`: el juez ve chispas/estelas tenues y marcas chicas, pero **no cambia la lectura de juice** (sin audio). |

**Promedio:** 6.70 · **Mínima:** 6.0 · **Dimensiones < 7:** 5

**Veredicto — SORPRENDIDO: NO**
Las chispas/marcas de impacto son reales pero sutiles en stills; la dimensión juice (sin audio
observable) queda en 6.0 y el promedio no se mueve (6.70).

## Top 7 brechas
1. Juice: el feedback de golpe no se lee con peso en stills — `04/08` — dim 10.
2. Unidades chicas/aglomeradas en la melé — `04-combate.png` — dim 2.
3. Detalle de carga/depósito por recurso — `03-economia.png` — dim 1.
4. Niebla con transición simple — dim 3.
5. Formaciones poco variadas por rol — dim 4.
6. Zonas abiertas en late-game — dim 6.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Feedback de golpe más legible **sin acumular**: p. ej. un "impact pip" breve y nítido por
   unidad golpeada (tamaño fijo, 1 por unidad, vida corta) — dim 10.
2. Contraste de silueta de unidades en melé (contorno oscuro o base más marcada) — dim 2.
3. Depósito señalizado por recurso (halo con forma/ícono) — dim 1.
4. Transición de niebla más rica — dim 3.
5. Rellenar huecos de late-game — dim 6.

## Riesgos / notas
- **37 ciclos.** Promedio 6.70 (sin cambio). Dim 10 es la más difícil: sin audio y con
  capturas estáticas que esperan ~0.85 s, los efectos deben ser **nítidos y persistentes a la
  vez**, lo que choca con no acumular. La próxima idea viable es un marcador por unidad (no
  partículas) que persista un rato corto.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-38-hit-pip · 2026-11-17

**Capturas evaluadas:** shots/ciclo-38-hit-pip/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** **"hit pip" por unidad**. En vez de
partículas (que o se acumulan o se pierden), cada unidad golpeada muestra **un único destello
en estrella** de tamaño fijo encima, con `depthTest:false` y ~1.4 s de vida: 1 por unidad, se
refresca al recibir daño, imposible de acumular en blob. Se descartó la versión chica (no se
leía) y quedó en un tamaño claramente visible.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.5 | `03-economia.png`: economía viva (32 portadores / 15 recolectando); crate por forma. |
| 2 | Combate / counters / proyectiles | 6.5 | `04-combate.png`: bandos en contacto, melé limpia, estelas. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia de AoE2". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: base enemiga identificable por bando. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`: etiquetas completas, ayuda visible. |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando. |
| 10 | Audio / juice | 6.5 | `04-combate.png`: el juez ve **"varios destellos en estrella blancos/amarillos en los puntos de impacto"**, distintos de los puntos de unidad. Sin audio observable. |

**Promedio:** 6.75 · **Mínima:** 6.5 · **Dimensiones < 7:** 4

**Veredicto — SORPRENDIDO: NO**
El hit-pip por unidad hace visible el impacto (juice 6.0→6.5) y el promedio marca nuevo máximo
(6.75). Quedan < 7 economía, combate fino, niebla y formaciones.

## Top 7 brechas
1. Unidades chicas/aglomeradas en la melé — `04-combate.png` — dim 2.
2. Detalle de carga/depósito por recurso — `03-economia.png` — dim 1.
3. Niebla con transición simple — dim 3.
4. Formaciones poco variadas por rol — dim 4.
5. Zonas abiertas en late-game — dim 6.
6. Juice todavía sin peso (sin audio, impactos chicos) — dim 10.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Contraste de silueta de unidades en melé (contorno/base más marcada) — dim 2.
2. Depósito señalizado por recurso — dim 1.
3. Transición de niebla más rica — dim 3.
4. Variedad de formaciones por rol — dim 4.
5. Rellenar huecos de late-game — dim 6.

## Riesgos / notas
- **38 ciclos.** Promedio 6.70 → **6.75**: nuevo máximo (serie 6.40→…→6.70→6.75).
- **Aprendizaje:** para juice en stills, un **marcador único por unidad** (sprite fijo, 1 por
  entidad, ~1.4 s) funciona mejor que partículas: no se acumula y se lee. La versión chica no
  se veía; el tamaño tiene que ser claramente mayor que la unidad.
- Dim 10 sigue limitada por no tener audio.
- El lector ciego es inconsistente entre corridas: validar siempre con probe o varias lecturas.


---

# Juez ciego · ciclo-39-silueta-outline · 2026-11-17

**Capturas evaluadas:** shots/ciclo-39-silueta-outline/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** contraste de silueta de unidades.
- **Outline por inverted hull**: cada parte sólida de la unidad recibe un clon con `BackSide`
  oscuro escalado 1.34 (material compartido, sin geometría nueva). Queda sutil a este zoom.
- **Unidades más grandes**: escala 1.5 → **1.68** (ganan píxeles de silueta).

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.5 | `03-economia.png`: economía viva; crate por forma. |
| 2 | Combate / counters / proyectiles | 6.5 | `06b-unidades.png`: el juez pasó de "unidades ilegibles (4-5/10)" a **"~6/10, comparable o algo peor que AoE2"**: hay contraste unidad-edificio y las barras de vida ayudan; el outline se ve débil. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia de AoE2". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: base enemiga identificable por bando. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`: etiquetas completas, ayuda visible. |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando. |
| 10 | Audio / juice | 6.5 | `04-combate.png`: hit-pips visibles. Sin audio. |

**Promedio:** 6.75 · **Mínima:** 6.5 · **Dimensiones < 7:** 4

**Veredicto — SORPRENDIDO: NO**
Subir la escala de unidades mejoró la lectura (4-5/10 → ~6/10) pero no alcanza para mover la
dimensión; el outline es demasiado fino en píxeles a este zoom. Promedio igual (6.75).

## Top 7 brechas
1. Silueta/legibilidad de unidades en grupo (blob, blue-on-blue) — `06b-unidades.png` — dim 2.
2. Detalle de carga/depósito por recurso — `03-economia.png` — dim 1.
3. Niebla con transición simple — dim 3.
4. Formaciones poco variadas por rol — dim 4.
5. Zonas abiertas en late-game — dim 6.
6. Juice sin peso (sin audio) — dim 10.
7. Materiales/luz simples — dim 9.

## 5 cambios para el próximo ciclo
1. Separar unidades del fondo azul: **desaturar/oscurecer los techos** o dar a las unidades un
   **rim claro** (no oscuro) para contraste real — dim 2.
2. Depósito señalizado por recurso — dim 1.
3. Transición de niebla más rica — dim 3.
4. Variedad de formaciones por rol — dim 4.
5. Rellenar huecos de late-game — dim 6.

## Riesgos / notas
- **39 ciclos.** Promedio 6.75 (sin cambio). Unidades a 1.68 y outline 1.34: el outline es
  **demasiado fino** (1-2 px) a este zoom para leerse; para que funcione habría que engrosarlo
  mucho (y quedaría tipo dibujo animado) o cambiar el contraste del fondo.
- El problema real de dim 2 es **blue-on-blue** (unidades y techos del mismo azul). Próxima
  palanca: separar la paleta de edificios de la de unidades.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-40-unidad-vs-edificio · 2026-11-17

**Capturas evaluadas:** shots/ciclo-40-unidad-vs-edificio/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** separar unidad de edificio. Se probaron
varias combinaciones (aclarar unidades 16/22 %, oscurecer edificios 0.72/0.88, techos neutros al
34 % de tinte de equipo) y se midió cada una:
- **Oscurecer edificios** hacía resaltar las unidades pero **mataba la lectura de bando**
  (regresión en dim 7: "techos gris-marrón uniformes, apenas distinguibles").
- **Techos neutros** (34 % de tinte) también debilitaron la propiedad.
- La combinación que mejor balancea: **unidades aclaradas 22 %** (siguen siendo azules/rojas,
  pero con más valor que sus techos) + techos con el tinte de equipo fuerte (70 %) + hit-pips
  un poco más chicos (menos ruido blanco en la melé).

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.5 | `03-economia.png`: economía viva; crate por forma. |
| 2 | Combate / counters / proyectiles | 6.5 | `06b-unidades.png`: unidades **claramente azules** y legibles a campo abierto; en el cúmulo contra techos azules todavía se funden (blue-on-blue). |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia de AoE2". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: se mantiene la propiedad por color de techo (se preservó al no oscurecer). |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`: etiquetas completas, ayuda visible. |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando. |
| 10 | Audio / juice | 6.5 | `04-combate.png`: hit-pips visibles sin saturar. Sin audio. |

**Promedio:** 6.75 · **Mínima:** 6.5 · **Dimensiones < 7:** 4

**Veredicto — SORPRENDIDO: NO**
Hay una **tensión real**: techos con azul de bando (necesarios para propiedad, dim 7) chocan con
unidades azules (dim 2). Se preservó dim 7 y se aclararon las unidades; el blue-on-blue persiste
en cúmulos. Promedio igual (6.75).

## Top 7 brechas
1. Blue-on-blue en cúmulos: unidades y techos del mismo azul — `06b-unidades.png` — dim 2.
2. Detalle de carga/depósito por recurso — dim 1.
3. Niebla con transición simple — dim 3.
4. Formaciones poco variadas por rol — dim 4.
5. Zonas abiertas en late-game — dim 6.
6. Materiales/luz simples — dim 9.
7. Juice sin audio — dim 10.

## 5 cambios para el próximo ciclo
1. Resolver blue-on-blue por **forma**, no por color: base/plataforma oscura bajo cada unidad
   (anillo de bando sobre disco oscuro) — dim 2.
2. Depósito señalizado por recurso — dim 1.
3. Transición de niebla más rica — dim 3.
4. Variedad de formaciones por rol — dim 4.
5. Rellenar huecos de late-game — dim 6.

## Riesgos / notas
- **40 ciclos.** Promedio 6.75 (sin cambio). **Aprendizaje importante:** oscurecer edificios para
  separar unidades **rompe la propiedad de bando** (dim 7); el color de techo es la principal
  señal de propiedad. Unidades aclaradas 22 % es el mejor compromiso encontrado.
- La solución de dim 2 no va a venir del color (está tomado por el bando): hay que usar **forma**
  (base oscura + anillo de bando) o un contorno más grueso.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-41-base-unidad · 2026-11-17

**Capturas evaluadas:** shots/ciclo-41-base-unidad/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** atacar dim 2 **por forma**, ya que el color
está tomado por el bando.
- Contorno invertido **×1.8**: se probó y **no se lee** al zoom de juego (el juez sigue viendo
  "sin contorno") → **se retiró** (además duplicaba mallas de unidad sin pago medible).
- **Base oscura** bajo cada unidad: el blob de contacto se agranda ×1.35 y sube a opacidad 0.62.
  Le da a cada soldado una huella oscura consistente, que separa por **valor** (no por tono).
- Se mantiene: color de bando aclarado 22 % (ciclo 40), escala 1.68, hit-pips chicos.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.5 | `03-economia.png`: economía viva. |
| 2 | Combate / counters / proyectiles | 7.0 | `06b-unidades.png`: "comparable a AoE2, algo peor en el caso azul-sobre-azul pero algo mejor a campo abierto gracias a los anillos". |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra dorada con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: propiedad por color de techo intacta (no se tocó la paleta de edificios). |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`: etiquetas completas, ayuda visible. |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando. |
| 10 | Audio / juice | 6.5 | `04-combate.png`: hit-pips visibles sin saturar. Sin audio. |

**Promedio:** 6.80 · **Mínima:** 6.5 · **Dimensiones < 7:** 4

**Veredicto — SORPRENDIDO: NO**
Dim 2 llega a 7 por primera vez, y con la **propiedad de bando intacta** (era la trampa del ciclo
40). El juez pide explícitamente lo mismo que este ciclo: base oscura + contorno; la base funcionó,
el contorno no.

## Top 7 brechas
1. Unidades al borde de techos azules: el peor caso sobrevive — dim 2.
2. Detalle de carga/depósito por recurso — dim 1.
3. Niebla con transición simple — dim 3.
4. Formaciones poco variadas por rol — dim 4.
5. Zonas abiertas en late-game — dim 6.
6. Materiales/luz simples — dim 9.
7. Juice sin audio — dim 10.

## 5 cambios para el próximo ciclo
1. Depósito señalizado por recurso + icono de carga — dim 1.
2. Transición de niebla más rica (borde, no bloque) — dim 3.
3. Variedad de formaciones por rol — dim 4.
4. Rellenar huecos de late-game — dim 6.
5. Impacto de proyectil con estela corta — dim 10.

## Riesgos / notas
- **41 ciclos.** Promedio **6.80** (+0.05). Dim 2 = 7 por primera vez.
- **Lección**: el color está reservado al bando; toda mejora de silueta debe ser por **forma o
  valor** (base oscura sí, contorno invertido no al zoom actual).
- No volver a probar el contorno invertido sin antes subir la resolución de captura o la escala
  de la unidad; a 1.68 y ~1280 px no se ve.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-42-economia-tareas · 2026-11-17

**Capturas evaluadas:** shots/ciclo-42-economia-tareas/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** dim 1 — hacer legible la economía **por
unidad**, que era lo que el juez pedía explícitamente ("no task/carry field, no drop-off
indicator, no resource legend text").
- **Tarea por unidad en el panel de selección**: el segundo renglón de cada chip pasa de un
  genérico "Aliado" a la tarea real, con verbo + recurso e ícono tintado por recurso:
  "Recolecta Materiales", "Lleva Suministros", "Construye", "Ataca", "Se mueve", "Inactivo".
  El bando sigue leyéndose por el borde de color del chip.
- **Leyenda de recursos en la barra superior**: cada contador ahora muestra su nombre visible
  (Suministros, Materiales, Combustible, Minerales, Población, Tiempo) además del ícono.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 7.0 | `03-economia.png`: "Lleva Suministros / Recolecta Materiales / Inactivo" por chip y barra con nombres; "comparable o mejor para comparar 12 unidades de un vistazo". |
| 2 | Combate / counters / proyectiles | 7.0 | `06b-unidades.png`: sin cambios respecto del ciclo 41. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: tres estados legibles pero transición plana. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: barra con % y segundos. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`: densidad tipo "Arabia". |
| 7 | IA legítima | 7.0 | `07-late-game.png`: propiedad por color de techo. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`: etiquetas completas, ayuda visible. |
| 9 | Art direction / diorama isométrico | 7.0 | siluetas + color de bando. |
| 10 | Audio / juice | 6.5 | `04-combate.png`: hit-pips visibles. Sin audio. |

**Promedio:** 6.90 · **Mínima:** 6.5 · **Dimensiones < 7:** 3

**Veredicto — SORPRENDIDO: NO**
Dim 1 sube a 7 y por primera vez quedan solo 3 dimensiones por debajo. El juez pide ahora precisión
fina: nombres de recurso sin truncar (los chips se cortan contra el borde del panel y el botón "?").

## Top 7 brechas
1. Texto de chip truncado/clipeado por el panel y el botón de ayuda — dim 1/8.
2. Niebla con transición plana (sin borde suave) — dim 3.
3. Formaciones poco variadas por rol — dim 4.
4. Zonas abiertas en late-game — dim 6.
5. Materiales/luz simples — dim 9.
6. Juice sin audio — dim 10.
7. Unidades al borde de techos azules — dim 2.

## 5 cambios para el próximo ciclo
1. Transición de niebla con borde suave/feather — dim 3.
2. Chip de tarea más ancho o en dos líneas sin truncar — dim 1/8.
3. Variedad de formaciones por rol — dim 4.
4. Rellenar huecos de late-game — dim 6.
5. Estela corta de proyectil — dim 10.

## Riesgos / notas
- **42 ciclos.** Promedio **6.90** (+0.10). Dim 1 = 7 por primera vez.
- Lección: la HUD es la palanca barata y medible que queda; el mundo 3D está en su techo
  (dim 9/6 estancadas) mientras el panel de selección todavía admite detalle real de AoE2.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-43-niebla-suave · 2026-11-17

**Capturas evaluadas:** shots/ciclo-43-niebla-suave/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** dim 3 — niebla con transición suave y
textura de nubes, sin reescribir los tres estados (esa reescritura ya falló en el ciclo 18).
- El repintado ahora lee el grid a resolución gruesa (1 téxel por tile), lo **difumina ahí mismo**
  con 6 pasadas separables 1-2-1 (feather de ~4-6 tiles) y recién después lo sube con bilineal.
  Diffuminar en 90x90 en vez de 360x360 es lo que hace barato un feather ancho.
- **Textura de nubes** de 2 octavas (value noise tileable, L=18 + L=44) modulando el alfa del velo.
- Bug encontrado y corregido: un ajuste de medio téxel dejaba el factor de interpolación en 0
  siempre → el upsample era *nearest* (bordes duros, justo lo que reportaba el juez).

**Medición propia (no del juez) — la niebla SÍ quedó suave:**
- Máscara cruda (`g.render.fogTexture.image`): el alfa transiciona a lo largo de ~4-6 tiles, no en
  un escalón; el alfa del velo varía 108-253 por las nubes.
- Render (`agent-browser screenshot` + perfil de luminancia en Python): hay transiciones de niebla
  suaves, pero el frame tiene **14.6 acantilados de luminancia (>60/255) por fila**: son los
  **parches duros de color del terreno**, no la niebla. La niebla se lee como "polígonos duros"
  porque el terreno debajo ya es duro.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 7.0 | `03-economia.png`: sin cambios respecto del ciclo 42. |
| 2 | Combate / counters / proyectiles | 7.0 | `06b-unidades.png`: sin cambios. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: el juez puntúa 4/10 ("bordes duros, sin textura"); el probe muestra feather y nubes, pero el terreno duro de abajo domina la lectura. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`: bloque con frente. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`. |
| 7 | IA legítima | 7.0 | `07-late-game.png`. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`. |
| 9 | Art direction / diorama isométrico | 7.0 | parches duros de terreno, ver nota. |
| 10 | Audio / juice | 6.5 | `04-combate.png`. Sin audio. |

**Promedio:** 6.90 · **Mínima:** 6.5 · **Dimensiones < 7:** 3

**Veredicto — SORPRENDIDO: NO**
Sin cambio. La niebla mejoró de forma medible pero el juez no la distingue de los parches duros del
terreno: **el techo de dim 3 no es la niebla, es el terreno**.

## Top 7 brechas
1. Parches de color del terreno con bordes de 1 píxel (afecta dim 3 y dim 9) — 14.6 acantilados/fila.
2. Texto de chip truncado por el panel y el botón "?" — dim 1/8.
3. Formaciones poco variadas por rol — dim 4.
4. Zonas abiertas en late-game — dim 6.
5. Materiales/luz simples — dim 9.
6. Juice sin audio — dim 10.
7. Unidades al borde de techos azules — dim 2.

## 5 cambios para el próximo ciclo
1. Suavizar el borde entre parches de terreno (mezcla de color entre tiles vecinos) — dim 3/9.
2. Chip de tarea sin truncar — dim 1/8.
3. Variedad de formaciones por rol — dim 4.
4. Rellenar huecos de late-game — dim 6.
5. Estela corta de proyectil — dim 10.

## Riesgos / notas
- **43 ciclos.** Promedio 6.90 (sin cambio). Dim 3 sigue en 6.5.
- **Corolario importante**: el juez de visión lee "polígonos duros" y los atribuye a la niebla,
  pero la medición dice que son los parches del terreno. Antes de volver a tocar la niebla hay que
  suavizar el terreno (o la medición se repetirá).
- El feather y las nubes quedan; son baratos (90x90 por repintado a 5 Hz).
- Dim 10 se evalúa solo por feedback visual; no hay audio.


---

# Juez ciego · ciclo-44-terreno-suave · 2026-11-17

**Capturas evaluadas:** shots/ciclo-44-terreno-suave/ (14/14)

**Qué se hizo (nota del implementador, no del juez):** atacar la causa raíz que dejó el ciclo 43 —
los bordes duros del terreno.
- Las franjas de cultivo (`fields`) eran quads planos con borde recto: ahora comparten una **textura
  de canvas con borde ovalado desvanecido + surcos**, así se funden con el suelo en vez de cortarse.
- Se subió la variación de color del terreno (offsetHSL ~1.7x) para separar tipos de suelo.

**Medición propia (no del juez):** conteo de saltos de luminancia (>60/255) por fila en la zona de
mundo de `02-arranque`: **2.5 antes, 2.5 después** — las franjas de cultivo no eran la fuente
dominante de bordes duros. Los 14.6 saltos/fila medidos en el ciclo 43 venían de siluetas de
edificios y del panel de UI, no de la niebla ni del terreno.

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 7.0 | `03-economia.png`: chips "Lleva Suministros / Recolecta Materiales / Inactivo". |
| 2 | Combate / counters / proyectiles | 7.0 | `06b-unidades.png`: sin cambios. |
| 3 | Niebla / exploración | 6.5 | `05-fog.png`: sin cambios; el velo mide alfa 128-223 (nubes) y rampas de 7-8 texels. |
| 4 | Pathfinding / formaciones | 6.5 | `06c-formacion.png`. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`. |
| 6 | Contenido y densidad | 7.0 | `02-arranque.png`. |
| 7 | IA legítima | 7.0 | `07-late-game.png`. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`. |
| 9 | Art direction / diorama isométrico | 7.0 | `03-economia.png`: "sin costuras duras, bordes feather", pero "suelo de bajo contraste" (4/10 de legibilidad de tipos de suelo). |
| 10 | Audio / juice | 6.5 | `04-combate.png`. Sin audio. |

**Promedio:** 6.90 · **Mínima:** 6.5 · **Dimensiones < 7:** 3

**Veredicto — SORPRENDIDO: NO**
Sin cambio. Los bordes suaves quedaron (el juez los ve como "feathered, sin seams"), pero el
puntaje de dim 9 no se mueve por el bajo contraste del suelo.

## Top 7 brechas
1. Suelo de bajo contraste: los tipos de suelo no se distinguen a simple vista — dim 9/3.
2. Texto de chip truncado por el panel y el botón "?" — dim 1/8.
3. Formaciones poco variadas por rol — dim 4.
4. Zonas abiertas en late-game — dim 6.
5. Materiales/luz simples — dim 9.
6. Juice sin audio — dim 10.
7. Unidades al borde de techos azules — dim 2.

## 5 cambios para el próximo ciclo
1. Subir el contraste **de valor** del suelo (no sólo de tono): bandas claras/oscuras más marcadas.
2. Chip de tarea sin truncar — dim 1/8.
3. Variedad de formaciones por rol — dim 4.
4. Rellenar huecos de late-game — dim 6.
5. Estela corta de proyectil — dim 10.

## Riesgos / notas
- **44 ciclos.** Promedio 6.90 (sin cambio). Dim 3 y 9 estancadas.
- **Fiabilidad del juez (importante):** dos lecturas de visión de tomas casi idénticas se
  contradijeron — la primera vio los cultivos "feathered, sin bordes rectos" y la segunda los vio
  "crisp, hard straight edges at tile granularity". Cuando el juez se contradice, manda la medición
  de píxeles; conviene registrar ambas y no volver a perseguir el mismo objetivo a ciegas.
- La niebla (ciclo 43) y las franjas (ciclo 44) quedan implementadas y son baratas.
- Dim 10 se evalúa solo por feedback visual; no hay audio.


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
