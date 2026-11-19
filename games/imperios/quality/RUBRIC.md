# RUBRIC · Imperios → Age of Empires II

Rúbrica del juez ciego. Se aplica **sólo** sobre las capturas de una fase
(`quality/shots/<NN-feature>/01-menu.png … 07-late-game.png`), más los recortes de
detalle `<id>-zoom.png` cuando existen. El juez no ve código, ni el JOURNAL, ni
puntajes previos.

**Referencia de comparación:** *Age of Empires II: Definitive Edition*, jugado a escala
normal de partida. No se compara contra el ciclo anterior ni contra otros prototipos.

---

## 0. Cómo puntuar (procedimiento)

1. Mirar las 7 capturas **en orden**, sin ampliar al principio (lectura a distancia de
   juego: ¿se entiende lo que pasa?). Después ampliar para verificar detalles.
2. Por cada dimensión: bajar a la tabla de anclas, elegir el nivel **que la imagen
   sostiene** (3 / 5 / 8 / 10) y ajustar como máximo ±1.
3. Ante empate entre dos niveles → el menor.
4. Escribir la evidencia **antes** que el número. Si no hay evidencia, la dimensión
   no se puntúa: máximo 4.
5. Promedio aritmético de las 10. Ninguna dimensión puede quedar sin número.
6. Emitir el veredicto (`SORPRENDIDO: SÍ / NO`) y el top-7 de brechas.

### El paso "ampliar" tiene su input: los recortes `-zoom.png`

El paso 1 manda ampliar para verificar detalles, pero una captura completa de 2560
px reescala al tamaño del modelo y pierde el detalle fino. Por eso, para las tomas de
detalle, la fase trae **recortes centrados a resolución nativa** (`<id>-zoom.png`):
el **mismo frame**, con menos área, sin reescalar.

- **El frame completo manda sobre la escala.** Toda dimensión que dependa de escala
  (1, 3, 5, 6, 7, 8, 9) se puntúa sobre el frame completo. El recorte no agranda nada:
  si algo "parece grande" en el recorte, no cuenta como más.
- **Los recortes son para verificar detalle** en las dimensiones finas: **2 (combate /
  proyectiles), 4 (formaciones) y 10 (juice)**. Ahí se le pide al juez mirar el recorte
  para decidir si hay o no trazadoras, impactos, líneas de formación, etc.
- Si en el frame completo no se ve algo pero en el recorte sí, **eso cuenta**: el
  recorte es la verificación ("ampliar") que el paso 1 ya exigía.
- Si faltan los recortes (la máquina no tenía herramienta de recorte), se puntúa con
  el frame completo y se anota en `Riesgos / notas` que no hubo verificación de detalle.

### Cómo el juez LEE las imágenes (CRÍTICO — si se ignora, el juicio no vale)

**Método canónico: `games/imperios/quality/judge.sh <fase>`** — corre el juez en una
sesión **headless** (`cmd -p`), que es un proceso/sesión aislado. Es la única forma
confiable en este entorno.

**Por qué no un subagente.** En este entorno, el canal de visión de un subagente **no
devuelve el archivo que el subagente lee**: devuelve la **última imagen ya leída en la
sesión padre**. Verificado de forma controlada: un subagente mandado a leer
`01-menu.png` —y otro a leer un archivo fresco, `07-late-game.png`— describieron la
última captura que había abierto el agente principal. Consecuencia: si el agente
principal ya miró los PNGs, **cualquier subagente juez puntúa a ciegas o mira otra
imagen**, y su veredicto no vale nada. Un proceso headless **sí** ve las imágenes que
lee (probado: el ciclo 57 se puntuó así, con citas correctas de cada toma).

Reglas:
- **Correr el juicio con `judge.sh` (headless), nunca como subagente.** Si querés
  hacerlo a mano, abrí una sesión nueva donde nadie haya leído antes los PNGs de esa
  fase. El implementador **no** abre las capturas; sólo el juez.
