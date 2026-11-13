# Imperios · harness de calidad (rumbo a Age of Empires II)

Este directorio contiene **sólo el andamiaje de medición**: no hay código del juego acá.
Su trabajo es responder, ciclo tras ciclo y sin autoengaño, una pregunta:

> ¿Estas capturas le provocan a alguien que jugó Age of Empires II la sensación de
> *"esto es un AoE2"*, o todavía se ve como un prototipo de Three.js?

El juez es ciego y puntúa **imágenes**, no intenciones. El código, los TODOs y el roadmap
no cuentan como evidencia.

```
quality/
  README.md      este protocolo
  RUBRIC.md      rúbrica completa (10 dimensiones, anclas 3/5/8/10, formato del juez)
  JOURNAL.md     historial: baseline + una fila por ciclo
  capture.mjs    capturas deterministas vía agent-browser (7 shots por fase)
  shots/
    <NN-feature>/01-menu.png … 07-late-game.png
```

---

## 1. Requisitos del entorno

1. `npm run dev` (Vite, puerto 5173).
2. El **dev hook** inyectado en la página, sólo en modo dev:

   ```ts
   window.__imperios = {
     state, render,
     spawn(team, type, n, x, z),
     give(amount), setEra(era),
     select(ids), entityIds(), skip(seconds),
   }
   ```

   `state.entities` es un `Map<number, AnyEntity>`; cada entidad tiene `kind`
   (`'unit' | 'building' | 'resource'`), `team` y, si es edificio, `btype`
   (p. ej. `'ayuntamiento'`). El script de capturas depende de esa forma.
3. `agent-browser` instalado y en el PATH.

Si falta el hook o el server, `capture.mjs` falla con un mensaje explícito y **no**
genera capturas parciales fuera de `quality/shots/`.

---

## 2. Comandos

```bash
# capturas de la fase en curso
node games/imperios/quality/capture.mjs http://localhost:5173/games/imperios/ fase-0

# typecheck + build (debe pasar antes de capturar; un build roto invalida el ciclo)
npm run typecheck
npm run build
```

Las capturas van a `quality/shots/<fase>/`, con `<fase>` = 3.er argumento
(default `current`). Usá nombres `NN-slug`: `fase-0`, `01-economia`, `02-combate`, …

Las 7 capturas son siempre las mismas, en el mismo orden, con la misma mutación de
estado. Eso es lo que permite comparar ciclos: **si cambiás el escenario, cambia la
medición y hay que registrar el cambio en el JOURNAL.**

| # | Archivo | Qué muestra | Cómo se produce |
|---|---------|-------------|-----------------|
| 1 | `01-menu.png` | pantalla de inicio / overlay | carga + `networkidle` |
| 2 | `02-arranque.png` | partida recién empezada, base del jugador | click en `#start`, espera de intro de cámara (1800 ms) |
| 3 | `03-economia.png` | economía real: 8+ ingenieros trabajando nodo→depósito | `assignEconomy(8)` + 6 s reales (sin `give`) |
| 3b | `03b-nodos.png` | nodo de recurso seleccionado con cantidad restante | `select([nodeId])` sobre un `resource` de `state.entities` |
| 4 | `04-combate.png` | choque de infantería + fuego a distancia con VFX | 3 `spawn` + `skip(4)` + cámara al centroide |
| 5 | `05-fog.png` | niebla / exploración en era 3 | `setEra(3)` + `skip(2)` + `fog()` |
| 6 | `06-ui.png` | ayuntamiento seleccionado, command card visible | búsqueda del TC en `state.entities` + `select([id])` |
| 6b | `06b-unidades.png` | 6 unidades propias seleccionadas (barras + posturas) | `spawn` + `select` de las milicias |
| 6c | `06c-formacion.png` | formación en cuña ordenada al mismo grupo | `moveFormation(ids, x, z, 'wedge')` + espera |
| 7 | `07-late-game.png` | era 4: tanques + MLRS vs tanques autónomos | `give(20000)`, `setEra(4)`, 3 `spawn`, `skip(10)` |
| 8 | `08-asedio.png` | asedio a la base enemiga con su torre y ejército | `camera(55,0)` + `spawn` de asalto + `skip(6)` |

Por qué hay esperas reales: el juego avanza con `requestAnimationFrame`. Entre mutar el
hook y capturar hay que dejar correr frames (`setTimeout`), o la imagen sale con el
estado anterior.

