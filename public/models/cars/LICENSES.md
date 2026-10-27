# Modelos 3D

Los autos vienen de **Kenney Car Kit** (<https://kenney.nl/assets/car-kit>),
publicado bajo **CC0 1.0** (dominio público). Se pueden usar en proyectos
personales y comerciales sin atribución.

Se tomaron del espejo en GitHub `shorepine/kenney`, que reorganiza los assets
originales de kenney.nl en archivos glTF (`3d/car/`).

| Archivo | Chasis | Origen |
|---|---|---|
| `sedan-sports.glb` | octane | Kenney Car Kit |
| `hatchback-sports.glb` | dominus | Kenney Car Kit |
| `race.glb` | breakout | Kenney Car Kit |
| `suv.glb` | truck | Kenney Car Kit |
| `Textures/colormap.png` | paleta compartida | Kenney Car Kit |

Los modelos se escalan y se apoyan en el piso automáticamente al cargarse
(ver `src/carModels.ts` y `buildFromModel` en `games/rocket/src/cars.ts`), así
que reemplazar un `.glb` por otro del mismo kit no requiere tocar código.

Los archivos viven en `public/models/cars/`, en la **raíz del repo**: Vite sirve
un único `public/` para todas las páginas del sitio, no uno por juego. Se piden
como `/models/cars/<archivo>.glb`. Si falta alguno, el juego usa el auto
procedural equivalente.
