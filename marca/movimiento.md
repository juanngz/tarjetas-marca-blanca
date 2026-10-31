# Movimiento

El movimiento está para confirmar que algo pasó, nunca para decorar. Hay un solo momento que se celebra: completar la tarjeta. Son reglas del producto: valen con cualquier tema.

## Cuándo se anima

| Qué | Frecuencia | Decisión |
|---|---|---|
| Acciones de la caja (sumar, deshacer) | Decenas de veces por día | Sin animación. El cambio es instantáneo; la confirmación aparece ya puesta |
| Tocar un botón | Siempre | Respuesta al apoyar el dedo: escala 0.97 en 120ms |
| Abrir el código, abrir una hoja | Algunas veces por visita | Entrada corta desde abajo, salida por el mismo lado |
| Sello nuevo en la tarjeta del cliente | Una vez por visita | El sello se "imprime": de 0.92 a 1 con opacidad, 240ms. Un solo sello, no toda la grilla |
| Tarjeta completa | Una vez cada tantas compras | El festejo: el premio pasa de apagado a encendido, 480ms, y se queda encendido con un aura que respira despacio (2,4 s; quieta si el celular pide menos movimiento). Se puede saltear con *Seguir* |
| Cambiar de pantalla | Frecuente | Sin desplazamientos laterales: fundido de 160ms |

## Curvas y tiempos

| Uso | Curva | Duración |
|---|---|---|
| Respuesta al tocar | `cubic-bezier(0.23, 1, 0.32, 1)` (salida fuerte) | 120ms |
| Aparecer (avisos, sello nuevo) | `cubic-bezier(0.23, 1, 0.32, 1)` | 200–240ms |
| Hojas que suben desde abajo | `cubic-bezier(0.32, 0.72, 0, 1)` (tipo cajón de iOS) | 320ms al abrir, 200ms al cerrar |
| Festejo | `cubic-bezier(0.23, 1, 0.32, 1)` | 480ms |

Nunca una curva que empieza lenta: se siente como que la app no escuchó. La salida siempre es más rápida que la entrada.

## Reglas

- Nada aparece de la nada: arranca de escala 0.92 o más, con opacidad.
- Lo que entra desde abajo sale hacia abajo.
- Se anima solo posición, escala y opacidad. Nunca el alto o el ancho de algo.
- Nunca se bloquea un toque mientras algo se mueve.
- Sin rebotes. El público del Club no necesita juego; necesita certeza.
- Si la persona pidió reducir el movimiento en su celular: todo pasa a fundidos de 200ms y el festejo es solo el cambio de imagen.