---

## 3. Protocolo del loop

Cada ciclo es **una feature verificable**, no un conjunto de cambios sueltos.

```
┌─ 1. Implementar la feature ────────────────────────────────────────────┐
│   Un cambio con hipótesis explícita: "esto debería subir X de A a B".  │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌─ 2. Typecheck + build ─────────────────────────────────────────────────┐
│   npm run typecheck && npm run build.                                  │
│   Build roto ⇒ ciclo inválido: se arregla antes de capturar.           │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌─ 3. Capturas deterministas ────────────────────────────────────────────┐
│   capture.mjs → shots/<NN-feature>/01-menu.png … 07-late-game.png     │
│   Mismos 7 escenarios siempre. Cero capturas "elegidas a mano".        │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌─ 4. Juez ciego con rúbrica ────────────────────────────────────────────┐
│   Sólo ve las imágenes (RUBRIC.md). No ve el código, ni el JOURNAL,    │
│   ni los puntajes anteriores. 10 dimensiones 0-10 + evidencia.         │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
                    ┌───────────┴───────────┐
               SORPRENDIDO: SÍ        SORPRENDIDO: NO
                    │                       │
                    ▼                       ▼
                 cerrar el loop      5. Aplicar el top-5 de brechas
                                             │
                                             └── repetir (máx. 5 ciclos)
```

### Paso 4 — criterio de aceptación (los cuatro a la vez)

Un ciclo **pasa** sólo si se cumplen los cuatro:

1. **`SORPRENDIDO: SÍ`** — el juez declara que, viendo sólo estas capturas, se
   sorprendió: no esperaba este nivel de un proyecto propio.
2. **Promedio ≥ 8.5** sobre las 10 dimensiones.
3. **Ninguna dimensión < 7.**
4. **Evidencia obligatoria** — cada puntaje cita la captura y lo que se ve en ella
   ("en `04-combate.png` los proyectiles no dejan rastro de impacto"). Un puntaje sin
   evidencia visual se descarta y se vuelve a puntuar.

Si falla cualquiera de los cuatro, el ciclo **no** pasa. No hay promedio compensatorio:
un 2 en audio no se tapa con dos 10.

### Paso 5 — priorización

El juez devuelve **top 7 brechas**; el implementador elige las **5 de mayor impacto
visual-por-esfuerzo** y las aplica en el ciclo siguiente. Las 2 restantes quedan
anotadas en el JOURNAL (no se pierden, se postergan).

### Límites

- **Máximo 5 ciclos.** Si al 5.º no hay `SORPRENDIDO: SÍ`, el loop se detiene y se
  reporta honestamente el estado (con el historial de puntajes). No se estira el loop
  ni se baja la vara.
- Una feature por ciclo. Si una idea necesita tres sistemas, se parte.
- Nada de "arreglos de captura" (cambiar cámara, esconder UI, subir el bloom para la
  foto). Si el juego no se ve así jugando, no puede verse así en las capturas.

---

## 4. Rúbrica (resumen — detalle en `RUBRIC.md`)

Diez dimensiones, 0–10 cada una. El promedio aritmético es el puntaje del ciclo.

| # | Dimensión | Qué se evalúa en las capturas |
|---|-----------|-------------------------------|
| 1 | **Economía de aldeanos** | Aldeanos visibles, yendo y viniendo de recursos, colas de producción, economía legible |
| 2 | **Combate / counters / proyectiles** | Choque de líneas, counters claros, proyectiles y efectos de impacto, muertes |
| 3 | **Niebla / exploración** | Niebla de guerra creíble, bordes, terreno no explorado, minimapa coherente |
| 4 | **Pathfinding / formaciones** | Unidades en formación, sin apelotonamiento ni temblor, movimiento con intención |
| 5 | **Tech tree / edades** | Progresión de eras visible, edificios/techs que la comunican |
| 6 | **Contenido y densidad** | Mapa poblado: árboles, recursos, edificios, decoración; no un plano vacío |
| 7 | **IA legítima** | El enemigo se lee como oponente (base, ejército, presión), no como decorado |
| 8 | **HUD / UX AoE2** | Top bar, minimapa, command card, selección, tooltips: información accionable |
| 9 | **Art direction / diorama isométrico** | Lectura de diorama AoE2: cámara, escala, paleta, siluetas, materiales |
| 10 | **Audio / juice** | Impacto, feedback, partículas, sacudidas, estados: que "se sienta" vivo |