- **Fijá el modelo** (`judge.sh <fase> <modelo>` o `-m`): modelos distintos puntúan
  distinto y mezclarlos rompe la comparación entre ciclos.
- **Una imagen por vez**: leer varias en una misma operación devuelve un binario no
  visible.
- **Nunca** leer nada de `quality/calibration/`: esa carpeta calibra al juez, no puntúa
  al juego.
- Si la imagen leída **no coincide** con el archivo pedido, o no se ve, el juez **para
  y lo denuncia** en `Riesgos / notas` y **no puntúa**. (Verificado en el JOURNAL: dos
  jueces subagente devolvieron lecturas inválidas justamente por esto.)

### Escala general

| Rango | Significado |
|---|---|
| 0–1 | Ausente o roto. |
| 2–3 | Placeholder / prototipo. Se ve que existe, no se ve que funcione. |
| 4–5 | Funcional pero genérico. Un jugador de AoE2 lo nota "de otro juego". |
| 6–7 | Competente. Se lee bien, pero no tiene el detalle ni el peso de AoE2. |
| 8–9 | Convence. Un jugador de AoE2 lo acepta sin explicaciones. |
| 10 | Indistinguible del estándar AoE2 en esa dimensión. |

### Las 7 capturas y qué exponen

| Shot | Expone |
|---|---|
| `01-menu.png` | Identidad, jerarquía visual, primera impresión, propuesta de arte |
| `02-arranque.png` | Base inicial, escala, HUD completo, densidad del mapa |
| `03-economia.png` | Recursos, colas, aldeanos trabajando, información económica |
| `04-combate.png` | Líneas, counters, proyectiles, impacto, muertes, feedback |
| `05-fog.png` | Niebla de guerra, exploración, minimapa, era 3 |
| `06-ui.png` | Command card, selección, tooltips, retrato, acciones |
| `07-late-game.png` | Escala final: blindados, densidad, saturación visual, era 4 |

---

## 1. Economía de aldeanos

**Qué mirar:** ¿hay economía viva o sólo contadores? Aldeanos/unidades de trabajo
visibles, en tránsito entre recurso y depósito, cargando, con animación de trabajo.
Nodos de recursos con cantidad legible, colas de producción, población vs tope.

| Nivel | Se ve así |
|---|---|
| **3** | Hay recursos en el mapa y números en el HUD, pero nadie trabaja. Aldeanos quietos, amontonados en la base o inexistentes. |
| **5** | Algunos trabajadores se mueven, pero sin ciclo claro (no se entiende qué llevan ni a dónde). Recursos sin desgaste visible. |
| **8** | Ciclo completo legible: nodo → carga → depósito → vuelta. Varios recursos explotados a la vez, colas visibles, población coherente con la economía. |
| **10** | Economía densa tipo AoE2: líneas de aldeanos en tránsito, nodos consumiéndose, edificios de depósito integrados, todo legible de un vistazo a distancia de juego. |

**Evidencia esperada:** `03-economia.png` + `02-arranque.png` — señalar aldeanos
concretos y su tarea.

## 2. Combate / counters / proyectiles

**Qué mirar:** formación de líneas al chocar, unidades cuerpo a cuerpo y a distancia
coexistiendo, proyectiles en vuelo con trayectoria legible, impacto con efecto, muertes
visibles, daño/estado por unidad (barras, marcas), counters identificables
(milícipe vs fusilero vs blindado).

| Nivel | Se ve así |
|---|---|
| **3** | Unidades enfrentadas quietas o amontonadas; sin proyectiles visibles; no se distingue quién gana ni por qué. |
| **5** | Hay proyectiles y algún efecto, pero el combate se ve "pegoteado": sin líneas, sin muertes legibles, sin counters. |
| **8** | Choque legible: línea propia vs enemiga, proyectiles con estela e impacto, muertes que dejan rastro, barras de vida útiles, counters evidentes. |
| **10** | Combate AoE2: líneas que se mantienen, foco de fuego, artillería con área, cadáveres/ruinas, ritmo de impacto con peso y audio, sin perder legibilidad con 30 unidades. |

