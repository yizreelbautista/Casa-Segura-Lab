# Arquitectura

## Núcleo académico
- punto-1-control-pin.js
- punto-2-sensores.js
- punto-3-alarma-sonora.js
- punto-4-boton-panico.js
- punto-5-aviso-agencia.js
- punto-6-pantalla-lcd.js
- punto-7-interfaz-web.js

## Datos
- db-production.js

## Módulos
- vivienda-production.js
- camaras-v23.js
- ux-v23.js
- security-house-production.js
- connectivity-v23.js
- remote-postgres-production.js
- database-admin-production.js

## CAD
- cad-store.js: persistencia del plano.
- cad-editor.js: edición de habitaciones y aperturas.
- architectural-3d-dynamic.js: construye el modelo 3D central desde el plano CAD.

## Flujo
Editor CAD -> CADStore -> Architectural3D.rebuild() -> panel central WebGL.


## Capa de perfiles

`js/core/profile-manager.js` se ejecuta antes de abrir la base de datos.

Flujo:

Selector de vivienda
→ perfil `demo` o `main`
→ nombre de IndexedDB independiente
→ CADStore independiente
→ carga de Casa Segura
→ mismo motor 3D

La geometría de `architectural-3d-dynamic.js` no fue modificada para implementar los perfiles.
