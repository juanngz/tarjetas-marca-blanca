# Club de fidelización · marca blanca

Tarjeta de fidelización digital (PWA) para cafeterías, **sin marca**: cada cafetería se configura con su nombre, sus tarjetas, su tema, sus logos y sus sellos ([puesta en marcha](marca/README.md)). Reemplaza las tarjetas de sellos de papel. El código está en [`app/`](app/) (React Router 7 en Cloudflare). Para levantarlo, ver el [README](README.md).

## Leer antes de trabajar

| Qué | Dónde |
|---|---|
| Cómo se viste para una cafetería (configuración, tema, logos, sellos) | [`marca/README.md`](marca/README.md) |
| Qué se construye y por qué (reglas, seguridad, etapas, primera salida) | [`docs/propuestas-tarjeta-fidelizacion.md`](docs/propuestas-tarjeta-fidelizacion.md) |
| Pantallas y flujos del cliente | [`docs/flujos-cliente.md`](docs/flujos-cliente.md) |
| Pantallas y flujos de la caja y el panel | [`docs/flujos-equipo.md`](docs/flujos-equipo.md) |
| Stack, CI/CD, dominio y decisiones técnicas | [`docs/implementacion/`](docs/implementacion/) |
| Cómo se organiza el código (capas, carpetas, base) | [`docs/implementacion/arquitectura.md`](docs/implementacion/arquitectura.md) |
| Cuentas, accesos y configuración del entorno | [`docs/implementacion/entorno.md`](docs/implementacion/entorno.md) |
| Reglas de interfaz, movimiento y voz (del producto, valen con cualquier marca) | [`marca/interfaz.md`](marca/interfaz.md) · [`marca/movimiento.md`](marca/movimiento.md) · [`marca/voz.md`](marca/voz.md) |
| Cómo trabajamos (ramas, commits, pull requests) | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## Reglas que no cambian

- **Público mayormente mayor:** letra de 18px como base y nunca menos de 16px, botones de 56px (72px en la caja), un paso por pantalla, nada que recordar.
- **El cliente entra solo con su DNI.** Sin contraseña, sin mail, sin código por mail. Sesión de 12 meses.
- **El DNI se guarda con hash y clave secreta** (HMAC), nunca en texto. Nunca se muestra en la caja ni en el panel.
- **Escanear el QR suma el sello solo** (08/10/2026), salvo que la tarjeta tenga un premio: ahí abre el aviso para canjearlo. Tipear el código abre la tarjeta y se toca *Sumar sello*. Todo se puede deshacer y queda registrado con quién lo hizo.
- **Las tarjetas son de la configuración de cada cafetería** (`app/src/cafes/`), nunca fijas en el código. La de ejemplo tiene 4: Café take-away (7 sellos + premio) y Café en grano ¼ kg, ½ kg y 1 kg (4 + premio). El premio se gana con el último sello y se usa en la compra siguiente. Como en papel, la tarjeta tiene un casillero más, el del premio: con el último sello se ilumina, y sellarlo es canjearlo; el cliente también puede guardarlo para otra compra. Los sellos y premios no vencen. Canjear no suma sello.
- **Sin marca en el código:** ningún nombre, color, tipografía, logo ni dibujo de una cafetería fijo en el código. Los nombres y textos propios salen de `app/src/cafes/`, los colores y las letras de `marca/tokens.json`, los logos de `app/public/brand/` y los sellos de `app/public/stamps/`.
- **Textos:** español rioplatense, de vos, con las palabras de [`marca/voz.md`](marca/voz.md) (*tarjeta, sello, premio, canjear, entrar*). Sin emojis.
- **Sin datos reales de clientes** en el repo, en pruebas ni en ejemplos.

## Convenciones

- Documentos en español, con tablas cortas y una idea por línea, como los que ya están.
- **Código en inglés:** nombres, archivos, carpetas, comentarios, pruebas, tablas, columnas, valores guardados, direcciones y secretos. Las palabras del Club se traducen siempre igual, con el glosario de [`arquitectura.md`](docs/implementacion/arquitectura.md#el-código-en-inglés). Lo que ve una persona (pantallas, mensajes de los scripts) sigue en español rioplatense.
- Commits en español, en presente: *Agregar…*, *Corregir…*.
- Nada se sube directo a `dev` ni a `main`: cada cambio va en su rama, salida de `dev`, y entra por pull request a `dev`. De `dev` a `main` (prod) solo cuando el equipo lo decide (ver [`CONTRIBUTING.md`](CONTRIBUTING.md)).
- Si un cambio toca el tema, los logos o los sellos, se corre `npm run brand` (las pruebas avisan si quedó viejo).
- Antes de dar por buena una pantalla, usar la skill **revisar-pantalla**; antes de dar por bueno un texto visible, la skill **voz**. Al escribir o cambiar código, la skill **pruebas**: la prueba primero, a partir del spec (las tres en `.claude/skills/`).
- Nunca publicar ni tocar las bases remotas desde la terminal: lo hace la CI. Los permisos de `.claude/settings.json` lo bloquean.
- El código respeta las capas de *Clean Architecture* de [`arquitectura.md`](docs/implementacion/arquitectura.md): reglas puras en `core/`, casos de uso y puertos en `application/`, adaptadores en `platform/` (`.server.ts`) conectados en `platform/app.server.ts`, y cada pantalla en su carpeta de `routes/` con `loader` y `action` finitos que solo llaman casos de uso. El lint frena los imports que van al revés.
