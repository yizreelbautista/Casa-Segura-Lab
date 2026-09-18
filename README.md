# Casa Segura — Final 3D + CAD completo

Esta versión toma como base visual exacta `CasaSegura-Aplicacion-Final-MODELO-ARQUITECTONICO-3D.html`.

## Qué cambió
- Los 7 puntos académicos están separados en `js/puntos/`.
- Todos los módulos de soporte también están separados.
- Se agregó Editor CAD dentro de la misma aplicación.
- El motor 3D central ya no usa una casa fija de 12×8 quemada en código.
- El motor 3D lee el modelo del Editor CAD.
- Cambiar habitaciones, dimensiones, puertas, ventanas o cámaras reconstruye el modelo central.
- Inicio guiado: `Configurar Casa Segura` o `Utilizar demo`.

## Ejecutar
1. Ejecuta `Iniciar-Casa-Segura.bat`.
2. Abre `http://localhost:8080`.
3. PIN inicial: `1234`.

## Nota
Es un editor arquitectónico integrado inspirado en flujo CAD. No es AutoCAD y no maneja archivos DWG/DXF.


## Corrección visual del modelo 3D
Esta versión cambia la construcción de paredes del motor dinámico:
- las paredes ya no son cajas sólidas por delante de puertas y ventanas;
- cada muro se segmenta alrededor de huecos arquitectónicos reales;
- puertas tienen marco, hoja y perilla;
- ventanas tienen marco, montante y dos cristales;
- cámaras tienen cuerpo, lente y soporte;
- la vista Perspectiva se ajustó para parecer una maqueta arquitectónica y permitir ver los elementos.


## Mi vivienda ahora usa el CAD
Se eliminó la imagen estática de la sección **Mi vivienda**.
En su lugar se renderiza un plano SVG generado desde `CS.CAD.model`, la misma fuente de datos que alimenta el modelo arquitectónico 3D.

El plano muestra:
- habitaciones con medidas;
- paredes con huecos donde van accesos;
- puertas con hoja y arco de apertura;
- ventanas con marco y cristal;
- cámaras con cuerpo, lente y soporte;
- mobiliario básico para reconocer cada espacio.

Puertas y ventanas del plano son interactivas y usan los mismos estados del sistema.


## Modos arquitectónicos corregidos
- **Exterior:** la casa aparece cerrada. El techo tiene dos faldones correctamente asentados, cumbrera, aleros, frontones y un cielo superior que impide ver el interior desde arriba.
- **Interior:** se oculta toda la cubierta para inspeccionar habitaciones, puertas y ventanas.
- **Recorrido:** se oculta la cubierta, aparece una figura 3D y los controles de recorrido mueven a la figura entre sala, cocina, recámaras, baño y exterior. Al entrar a un espacio se abre la puerta correspondiente cuando existe.


## Corrección geométrica definitiva del techo
Se corrigió el signo de rotación de ambos faldones. Antes el motor generaba un techo invertido:
los bordes exteriores quedaban más altos y la zona central más baja.

Ahora:
- la **cumbrera está arriba** y corre a lo largo de la casa;
- ambos faldones **bajan desde la cumbrera hacia los aleros**;
- Exterior muestra una vivienda completamente cerrada;
- se añadieron fascia, canaletas, bajante y patrón geométrico de teja;
- Interior y Recorrido siguen ocultando toda la cubierta;
- la referencia visual ya no es una imagen separada: esta geometría está implementada en `architectural-3d-dynamic.js`.


## Demo y Casa principal aisladas

Esta versión agrega una capa de perfiles sin modificar la geometría 3D actual.

### Al iniciar
Siempre aparece un selector antes del PIN.

Primera vez:
- **Continuar con demo**
- **Configurar mi propia vivienda**

Después de crear Casa principal:
- **Casa principal**
- **Demo**

### Aislamiento
Cada perfil usa:
- su propia base IndexedDB;
- su propio fallback localStorage;
- su propio modelo CAD;
- sus habitaciones;
- sus dispositivos;
- sus eventos;
- sus notificaciones;
- sus configuraciones.

Modificar Casa principal no modifica Demo y viceversa.

### Restaurar Demo
La Demo puede modificarse libremente. El botón **Restaurar Demo original** elimina únicamente la base y el plano CAD de Demo; al recargar, vuelve exactamente al modelo demostrativo base.

### Casa principal
La primera vez inicia con plano vacío. El usuario construye su vivienda en Editor CAD. Al aplicar el modelo, queda marcada como Casa principal configurada y en futuros arranques aparece en el selector.

## Sirena
Punto 3 ya no usa un beep cuadrado repetitivo. La nueva alarma usa Web Audio con dos osciladores, barrido ascendente/descendente, vibración y filtrado para simular una sirena residencial más realista, sin archivos externos.


## Editor CAD libre

