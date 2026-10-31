# Interfaz

Reglas de diseño de las tres superficies del Club. Son del producto: valen para cualquier cafetería, con cualquier tema. Los nombres entre `comillas` son tokens de [`tokens.json`](tokens.json).

## Tres superficies, un tema

| Superficie | Quién la usa | Tema | Por qué |
|---|---|---|---|
| **Mis tarjetas** (cliente) | Vecinos, mayormente mayores, en su celular | Claro | Legible de día. Las tarjetas son lo único oscuro y por eso es lo primero que se ve |
| **Caja** (barista y gerente) | El equipo, de pie, con fila, en un celular del local. Cada persona con su cuenta | Claro | Una sola estética para mantener. Se lee bien con la luz del local. El modo equipo se distingue por la barra de arriba con quién está ingresado (*Juan · barista*) |
| **Panel** (solo gerente) | El gerente, en su celular | Claro | Lectura de datos tranquila. Mismo ingreso que la caja; el barista no lo ve |

El tema lo decide la app, no el teléfono: aunque el celular esté en modo oscuro, la tarjeta se ve igual que la que el cliente mostró ayer en el mostrador.

## Principios

**Una cosa por pantalla.** Un título (`app-titulo`), una línea de explicación (`app-cuerpo`) y un botón principal (`accion`). Lo secundario, más chico y más abajo.

**Nada que recordar.** No hay contraseña, no hay código por mail, no hay menú escondido. Lo que la persona necesita está a la vista.

**Todo se puede deshacer, nada se borra solo.** En la caja cada sello tiene *Deshacer* a la vista. En la app del cliente no hay acciones destructivas.

**Lo importante, por posición y por tamaño.** La jerarquía se arma con orden, tamaño y peso; el color es apoyo. Ningún estado depende solo del color: el error lleva ícono y texto, el premio lleva palabra y forma.

**Siempre se sabe dónde está y cómo volver.** Cada pantalla dice dónde estás (título) y tiene una salida visible arriba a la izquierda (*← Volver*, con palabra, no solo la flecha).

## Medidas (no cambian con el tema)

- **Texto:** 18px de base (`app-cuerpo`) y 16px de mínimo absoluto (`app-nota`). Respetá el tamaño de letra que la persona eligió en su celular: el diseño tiene que aguantar 200% sin cortar texto.
- **Toque:** 48px mínimo (`toque-minimo`), 56px el botón principal (`toque-principal`), 72px los botones de la caja (`toque-caja`). 12px entre botones apilados (`espacio-3`).
- **Márgenes:** `espacio-6` a los lados; `espacio-4` en celulares de menos de 360px.
- **Ancho:** el contenido no pasa de `ancho-lectura` aunque se abra en una computadora.
- **Botón principal:** abajo, al alcance del pulgar, ancho completo, en `accion` con `sobre-accion`, `radio-medio`.

Las pruebas de la app frenan un tema que baje el texto de 16px o los toques de estas medidas (`app/src/styles/tokens.test.ts`), y las de pantallas, un texto que se corte al 200% (`app/e2e/support/screenRules.ts`).

## Componentes base

| Componente | Forma | Estados |
|---|---|---|
| Botón principal | Relleno `accion`, texto `app-boton` en `sobre-accion`, alto `toque-principal`, `radio-medio` | Apretado: escala 0.97. Deshabilitado: no se usa; si falta algo, se explica en la pantalla |
| Botón secundario | Borde `trazo-campo` en `borde-campo`, texto `tinta` | Igual que el principal |
| Enlace de texto | `app-cuerpo` en `tinta`, subrayado en `premio` | — |
| Campo de documento | Alto `campo-alto`, fondo `fondo-elevado`, borde `borde-campo`, texto `app-codigo`, teclado numérico | Enfocado: borde 2px `tinta` + anillo `foco`. Error: borde 2px `error` y el mensaje debajo con ícono |
| Aviso | Bloque `radio-medio`, padding `espacio-4`: `premio-suave` para premio, `error-suave` para error, `fondo-hundido` para información | Siempre con ícono + texto |
| Etiqueta de premio | Pastilla `radio-total`. Sobre una tarjeta: `tarjeta-N-pastilla` con `tarjeta-N-sobre-pastilla`. Sobre `fondo`: `premio-suave` con texto `acento` | — |
| Hoja inferior | `fondo-elevado`, esquinas superiores `radio-grande`, fondo de la pantalla oscurecido | Se cierra con *Cerrar* visible, no solo deslizando |

## Foco y accesibilidad

- Anillo de foco sólido de `trazo-foco` en `foco`, separado 2px. Nunca se saca.
- Contraste mínimo 4.5:1 para texto y 3:1 para bordes de control e íconos que significan algo. Cada color de `tokens.json` dice contra qué se verificó; si cambiás un color, verificá sus pares.
- Cada ícono que es un botón tiene nombre en palabras para lectores de pantalla.

## Celular, no página web

- El color de la barra de estado del celular es `fondo`.
- Los botones fijos abajo dejan el espacio del indicador de inicio del iPhone.
- Los campos usan el teclado que corresponde: numérico para el documento, de texto para el nombre con mayúscula inicial automática.
- No hay estados que dependan de pasar el mouse por arriba: todo se ve igual en un celular.
- No se bloquea el zoom: si algo se lee chico, se arregla el tamaño.
- En la app guardada en la pantalla de inicio no hay barra del navegador: cada pantalla necesita su propio *← Volver*.

## Caja

- Al escanear, en este orden: **nombre del titular** (`caja-nombre`), **tarjeta** (`app-subtitulo` con el dibujo de su sello), **sellos** (*5 de 8*), **premios** si hay.
- Inicio: **Escanear tarjeta** (principal) y, debajo, el campo para buscar por código, documento o nombre, siempre a la vista. Arriba, la barra de la caja con el logo de la cafetería y quién está ingresado.
- Las personas del equipo pueden usar el mismo celular: arriba, siempre a la vista, quién está ingresado (*Juan · barista*), para que nadie atienda con la cuenta del otro.
- Una acción grande (`toque-caja`) en la tarjeta: **Sumar sello**. Si la tarjeta tiene un premio, al abrirla salta solo un aviso con el premio, **Canjear premio** (`accion`, `toque-caja`) y **Sumar sello** (secundario, `toque-caja`), para guardar el premio.
- Escanear el QR suma el sello solo; con un premio en la tarjeta, abre el aviso para canjearlo. Después de cada acción, confirmación con el dato, *Deshacer* y *Escanear otra tarjeta*, nada más. Dos cafés son dos escaneos.
- Si el sello completa la tarjeta, la confirmación lo destaca para que el barista se lo diga al cliente: **Tarjeta completa** · *Marta ganó un café gratis*.
- Sin animaciones decorativas: el barista repite esto decenas de veces por día.

## Panel del gerente

- Solo lo ve el gerente; el gerente también puede usar la caja.
- La ficha del cliente nunca muestra el documento: nombre, fecha de alta, tarjetas e historial con quién hizo cada acción.
- Arriba, los números de la semana en `app-contador` con su etiqueta. Debajo, el detalle.
- Gráficos con la paleta del tema: serie principal en `acento`, comparación en `filete`. Sin degradés.