Aceptación: **SORPRENDIDO: SÍ · promedio ≥ 8.5 · ninguna < 7 · evidencia en cada fila.**

---

## 5. Reglas anti-indulgencia (para el juez)

El sesgo natural de un juez que conoce el proyecto es premiar el esfuerzo. Estas reglas
lo impiden:

1. **Ceguera total.** El juez recibe sólo imágenes + `RUBRIC.md`. Nunca el código, el
   JOURNAL, los puntajes previos ni la lista de cambios del ciclo.
2. **Puntuar lo que se ve, no lo que se intentó.** "Está planeado", "el sistema existe
   pero no se ve en estas tomas", "en movimiento se nota" ⇒ no suma.
3. **Ancla primero, número después.** Se elige el nivel (3/5/8/10) de la tabla y recién
   entonces se afina ±1. Prohibido partir del número y buscar justificación.
4. **Evidencia por fila.** Cada puntaje cita archivo + zona de la imagen. Sin cita, el
   puntaje se anula.
5. **Comparación externa obligatoria.** Cada dimensión se puntúa contra *Age of Empires II
   (DE)*, no contra el ciclo anterior. "Mejor que antes" no es un puntaje.
6. **Techo por ausencia.** Si una dimensión no es observable en ninguna de las 7 tomas,
   su máximo es 4 — salvo que la ausencia sea el defecto (audio/juice: máximo 3).
7. **Sin indulgencia por género ni por escala.** "Es un juego web", "es un prototipo",
   "somos dos personas" no son atenuantes. El estándar es el estándar.
8. **Simetría de duda.** Ante la duda entre dos niveles, se elige el menor. El 8 exige
   que un extraño pueda señalar el rasgo sin que se lo expliquen.
9. **Prohibido el promedio complaciente.** No se sube una dimensión para compensar otra,
   ni se redondea hacia arriba. Un 6.5 se reporta 6.
10. **SORPRENDIDO es un juicio, no una suma.** Aunque el promedio dé 8.5, si el juez no se
    sorprendió, el veredicto es NO. Y al revés: no se declara SÍ por cortesía.
11. **El juez no arregla.** No propone implementación ni código: describe brechas
    observables y el efecto esperado en la imagen.
12. **Registro de la duda.** Si el juez duda entre dos lecturas de una imagen, lo anota
    en `Riesgos / notas` en vez de resolverlo a favor del juego.

---

## 6. Convención de carpetas y shots

```
quality/shots/<NN-feature>/
  01-menu.png
  02-arranque.png
  03-economia.png
  04-combate.png
  05-fog.png
  06-ui.png
  07-late-game.png
```

- `<NN-feature>` = número de ciclo + slug corto: `01-economia`, `02-combate-juice`,
  `03-diorama`, … El `NN` es el ciclo del loop (01–05), no un contador libre.
- Los 7 nombres son **fijos**. Nada de `fix-final-v2.png`.
- Un ciclo = una carpeta. Las carpetas viejas **no se borran**: son la evidencia de la
  progresión y el JOURNAL las referencia.
- Baseline histórico: `shots/baseline/` (si existe) es intocable.

---

## 7. JOURNAL.md

Una fila por ciclo, agregada **al final** (append-only). Nunca se reescribe una fila
vieja: si el juez corrige algo, se agrega una nota.

Columnas: `fecha | fase/feature | shots | puntajes | verdicto | cambios`.

- `puntajes`: promedio + las dimensiones que se movieron + la mínima.
- `verdicto`: `SÍ` / `NO` + una línea de por qué.
- `cambios`: qué se aplicó respecto del ciclo anterior (top-5), en una línea.

El JOURNAL arranca con el **baseline** ya registrado (ver `JOURNAL.md`): promedio
**3.13/10**, verdicto **NO**. Ese es el piso contra el que se mide todo.

---

## 8. Definición de "ciclo cerrado"

- [ ] La feature está implementada y se puede señalar en al menos una captura.
- [ ] `npm run typecheck` y `npm run build` pasan.
- [ ] `capture.mjs` corrió completo: 7/7 shots en `shots/<NN-feature>/`.
- [ ] El juez ciego puntuó 10 dimensiones con evidencia.
- [ ] El veredicto quedó escrito en `JOURNAL.md` con las 7 brechas.
- [ ] Si NO pasó: las 5 brechas elegidas están anotadas para el ciclo siguiente.
