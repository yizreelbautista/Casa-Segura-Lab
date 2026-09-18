# Casa Segura — mejoras de recorrido y puertas

## Cambios aplicados
1. El recorrido deja fija la perspectiva elegida por el usuario.
2. Se activa un overlay de recorrido para:
   - mostrar al personaje;
   - ocultar el techo;
   - conservar la cámara actual.
3. Las puertas interiores ahora:
   - permanecen visibles cuando están cerradas;
   - abren desde la bisagra;
   - se autocerran al terminar el paso.
4. Los botones de recorrido ya no fuerzan `setView('walk')`.

## Resultado esperado
- Puedes dejar el modelo en una vista superior o lateral.
- Pulsas una habitación.
- El muñeco se desplaza sin que la casa cambie de ángulo.
- Se ve la puerta abrirse y cerrarse.