**Evidencia esperada:** `04-combate.png` + `07-late-game.png` — enumerar proyectiles,
bajas y estados visibles.

## 3. Niebla / exploración

**Qué mirar:** niebla de guerra con bordes creíbles, diferencia explorado/visible,
terreno no explorado que oculte de verdad (no un velo uniforme), minimapa coherente con
lo revelado, sensación de mapa por descubrir.

| Nivel | Se ve así |
|---|---|
| **3** | No hay niebla, o es un rectángulo oscuro sin relación con la cámara. Todo el mapa se ve siempre. |
| **5** | Hay niebla, pero con bordes duros/sucios y sin estados distintos (explorado ≠ visible). El minimapa no la refleja. |
| **8** | Niebla suave con transición, lo explorado queda en penumbra y lo visible nítido; el minimapa coincide; hay zonas por explorar que dan ganas de ir. |
| **10** | Niebla AoE2: degradado natural sobre el terreno, revelado por unidades, memoria de exploración, minimapa espejo exacto, siluetas de edificios enemigos recordadas. |

**Evidencia esperada:** `05-fog.png` — describir el borde de la niebla y qué oculta.

## 4. Pathfinding / formaciones

**Qué mirar:** en una captura fija se evalúa el **resultado**: unidades alineadas o en
bloque coherente, separación entre unidades (sin interpenetración), orientación
consistente hacia el objetivo, ausencia de apelotonamiento en un punto, columnas al
moverse.

| Nivel | Se ve así |
|---|---|
| **3** | Todas las unidades en un mismo punto o desparramadas al azar; se superponen; ninguna orientación común. |
| **5** | Hay separación, pero la formación es una nube: sin filas, sin frente, sin orientación. |
| **8** | Bloque reconocible (fila, cuña, columna), separación pareja, frente hacia el enemigo, ninguna unidad atravesando a otra. |
| **10** | Formaciones AoE2: infantería en bloque compacto, vehículos detrás, distancia uniforme, frente limpio, y se intuye que el movimiento será ordenado. |

**Evidencia esperada:** `04-combate.png` + `07-late-game.png` — marcar el bloque y su
frente.

## 5. Tech tree / edades

**Qué mirar:** ¿se ve en qué era está la partida y qué desbloquea? Edificios
característicos por era, tecnología en curso con progreso, unidades de era superior
presentes, coherencia estética de la era (1800→2100).

| Nivel | Se ve así |
|---|---|
| **3** | No hay señal de era. Los edificios y unidades no comunican progreso; el HUD no lo dice. |
| **5** | Hay un número de era o alguna unidad nueva, pero nada la explica ni la hace sentir un salto. |
| **8** | La era se lee por el arsenal y los edificios, hay investigación en curso con barra, y el salto entre `05-fog` (era 3) y `07-late-game` (era 4) es evidente. |
| **10** | Progresión AoE2: cada era cambia siluetas, materiales y opciones; el tech tree se intuye por lo construido; investigaciones visibles con tiempo y efecto. |

**Evidencia esperada:** comparar `02-arranque.png` (era 1) con `05-fog.png` (3) y
`07-late-game.png` (4); nombrar qué cambió.

## 6. Contenido y densidad

**Qué mirar:** mapa poblado y compuesto: árboles, minerales, granjas, caminos, rocas,
variación de bioma, props de escala, edificios secundarios. Densidad con aire: lleno sin
ser ruido.

| Nivel | Se ve así |
|---|---|
| **3** | Plano vacío con algunos objetos sueltos. Grandes zonas sin nada. |
| **5** | Hay props, pero repetidos y dispersos; sin agrupación natural ni variación. |
| **8** | Mapa compuesto: clusters de recursos, vegetación con volumen, caminos, props que dan escala, zonas con identidad distinta. |
| **10** | Densidad AoE2: cada pantalla tiene algo que mirar (bosque, aldea, cultivo, ruina), sin tapar la jugabilidad; el mapa se siente habitado. |

