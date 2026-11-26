# RoboTower Gameplay — ODD feature

Objective: implement all design improvements from the critique, one phase at a time, with a journal. Branch: `feature/robotower-gameplay`. Delivery: `ask-on-risk`, work-unit commits. Runner: `npm run build` (tsc --noEmit && vite build); no test framework configured.

## Specs

S1. Usuario: `"actua como experto disenador de juegos y critica este nuevo juegos de torres"`. Derivado (assumption, no texto literal del usuario): las mejoras son las 9 brechas de la crítica — roles de torres poco profundos, ruta única, economía sin tensión, enemigos solo escalados, sin capa activa, feedback incompleto, onboarding flaco, sin meta-progresión, sin panel de stats de mejora.

S2. Usuario: `"planifica la implementacion de todas las mejoras"`. Derivado (assumption): 8 fases — F0 cimientos/refactor, F1 economía, F2 arquetipos de enemigos + telegrafía, F3 segundo mapa, F4 roles de torres + EMP, F5 feedback/juice, F6 onboarding/meta, F7 balance y cierre.

S3. Usuario: `"trabaja con ODD si lo tenes disponible manteniendo un journal. implementa todas las fases sin preguntarme, una por una, hasta terminar"`. Implementación autorizada, sin preguntas, journal en `## Log`, una fase por vez, hasta completar.

S4. Assumption: mantener Three.js + Vite + TypeScript estricto, sin dependencias nuevas; preservar el sistema de instancing/pooling y los draw calls bajos; UI en español; arte procedural sin assets externos.

S5. Assumption: `bestWave` actual se migra al nuevo esquema de guardado; ninguna fase rompe la jugabilidad existente salvo cambio pedido explícitamente.

## Tasks

- [x] T0 (S3-S4) Fase 0 cimientos: RNG determinista (`mulberry32`), tabla `WAVES` de datos y rocas estables en `main.ts`. Route: inline. Evidence: `npm run build` OK. Commit: pendiente (incluir todo el trabajo previo de RoboTower en el primer work-unit).
- [ ] T1 (S1-S2,S5) Fase 1 economía: venta 65%, panel de stats, bonus/interés, penalización por filtrado. Route: inline. Commit: —
- [ ] T2 (S1-S2,S5) Fase 2 enemigos: 5 arquetipos + telegrafía de oleadas. Route: inline. Commit: —
- [ ] T3 (S1-S2,S5) Fase 3 segundo mapa/ruta + `bestWave` por mapa. Route: inline. Commit: —
- [ ] T4 (S1-S2,S4-S5) Fase 4 roles asimétricos, dos torres nuevas y habilidad EMP. Route: inline. Commit: —
- [ ] T5 (S1-S2,S4-S5) Fase 5 audio procedural, números de daño, screen shake, reduced-motion. Route: inline. Commit: —
- [ ] T6 (S1-S3,S5) Fase 6 onboarding guiado, dificultad/seed, estrellas, desbloqueos y migración. Route: inline. Commit: —
- [ ] T7 (S2-S5) Fase 7 balance, verificación y cierre del journal. Route: inline. Commit: —

## Log

L1 (2026-11-26): `trabaja con ODD si lo tenes disponible manteniendo un journal. implementa todas las fases sin preguntarme, una por una, hasta terminar`
L0a (2026-11-26): `actua como experto disenador de juegos y critica este nuevo juegos de torres`
L0b (2026-11-26): `planifica la implementation de todas las mejoras`
L0c (2026-11-26): " dale, segui" — autorización previa para instanciar torres.
L0d (2026-11-26): Critica entregada: 9 brechas de diseño; verdict "prototipo con buena piel"; próximo salto = profundidad de decisión, no más render.
L0e (2026-11-26): Plan entregado: F0-F7 con acceptance criteria.
L2 (2026-11-26): Feature document creado antes del primer cambio de source; rama `feature/robotower-gameplay` creada desde `main` con el trabajo previo de RoboTower sin commitear, pendiente de incluir en el primer work-unit. `.atl/*` modificado previamente queda fuera del alcance.
L3 (2026-11-26): T0 completado. Se agregó `mulberry32` con seed fija para las rocas y la tabla `WAVES` (count/bossLast/hp/speed/reward) consumida por `beginWave` y `spawnEnemy`. No se hizo el split completo a módulos porque el archivo ya está altamente cohesionado y el churn no aportaría valor; se documenta como decisión. `npm run build` OK (solo warning preexistente de three.module >500 kB). Siguiente: T1 economía.
