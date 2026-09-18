# Editor CAD Libre — Casa Segura

## Módulos
- `cad-snap-engine.js`: rejilla y adhesión magnética.
- `cad-drag-engine.js`: arrastre y redimensionamiento.
- `cad-opening-editor.js`: propiedades de puertas, ventanas y cámaras.
- `cad-structure-engine.js`: detección de estructuras conectadas.
- `cad-roof-engine.js`: planificación de cubiertas.
- `cad-editor.js`: render del plano y CRUD.
- `architectural-3d-dynamic.js`: visor WebGL del resultado.

## Regla de arquitectura
El CAD modifica el modelo de datos. El motor WebGL lo representa. Esto evita que una mejora del editor altere alarma, perfiles, base de datos o los siete puntos académicos.
