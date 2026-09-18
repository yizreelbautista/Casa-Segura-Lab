# Sincronización CAD y recorrido

## Fuente de verdad
`CS.CAD.model`

## Flujo
Editor CAD
→ `CS.syncCADRuntime()`
→ habitaciones/dispositivos de `CS.state`
→ IndexedDB del perfil activo
→ Mi vivienda
→ panel de dispositivos
→ destinos del recorrido

## Recorrido
Los destinos se crean con `CS.renderDynamicWalkDestinations()`.
Cada botón almacena el `room.id` real del CAD.

`Architectural3D.walkTo(roomId)` calcula el centro real de esa habitación.
Por eso funciona incluso si la habitación pertenece a una estructura separada.
