# Juez ciego · ciclo-58-combate-formacion · 2026-11-19

**Capturas evaluadas:** shots/ciclo-58-combate-formacion/ (13/13 completas + 6 recortes `-zoom`)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: 12 ingenieros con estado por unidad (7 "Lleva Suministros", 2 "Recolecta Suministros", 1 "Recolecta Materiales", 2 "Inactivo"), 4 recursos, 49/78 población; `03b-nodos.png`: panel "Nodo de Materiales · Restante 66 · 29%". Ciclo legible sobre todo por texto, no por líneas de aldeanos en el mapa. |
| 2 | Combate / counters / proyectiles | 5.0 | `04-combate.png`: estallido blanco gigante tapa justo el punto de choque, no se leen líneas ni bajas; `04-combate-zoom.png`: barras blancas superpuestas leídas como geometría, cadáveres planos, sin estelas de trazadora. |
| 3 | Niebla / exploración | 7.0 | `05-fog.png`: círculo nítido sobre la base, anillo de penumbra (explorado) con siluetas, negro desconocido, y minimapa que refleja los mismos estados; el borde interno es duro y la niebla es un domo radial centrado en la base, no memoria por unidad. |
| 4 | Pathfinding / formaciones | 5.0 | `06c-formacion-zoom.png`: nube escalonada, no bloque; unidades embebidas en el edificio azul y anillos solapándose; `06b-unidades-zoom.png`: bloque de dos filas con solape leve. Frente común hacia el enemigo, pero sin filas ni cuña. |
| 5 | Tech tree / edades | 7.0 | `09b-avance-era.png`: "Avance de era: Era del Acero · 39% · 28s restantes" con barra; `09-research.png`: "Motor de Combustión · 13% · 40s"; panel ACCIONES lista 6 tecnologías con costos. Era legible por badge/HUD; el salto de siluetas 05→07 no es evidente. |
| 6 | Contenido y densidad | 6.0 | `02-arranque.png`: isla diminuta en vacío negro, esquinas sin nada; `03b-nodos.png`/`04-combate.png`: clusters de troncos, trigo, rocas y pinos con caminos. Clusters sí, pero props repetidos low-poly y periferia vacía. |
| 7 | IA legítima | 6.0 | `08-asedio.png`: defensores rojos amasados con torres y barras parcialmente vacías; `06b-unidades.png`: infantería roja en filas + tanques enemigos. Composición mixta y defensa, pero sin presión ni avance legible (`07-late-game` parece cola, no ataque). |
| 8 | HUD / UX AoE2 | 8.0 | `06-ui.png`/`03-economia.png`: los cuatro anclajes funcionan — top bar con íconos+valores (recursos/49-78/pop/tiempo/era), minimapa con bandos, command card contextual con costos, panel de selección con retrato, "Ayuntamiento", 2200/2200 HP y estado. Nada tapa el campo. |
| 9 | Art direction / diorama isométrico | 5.0 | `01-menu.png`: modal de intro sobre partida atenuada, no menú principal; `02-arranque.png`: mundo como disco flotando en espacio negro, paleta mezclada (domos azules, techos rosa/magenta, domo rojo). Escala y sombras de unidad OK; materiales planos sin rugosidad/metal. |
| 10 | Audio / juice | 6.0 | `08-asedio.png`: humo, chispas, esquirlas y troncos en vuelo con destello; `04-combate.png`: onda de choque radiante. Pero `04-combate-zoom.png` reduce el impacto a cuadraditos de color y no hay chispa de recolección ni polvo al moverse. |

**Promedio:** 6.10 · **Mínima:** 5.0 · **Dimensiones < 7:** 7

**Veredicto — SORPRENDIDO: NO**
Promedio 6.10 y siete de diez dimensiones por debajo de 7: el HUD y la niebla convencen, pero combate, formaciones, densidad y dirección de arte todavía lo delatan como "de otro juego".

## Top 7 brechas
1. Formación que no forma: `06c-formacion-zoom.png` — unidades solapadas y embebidas en el edificio, sin filas ni frente; el jugador no puede confiar en una orden de formación. — 06c-formacion-zoom / dim 4 — pierde la lectura táctica del bloque.
2. VFX de combate que tapa lo que hay que ver: `04-combate.png` — estallido blanco cubre el choque; `04-combate-zoom.png` — barras blancas que no se leen como trazadora ni impacto. — dim 2 — el jugador no entiende quién gana ni por qué.
3. Mundo como disco en el vacío: `02-arranque.png` — isla en espacio negro con esquinas sin contenido; rompe el diorama AoE2. — dim 9 — se lee como colonia espacial, no como mapa de Imperios.
4. Densidad repetida y vacíos: `02-arranque.png` y `07-late-game-zoom.png` — mismos props low-poly y grandes zonas muertas. — dim 6 — el mapa no se siente habitado.
5. Primera impresión como modal: `01-menu.png` — pantalla de inicio es un diálogo de texto sobre la partida atenuada, sin jerarquía de menú ni arte de identidad. — dim 9 — no hay "portada" que fije el tono.
6. Niebla en domo centrado en la base: `05-fog.png` — borde interno duro y sin memoria por unidad ni siluetas enemigas recordadas. — dim 3 — explorar se siente foco de luz, no descubrimiento.
7. Juice sin sistema en la economía: `03-economia-zoom.png` — ningún aldeano muestra carga ni chispa de recolección; el mundo no reacciona al trabajo. — dim 10 — la economía se lee, no se siente.

## 5 cambios para el próximo ciclo
1. Órdenes de formación reales (fila/cuña) con separación forzada y cero interpenetración, verificable en `06c-formacion.png`. — dim 4 — frente legible y confianza en la orden.
2. Proyectiles con estela, impacto con efecto distinto y bajas que dejan rastro, y achicar/retirar el estallido que cubre el choque en `04-combate.png`. — dim 2 — combate legible con 30 unidades.
3. Reemplazar el disco flotante por un mapa con borde de terreno y unificar paleta/materiales (rugosidad, metal, sombras) en `02-arranque.png`. — dim 9 — diorama AoE2 creíble.
4. Poblar `02-arranque.png` de esquina a esquina: clusters de recursos con variación, caminos y edificios secundarios. — dim 6 — mapa habitado sin saturar.
5. Convertir el arranque en un menú principal con identidad y jerarquía, y pasar ACCIONES a grilla de íconos con costos y atajos (verificado en `01-menu.png`/`06-ui.png`). — dim 8 — primera impresión y UX al nivel AoE2.

## Riesgos / notas
- Audio no observable en capturas fijas: la dim 10 se puntuó solo por juice visual (sin techo por ausencia, ya que sí hay feedback).
- `03c-nodo-agotado.png` no mostró un nodo agotado identificable (nodos seleccionados en cadena con anillos naranjas); la depleción se infirió de `03b-nodos.png` ("Restante 66 · 29%"), no del frame dedicado.
- Ambigüedad de bando/arte en `07-late-game.png`: techos leídos como "rosa/magenta" y unidades "amasadas o en cola"; no pude confirmar si es ejército en batalla o guarnición acumulada.
- `05-fog`, `06-ui` y `09-research` comparten era (Era del Motor) y totales altos; el "salto" era 3→era 4 entre `05-fog` y `07-late-game` es difícil de confirmar solo por siluetas.
- Los recortes se leyeron a resolución nativa; toda dimensión de escala (1,3,5,6,7,8,9) se puntuó sobre el frame completo, como manda la rúbrica.