**Evidencia esperada:** `02-arranque.png` — recorrer con la mirada las esquinas y
nombrar qué hay en cada una.

## 7. IA legítima

**Qué mirar:** el enemigo como oponente: base desarrollada, ejército compuesto, presión
visible (unidades avanzando, edificios defensivos), sin comportamientos absurdos
(unidades en fila india contra una torre, ejército desintegrado, base sin producir).

| Nivel | Se ve así |
|---|---|
| **3** | No se ve al enemigo, o está congelado en su base sin ejército ni producción. |
| **5** | Hay unidades enemigas, pero sin composición ni intención: sueltas, mal ubicadas, sin defensa. |
| **8** | Base enemiga creíble, ejército compuesto (infantería + apoyo), avance con dirección, estructuras defensivas donde corresponde. |
| **10** | Se lee una partida en curso: el enemigo tiene economía, tecnológica y ejército coordinado; se intuye su plan y su presión sobre el jugador. |

**Evidencia esperada:** `07-late-game.png` + `04-combate.png` — describir composición y
dirección del ejército enemigo.

## 8. HUD / UX AoE2

**Qué mirar:** los cuatro anclajes de AoE2: **top bar** (recursos con íconos, población,
edad, tiempo), **minimapa** (informativo, con colores por bando y terreno), **command
card** (acciones contextuales al seleccionar, con íconos y costos), **panel de selección**
(retrato, nombre, vida, estado). Más tooltips, colas de producción y jerarquía tipográfica.

| Nivel | Se ve así |
|---|---|
| **3** | HUD mínimo o roto: números sin íconos, sin panel de selección, sin command card; elementos desalineados o tapando el juego. |
| **5** | Están los contenedores, pero son cáscaras: minmapa decorativo, command card vacía o genérica, tipografía sin jerarquía. |
| **8** | Los cuatro anclajes funcionan y se leen de un vistazo; command card con acciones reales y costos; minimapa informativo; selección con vida y estado; nada tapa el campo de juego. |
| **10** | HUD AoE2: íconos legibles a 100 %, costos, atajos, cola con progreso, retrato, tooltips útiles, minimapa accionable, y una estética de madera/metal coherente con el juego. |

**Evidencia esperada:** `06-ui.png` (command card + selección) y `03-economia.png`
(top bar). Nombrar cada anclaje visible.

## 9. Art direction / diorama isométrico

**Qué mirar:** ¿lee como diorama AoE2? Cámara isométrica consistente, escala relativa
unidad/edificio/árbol, paleta unificada, materiales con respuesta a la luz, siluetas
distinguibles por clase, sombras que anclan al suelo, profundidad por capas.

| Nivel | Se ve así |
|---|---|
| **3** | Materiales planos, colores de primario, luces sin dirección; la escala rompe la ilusión (unidades gigantes o edificios de juguete). |
| **5** | Hay intento de estilo, pero mezcla de lenguajes: props de distinta factura, paleta inconsistente, sombras débiles. |
| **8** | Diorama coherente: cámara y escala creíbles, paleta unificada, materiales con rugosidad y metal, siluetas por clase, sombras que asientan todo en el terreno. |
| **10** | Diorama AoE2: mundo de miniatura habitable, luz de hora del día, detalle en cada capa (terreno, props, unidades, edificios), sin un solo elemento que rompa la ilusión. |

**Evidencia esperada:** `01-menu.png` (identidad) + `02-arranque.png` (mundo). Mencionar
paleta, luz y escala.

## 10. Audio / juice

**Qué mirar:** en capturas fijas se juzga el **feedback visual y su intención**: partículas
de impacto, fogonazos, humo, polvo, destellos de recolección, sacudida de cámara,
marcadores de daño, estados de unidad (herida, ataque, muerte), animación con peso
silueteada, y cualquier indicio de diseño sonoro (iconografía de sonido, mezcla,
indicadores de evento). La ausencia total de feedback es el defecto más caro.

