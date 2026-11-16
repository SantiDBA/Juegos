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

### Brechas elegidas para el ciclo 10 (siguiente)
Priorizar 1-5 arriba; **fase 4 (renderer 2D isométrico)** sigue siendo el desbloqueo crítico para 9/2/6/4 y el techo AoE2 (criterio: SORPRENDIDO SÍ, promedio ≥ 8.5, ninguna dim < 7).


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
