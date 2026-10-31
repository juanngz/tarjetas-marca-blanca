---
name: revisar-pantalla
description: Revisa una pantalla del Club (cliente, caja o panel) contra las reglas fijas del proyecto - letra, tamaños de toque, un paso por pantalla, privacidad del DNI, deshacer, colores de la marca y voz. Usar al crear o cambiar una pantalla o un componente visible, al revisar un pull request que toca la interfaz, o cuando alguien pida "revisá esta pantalla" o "¿cumple las reglas?".
---

# Revisar una pantalla

Las reglas salen de [`CLAUDE.md`](../../../CLAUDE.md) (*Reglas que no cambian*), del tema de la cafetería ([`tokens.json`](../../../marca/tokens.json)) y de las guías de [interfaz](../../../marca/interfaz.md) y [movimiento](../../../marca/movimiento.md) y de los flujos ([`flujos-cliente.md`](../../../docs/flujos-cliente.md), [`flujos-equipo.md`](../../../docs/flujos-equipo.md)). Si algo de acá contradice a esos archivos, ganan ellos.

## Cómo revisar

1. Identificar de qué lado es la pantalla: **cliente**, **caja** o **panel**. Buscarla en los flujos.
2. Revisar el código (componentes y estilos) con la lista de abajo. Si la app corre, mirarla también en un ancho de celular (360 px).
3. Devolver solo lo que no cumple, de lo más grave a lo menos:

| Regla | Dónde | Qué pasa | Cómo arreglarlo |
|---|---|---|---|

4. Si todo cumple, decirlo en una línea.

## Lista

**Para un público mayor**
- [ ] Letra base de **18px**; **nunca menos de 16px**, tampoco en notas, etiquetas ni errores.
- [ ] Botón principal de **56px** de alto; **72px** para *Sumar sello* y *Canjear premio* en la caja. Nada que se toque mide menos de 48px.
- [ ] **Un paso por pantalla**: un título, una línea de explicación y un botón principal.
- [ ] **Nada que recordar**: la persona no tiene que acordarse de un dato de una pantalla anterior.
- [ ] Foco visible con teclado (anillo de 3px), contraste según `tokens.json`, y nunca el color como única señal (los errores llevan ícono y palabras).
- [ ] Imágenes con `alt` útil; botones con texto, no solo ícono.

**Privacidad y seguridad**
- [ ] **El DNI nunca se muestra en la caja ni en el panel**, ni completo ni parcial. Tampoco va a los registros (`console.log`) ni a mensajes de error.
- [ ] El DNI se valida en el servidor y se guarda solo como HMAC.
- [ ] El alta y el ingreso tienen Turnstile, validado en el servidor.
- [ ] Datos de ejemplo inventados (*Marta García, 30.123.456*). Nunca reales.

**Las reglas del Club**
- [ ] **Escanear suma solo una vez:** después de sumar, la cámara se apaga y va a la confirmación con *Deshacer*. Con un premio en la tarjeta, no suma: abre el aviso para canjearlo.
- [ ] **Todo se puede deshacer** y queda registrado quién lo hizo.
- [ ] Canjear no suma sello. Los sellos y los premios no vencen.
- [ ] Las tarjetas y sus reglas salen de la configuración, no fijas en la pantalla (preparado para varias cafeterías: [`varias-cafeterias.md`](../../../docs/implementacion/varias-cafeterias.md)).

**Marca**
- [ ] Colores, tipografías, espacios y radios con las variables de `tokens.json`, no con valores sueltos.
- [ ] Ningún color, tipografía ni logo de una cafetería fijo en el código: los colores salen de `tokens.json`, los logos de `public/brand/`, los sellos de `public/stamps/` y los nombres de la configuración ([`marca/README.md`](../../../marca/README.md)).
- [ ] Los sellos con el juego de dibujos de su tarjeta (`stamp`), cada tarjeta en su color (`tarjeta-1` a `tarjeta-4`). El color nunca es la única señal: siempre van el nombre y el dibujo.
- [ ] Cliente, caja y panel en el tema claro, aunque el celular esté en modo oscuro.

**Textos**
- [ ] Revisar todos los textos con la skill **voz**.

**En el celular**
- [ ] Se ve bien a 360 px de ancho, sin scroll horizontal.
- [ ] Los campos no hacen zoom al tocarlos (letra de 16px o más). Para más detalles de PWA, la skill **mobile-native**.
- [ ] Sin conexión: el código de la tarjeta se sigue mostrando (pantallas del cliente).
