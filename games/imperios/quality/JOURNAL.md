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

### Brechas elegidas para el ciclo 07 (juez ciclo 06)
1. **Juice de combate ilegible en stills** — trazadoras/impactos/fogonazos aún poco contundentes en `04-combate`/`08-asedio`.
2. **Economía sin ciclo visible** — falta ver carga/transporte/entrega y flujo nodo→depósito.
3. **HUD/command card sin jerarquía AoE2** — íconos/costos/colas/estados poco legibles en `06-ui`.
4. **Dirección de arte plana** — tope del renderer 3D actual (fase 4 pendiente).
5. **Densidad/composición de mapa pobre** — clusters y señalética insuficientes.
6. **IA sin intención observable** — base/composición/presión enemiga poco claras.
7. **Progresión de eras poco expresiva** — salto visual/funcional limitado entre edades.

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