Esta versión convierte el configurador en un editor espacial interactivo sin cambiar la lógica de perfiles Demo/Casa principal.

### Habitaciones
- Arrastre libre con mouse o touch.
- Coordenadas X/Z se actualizan automáticamente.
- Cuatro agarraderas para redimensionar cada habitación.
- Snap de 10 cm y ajuste magnético contra bordes de otras habitaciones.
- Se pueden dejar habitaciones unidas o completamente separadas.

### Puertas, ventanas y cámaras
- Se pueden seleccionar y arrastrar.
- Al acercarlas a una pared, el editor detecta habitación, muro y posición.
- Es posible mover un elemento de una habitación a otra.
- El panel lateral permite ajustar habitación, pared, porcentaje de posición y medidas.

### Estructuras
`cad-structure-engine.js` detecta grupos de habitaciones conectadas. Una habitación separada se considera otra estructura.

### Techos
`cad-roof-engine.js` calcula las cubiertas:
- estructura rectangular conectada → techo a dos aguas;
- estructura irregular → cubierta principal + anexos a una agua;
- estructura separada → techo independiente.

El motor 3D consume ese plan; no decide la distribución por sí mismo.

### Sincronización
Durante el arrastre, la posición CAD y el panel arquitectónico 3D se actualizan en vivo. Al soltar se guarda el modelo en el perfil activo.


## Sincronización CAD → Mi vivienda → Recorrido

El Editor CAD es ahora la fuente de verdad de la distribución arquitectónica.

### Mi vivienda
Cada vez que se crea, renombra, mueve, redimensiona o elimina una habitación en CAD:
- `CS.state.rooms` se sincroniza automáticamente;
- la habitación aparece en **Mi vivienda** sin pulsar “Aplicar”;
- sus puertas, ventanas y cámaras también aparecen;
- los elementos eliminados del CAD dejan de aparecer;
- el estado se persiste en la base del perfil activo.

Los sensores no arquitectónicos se conservan cuando siguen asociados a una habitación existente.

### Recorrido dinámico
El recorrido ya no contiene una lista fija de Sala/Cocina/Recámaras.

Los botones se construyen desde `CS.CAD.model.rooms`, por lo que:
- Garaje aparece automáticamente si existe;
- Sótano aparece automáticamente si existe;
- cualquier habitación nueva aparece sin límite prefijado;
- habitaciones en otra estructura siguen siendo destinos válidos;
- la figura usa las coordenadas reales X/Z del cuarto seleccionado;
- si el cuarto tiene puerta, se abre al iniciar el recorrido hacia él.

El número de estructura se muestra debajo de cada destino.


## Mejoras nuevas: recorrido con vista fija y puertas interiores visibles

En esta versión:
- el recorrido ya **no cambia automáticamente la perspectiva** del modelo 3D;
- si dejas la casa en vista superior, lateral o en el ángulo que quieras, el muñeco se mueve **sin resetear la cámara**;
- al iniciar recorrido se activa una **capa de recorrido** que muestra al personaje y oculta el techo para poder seguirlo;
- las **puertas interiores** se ven cerradas, abiertas y cerrándose otra vez;
- la hoja de la puerta ahora rota desde la **bisagra**, no desde el centro;
- al terminar el paso, la puerta usada se **cierra sola** para que la maqueta se vea más real.


## Puertas interiores y recorrido mediante accesos reales

Esta revisión corrige dos problemas del visor 3D:

- Las paredes compartidas entre habitaciones ya no se dibujan dos veces.
  Antes una recámara podía tener una puerta correctamente creada, pero la pared
  sólida de la habitación vecina la tapaba. Ahora existe una sola pared física
  con su hueco, marco y hoja de puerta.
- El personaje ya no se desplaza en línea recta atravesando muros.
  El recorrido construye un grafo de habitaciones conectado por puertas:
  habitación → puerta → habitación. Si una estructura está separada, sale al
  nodo Exterior y entra por una puerta de la segunda estructura.

Durante el recorrido cada puerta se abre al llegar, el personaje cruza el
hueco y la puerta vuelve a cerrarse después de pasar.


## Pasillo con apertura libre

Cuando una habitación tiene categoría **Pasillo**, el Editor CAD muestra el botón
**+ Apertura libre**.

Una apertura libre:
- elimina completamente ese tramo del muro;
- no crea hoja de puerta;
- no crea sensor ni dispositivo;
- puede moverse por la pared como una puerta o ventana;
- permite modificar su ancho;
- sirve para conectar el Pasillo con Sala, Cocina, Recámara, Garaje u otra habitación;
- es considerada por el motor de recorrido como un paso válido.

El recorrido diferencia entre:
- `door`: abre, cruza y vuelve a cerrar;
- `passage`: cruza directamente porque no existe puerta.

La apertura usa la red física única de muros, por lo que el hueco se ve correctamente
desde ambos lados de una pared compartida.
