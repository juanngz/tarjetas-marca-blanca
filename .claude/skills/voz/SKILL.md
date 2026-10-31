---
name: voz
description: Revisa y reescribe los textos que ve una persona (pantallas, botones, avisos, errores, mails, carteles) con la voz del Club, según marca/voz.md. Usar siempre que se escriba o se cambie un texto visible del Club, también los textos propios de una cafetería en su configuración (app/src/cafes/), al revisar un pull request que toca textos, o cuando alguien pida "revisá la voz", "cómo lo diría el barista" o "pasalo a la voz de la marca".
---

# Voz del Club

La fuente de verdad es [`marca/voz.md`](../../../marca/voz.md). **Leerlo entero antes de revisar**: esta skill resume cómo aplicarlo, no lo reemplaza. Si algo de acá contradice a `voz.md`, gana `voz.md`.

## Cómo revisar

1. Juntar todos los textos visibles del cambio: títulos, botones, avisos, errores, `aria-label`, `alt`, `title`, mails y textos de la caja.
2. Revisar cada uno con la lista de abajo.
3. Devolver una tabla corta, solo con lo que hay que cambiar:

| Dónde | Dice | Debería decir | Por qué |
|---|---|---|---|

4. Si todo está bien, decirlo en una línea. No reescribir lo que ya está bien.

## Lista

- **De vos, rioplatense:** podés, tenés, mostrale, escaneá. Nunca *usted* ni *tú*.
- **Palabras del Club:** *tarjeta, sello, premio, canjear el premio, entrar, tu número de documento, el código de tu tarjeta, guardar en la pantalla de inicio, el barista, el nombre del Club*. Nunca *wallet, puntos, recompensa, redimir, login, usuario, QR (salvo para aclarar el dibujo), PWA, operador*. La tabla completa está en *Palabras* de `voz.md`.
- **El saludo según la hora, con el nombre sin el apellido:** *Buenos días, Marta.* hasta las 12:59 · *Buenas tardes* de 13:00 a 19:59 · *Buenas noches* desde las 20:00.
- **Sin emojis.** Como máximo un signo de exclamación por pantalla, y solo para festejar (tarjeta completa).
- **Botones:** verbo + cosa (*Sumar sello*, *Ver mi código*). Nunca *OK*, *Aceptar* o *Enviar* solos.
- **Números en cifras:** *5 de 7*. Documento con puntos al mostrarlo (*30.123.456*). Horas en formato de 24 horas.
- **Oración normal**, sin mayúsculas sostenidas en la app.
- **Una idea por frase.** Un título, una línea de explicación y un botón por pantalla.
- **Errores:** calmos, sin culpa, y dicen qué hacer. Nunca códigos técnicos (*Error 429*).
- **El tono según el momento:** ver la tabla *El tono, según el momento* de `voz.md`.

## La prueba final

1. ¿Lo diría el barista en voz alta, en el mostrador?
2. ¿Lo entiende alguien de 75 años sin anteojos de cerca?
3. ¿Dice qué tiene que hacer la persona después?
4. ¿Usa las palabras del Club? Los textos propios de la cafetería (bienvenida, premios) pueden tener su guiño, sin cambiar esas palabras.

## Ejemplos y datos

Siempre con datos inventados (*Marta García, 30.123.456*). Nunca datos reales de clientes.