| Nivel | Se ve así |
|---|---|
| **1–3** | Nada: unidades rígidas, sin partículas ni destellos, sin marcas de impacto; el mundo no reacciona. |
| **5** | Algún efecto aislado (una explosión, una barra), sin sistema: no hay consistencia ni peso. |
| **8** | Feedback sistemático: impacto con partículas y destello, polvo al moverse, recolección con chispa, muerte con despojos, cámara que acompaña los golpes grandes. |
| **10** | Juice AoE2: cada acción tiene respuesta visual y sonora, con peso y contención; el combate se siente antes de leerlo, sin saturar ni marear. |

**Evidencia esperada:** `04-combate.png` + `07-late-game.png` — describir un impacto
concreto y qué se ve alrededor.

---

## Formato exacto de salida del juez

El juez devuelve **exactamente** esta estructura, sin secciones extra y sin prosa previa:

```markdown
# Juez ciego · <NN-feature> · <YYYY-MM-DD>

**Capturas evaluadas:** shots/<NN-feature>/ (7/7)

| # | Dimensión | Puntaje | Evidencia (captura + qué se ve) |
|---|---|---:|---|
| 1 | Economía de aldeanos | 0.0 | <archivo>: <detalle observable> |
| 2 | Combate / counters / proyectiles | 0.0 | <archivo>: <detalle observable> |
| 3 | Niebla / exploración | 0.0 | <archivo>: <detalle observable> |
| 4 | Pathfinding / formaciones | 0.0 | <archivo>: <detalle observable> |
| 5 | Tech tree / edades | 0.0 | <archivo>: <detalle observable> |
| 6 | Contenido y densidad | 0.0 | <archivo>: <detalle observable> |
| 7 | IA legítima | 0.0 | <archivo>: <detalle observable> |
| 8 | HUD / UX AoE2 | 0.0 | <archivo>: <detalle observable> |
| 9 | Art direction / diorama isométrico | 0.0 | <archivo>: <detalle observable> |
| 10 | Audio / juice | 0.0 | <archivo>: <detalle observable> |

**Promedio:** 0.00 · **Mínima:** 0.0 · **Dimensiones < 7:** n

**Veredicto — SORPRENDIDO: NO**
<una sola línea: por qué sí o por qué no, sin matices diplomáticos>

## Top 7 brechas
1. <brecha observable> — <captura> — <efecto que produce en el jugador>
2. …
3. …
4. …
5. …
6. …
7. …

## 5 cambios para el próximo ciclo
1. <cambio concreto y verificable en capturas> — <dimensión que mueve> — <efecto esperado>
2. …
3. …
4. …
5. …

## Riesgos / notas
- <dudas de lectura, dimensiones no observables, ambigüedades>
```

### Reglas de formato

- **10 filas, siempre.** Si una dimensión no es observable, va con su puntaje tope por
  ausencia (≤ 4) y la evidencia dice "no observable en 7/7 capturas".
- **Promedio con dos decimales**, sin redondeo hacia arriba; mínima con un decimal.
- **Una línea de veredicto**, sin párrafo. `SORPRENDIDO: SÍ` sólo si además se cumple
  promedio ≥ 8.5 y ninguna < 7; si no, es `NO` aunque el juez se haya sorprendido.
- **Exactamente 7 brechas y exactamente 5 cambios.** Ni 6 ni 9.
- Cada brecha y cada cambio citan al menos una captura o una dimensión.
- Prohibido proponer código, librerías o arquitectura: se describen efectos observables.
- Prohibido mencionar el ciclo anterior o el esfuerzo invertido.

### Chequeo final del juez (antes de entregar)

- [ ] ¿Cada fila tiene evidencia con nombre de archivo?
- [ ] ¿Algún puntaje se explica sólo por "está mejor que antes"? → recalibrar contra AoE2.
- [ ] ¿Alguna dimensión está en 8+ sin que un extraño pueda señalar el rasgo?
- [ ] ¿El veredicto sobrevive al chequeo de las tres condiciones (sorpresa, promedio, mínima)?
- [ ] ¿Hay exactamente 7 brechas y 5 cambios?
