# Juez ciego · ciclo-59-tracer · 2026-11-19

**Capturas evaluadas:** shots/ciclo-59-tracer/ (14/14 frames completos + 6 recortes `-zoom`)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 6.0 | `03-economia.png`: panel con 12 ingenieros (6 "Lleva Suministros", 2 "Recolecta Suministros", 2 "Recolecta Materiales", 2 "Inactivo") y pop 49/78; `03b-nodos.png`: "Nodo de Materiales · Restante 67 · 29%". Pero `03-economia-zoom.png` no muestra **ningún** aldeano junto a los nodos: el ciclo es legible por texto del HUD, no por labor visible. |
| 2 | Combate / counters / proyectiles | 4.0 | `04-combate.png`+`04-combate-zoom.png`: blob de 4–6 unidades interpenetradas; las "trazadoras" son polígonos blancos estirados (glitch de vértices) en abanico, no estelas; 2 destellos de impacto; sin muertes, sin counters identificables, una sola barra de vida. |
| 3 | Niebla / exploración | 7.0 | `05-fog.png`: negro no explorado + velo gris-azul sobre lo explorado, borde con degradado suave (no rectángulo), minimapa espejo con blips, marcadores de recurso persisten en penumbra. Falla la naturalidad: máscara circular tipo viñeta. |
| 4 | Pathfinding / formaciones | 5.0 | `06b-unidades-zoom.png`: 8 unidades en rejilla 2 filas, separadas y orientadas (bien); pero `06c-formacion.png` (14 seleccionadas) es un blob mixto sin frente y `06c-formacion-zoom.png` se desarma en racimo con interpenetración en la retaguardia. |
| 5 | Tech tree / edades | 6.0 | `09-research.png`: "Investigación: Motor de Combustión · 13% · 40s restantes" + "Investigando… · 13% · Produce: Ingeniero"; `09b-avance-era.png`: "Avance de era: Era del Acero · 39% · 28s" y 7 tecnologías con costos. Pero el arsenal/edificios no cambian de silueta entre eras. |
| 6 | Contenido y densidad | 5.0 | `02-arranque.png`: disco de terreno con grandes vacíos y props dispersos ("225" sueltos); `03b-nodos.png` agrupa troncos, granjas y depósitos; `07-late-game.png` llena la pantalla. La base temprana se lee vacía y sin bioma. |
| 7 | IA legítima | 5.0 | `07-late-game.png`: masa enemiga entrando desde arriba-izquierda + blips rojos densos en minimapa; `08-asedio.png`: asalto en curso sobre la base. Dirección sí, composición/defensas enemigas no verificables. |
| 8 | HUD / UX AoE2 | 7.0 | `06-ui.png`: top bar con íconos (Era del Motor · recursos · 56/198 · 1:43), minimapa, command card "ACCIONES" con costos reales, panel "Ayuntamiento · Aliado · Edificio · Operativo · 2200/2200 HP" con barra. Faltan retrato de unidad y tooltips. |
| 9 | Art direction / diorama isométrico | 4.0 | `08-asedio-zoom.png`: edificios como planos coloreados sin bisel ni variación de luz, props flotantes sin sostén (laderas de troncos); `02-arranque.png`/`09b-avance-era.png`: terreno como disco con fondo de espacio. Luz/sombras sí, materialidad no. |
| 10 | Audio / juice | 4.0 | `08-asedio-zoom.png`: un mismo destello blanco de 4 puntas reciclado en cada golpe y un único starburst negro como explosión; sin humo, fuego ni despojos. `03-economia-zoom.png`: cero partículas de recolección. |

**Promedio:** 5.30 · **Mínima:** 4.0 · **Dimensiones < 7:** 8

**Veredicto — SORPRENDIDO: NO**
Un jugador de AoE2 no confundiría este combate glitcheado ni esta economía de contadores con el estándar, y el diorama sigue leyendo como prototipo low-poly sobre un disco de terreno.

## Top 7 brechas
1. El combate es un blob interpenetrado con polígonos blancos estirados por glitch en vez de trazadoras — `04-combate-zoom.png` — el jugador no sabe quién gana ni por qué.
2. Los aldeanos no se ven trabajar: el recorte de detalle de economía no muestra un solo obrero en el ciclo — `03-economia-zoom.png` — la economía se siente contador, no labor.
3. Todos los impactos usan el mismo destello blanco de 4 puntas y una sola explosión (starburst negro) — `08-asedio-zoom.png` — los golpes no tienen peso.
4. Materiales planos sin respuesta a la luz y props flotantes sin sostén — `08-asedio-zoom.png` — rompe la ilusión de diorama.
5. El mapa se lee como un disco chico flotando en un fondo estrellado, con vacíos grandes al inicio — `02-arranque.png` / `09b-avance-era.png` — no hay sensación de mundo habitado.
6. La prueba de formación degenera: 14 unidades mixtas sin frente ni orientación común — `06c-formacion.png` — las órdenes no producen una línea.
7. El panel de selección no tiene retrato de unidad ni tooltips, la command card es un menú de construcción, no contextual — `06-ui.png` — la UI lee como contenedores, no como anclajes AoE2.

## 5 cambios para el próximo ciclo
1. Reemplazar los polígonos estirados por estelas/trazadoras con caída de alfa y dar a cada impacto destello + humo/polvo persistente, manteniendo un frente legible en el cuerpo a cuerpo — dimensiones 2 y 10 — combate claro y con peso.
2. Hacer visible el ciclo económico en el mundo (chispa al recolectar, ícono de carga sobre el aldeano, camino de vuelta) y agrandar la silueta del aldeano para que las líneas se lean a zoom de juego en `03-economia.png` — dimensión 1 — la economía parece trabajo vivo.
3. Añadir estados de baja: despojos o ruinas, tinte de herida y barra de vida sobre cada unidad en combate, más marca/popup de daño — dimensiones 2 y 10 — "muertes legibles".
4. Dar materialidad a edificios (biseles, rugosidad, variación de luz), eliminar props flotantes y unificar el borde del mapa para que lea terreno y no disco espacial en `02-arranque.png` — dimensiones 9 y 6 — coherencia de diorama.
5. Diferenciar siluetas y materiales por era y por clase (milicia vs fusilero vs blindado) para que el salto `02-arranque` → `05-fog` → `07-late-game` sea evidente, con la barra de investigación y su efecto visibles — dimensiones 5 y 4 — la era se siente un salto.

## Riesgos / notas
- Las lecturas de visión fueron **inconsistentes entre tomas** (02/05/06 describen disco/duna azul "en el espacio"; 07/08 describen una base carmesí tipo napoleónico). Puntué sobre los rasgos estables (fog, HUD, baja poligonización, efectos reciclados); parte del detalle puede ser sobreinterpretación del modelo.
- `03c-nodo-agotado.png` no mostraba selección ni panel de nodo (panel inferior vacío): el estado "nodo agotado" no fue verificable.
- Audio es inobservable en capturas fijas; la dimensión 10 se puntuó sólo por feedback visual (dimensión observable, por eso supera el techo por ausencia).
- Si el fondo estrellado es el entorno de render y no el mapa jugable, igual perjudica la lectura de diorama (dimensión 9) y quedó penalizado.
