# Marca de la cafetería · puesta en marcha

La app viene **sin marca**: grises, la letra del celular, logos que dicen *TU LOGO* y sellos genéricos. Todo lo que es de una cafetería vive en cuatro lugares. Para vestirla con la marca de una cafetería nueva se cambian solo esos cuatro y se corre un comando.

| Qué | Dónde | Qué tiene |
|---|---|---|
| **Configuración** | [`app/src/cafes/`](../app/src/cafes/) | Nombre, nombre del Club, bienvenida, dirección, zona horaria, tarjetas y sus textos |
| **Tema** | [`marca/tokens.json`](tokens.json) | Colores, tipografías, tamaños, textura y patrón de cada tarjeta |
| **Logos** | [`app/public/brand/`](../app/public/brand/) | Cinco SVG: logo, sello circular, logo en claro, símbolo y símbolo en claro |
| **Sellos** | [`app/public/stamps/`](../app/public/stamps/) | Cuatro SVG por juego: vacío, sellado, premio apagado y premio encendido |

Lo demás (pantallas, reglas, seguridad, textos de la app) es igual para todas las cafeterías. Las guías de [interfaz](interfaz.md), [movimiento](movimiento.md) y [voz](voz.md) son del producto: valen con cualquier marca.

## Paso a paso

### 1. La configuración

1. Copiar [`app/src/cafes/example.ts`](../app/src/cafes/example.ts) a `app/src/cafes/<id>.ts` (por ejemplo `mi-cafeteria.ts`) y cambiarle el nombre a la constante.
2. Completar:

| Campo | Qué es | Ejemplo |
|---|---|---|
| `id` | Identificador, en minúsculas y sin espacios | `mi-cafeteria` |
| `name` | Cómo la nombra el cliente. Va debajo del ícono de la app, en el pie y como texto del logo para lectores de pantalla | *Mi Cafetería* |
| `description` | Qué es, después del nombre en el pie | *Cafetería de especialidad* |
| `club` | El nombre del programa y la palabra que va en itálica | *El Club del **Café*** |
| `welcome` | La línea de la bienvenida, debajo del nombre del Club | *Cada visita suma un sello.* |
| `controller` | Quién guarda los datos y dónde, para *Más información* (Ley 25.326) | La razón social y la dirección |
| `timeZone` | La zona horaria del local: el saludo y el resumen van en su hora | `America/Argentina/Buenos_Aires` |
| `cards` | Las tarjetas, en el orden en que se muestran (abajo) | — |

3. Cada tarjeta:

| Campo | Qué es |
|---|---|
| `type` | Lo que va en la dirección: `/cards/take-away`. **No se cambia nunca** una vez que hay clientes |
| `name` | El nombre que ve el cliente |
| `stamps` | Con cuántos sellos se gana el premio. La tarjeta tiene un casillero más, el del premio |
| `stamp` | El juego de dibujos de sus sellos, en `app/public/stamps/` (paso 4) |
| `color` | Su color en el tema: del 1 al 4 (`tarjeta-1`… en `tokens.json`) |
| `reward` y `texts` | El premio y sus textos: para la caja, el festejo, el canje, la franja y el casillero del premio |

4. Apuntar [`app/src/cafes/index.ts`](../app/src/cafes/index.ts) a la cafetería nueva:

```ts
export { miCafeteria as activeCafe } from "./mi-cafeteria";
```

La cafetería de ejemplo queda en el repo: las pruebas de las reglas la usan, así no dependen de la configuración de nadie.

### 2. El tema

En [`tokens.json`](tokens.json) cada valor dice para qué se usa y contra qué color se verificó su contraste. Lo que más cambia la cara de la app:

| Tokens | Qué cambian |
|---|---|
| `fondo`, `tinta`, `accion` | El fondo de las pantallas, el texto y el botón principal |
| `acento`, `premio`, `premio-suave` | El premio y el gerente en la caja |
| `secundario`, `secundario-hondo` | El Club y el barista en la caja |
| `tarjeta-1` a `tarjeta-4` (y sus `-honda`, `-etiqueta`, `-premio`, `-pastilla`, `-sobre-pastilla`) | El color de cada tarjeta y lo que va encima |
| `sombra`, `sombra-tinte` | El tono de las sombras: cálido, frío o neutro |
| `textura`, `tarjeta-N-patron` | Una textura sobre el fondo y un dibujo repetido en cada tarjeta. Sin ellos, liso |
| `type.families` | Las tipografías: `display` para títulos y cifras, `sans` para el texto |

**Tipografías propias:** poner los `.woff2` en `app/public/fonts/` y listarlos en `type.fonts` (familia, archivo, peso y estilo). Después, nombrarlas primero en `type.families`.

**Lo que no se cambia:** el texto nunca baja de 16px, el cuerpo es de 18px, nada que se toque mide menos de 48px (56px el botón principal, 72px en la caja), y el contraste del texto es de 4.5:1 como mínimo. Las pruebas frenan un tema que baje esas medidas.

### 3. Los logos

Reemplazar los archivos de [`app/public/brand/`](../app/public/brand/) **con el mismo nombre**. En SVG, con `viewBox`.

| Archivo | Dónde aparece | Sobre qué fondo | Proporción |
|---|---|---|---|
| `logo.svg` | El encabezado del cliente (billetera, código) | `fondo` (claro) | Horizontal, 178 × 49 |
| `badge.svg` | La bienvenida y el ingreso a la caja. En la bienvenida, 5 toques seguidos abren la caja | `fondo` (claro) | Cuadrado, 84 × 84 |
| `wordmark-light.svg` | La esquina de las tarjetas, las tarjetas de la bienvenida y la barra de la caja | Las tarjetas (oscuro) | Horizontal, 84 × 19 |
| `symbol.svg` | De adorno, muy suave: detrás de la billetera, de la bienvenida y del equipo; el pie; la funda de Salir | `fondo` (claro) | Cuadrado |
| `symbol-light.svg` | El ícono de la app en el celular y el adorno de la barra de la caja | `tarjeta-1` (oscuro) | Cuadrado. Su `viewBox` tiene que empezar en `0 0` |

### 4. Los sellos

Cada tarjeta usa un juego de cuatro dibujos, por nombre: con `stamp: "taza"`, la app busca en [`app/public/stamps/`](../app/public/stamps/):

| Archivo | Cuándo se ve |
|---|---|
| `taza-empty.svg` | Un sello que falta |
| `taza-stamped.svg` | Un sello cumplido |
| `taza-reward.svg` | El casillero del premio, apagado |
| `taza-ready.svg` | El casillero del premio, encendido: hay un premio para canjear. También es el dibujo del festejo |

Proporción 52 × 78 (vertical). Se dibujan sobre el color de la tarjeta: pensarlos claros sobre oscuro. Si el premio va dibujado adentro (por ejemplo *30%*), la tarjeta puede ir sin `texts.slot`.

Varias tarjetas pueden compartir un juego (como en el ejemplo, que usa `seal` para las cuatro) o tener uno cada una.

### 5. Generar y probar

Desde `app/`:

```sh
npm run brand      # escribe tokens.css, theme.ts, manifest.webmanifest y los íconos de la app
npm run dev        # mirarla en http://localhost:5173
npm test           # las reglas y el servidor
npm run test:e2e   # los recorridos y las pantallas en un celular
```

`npm run brand` es `npm run tokens` (los estilos, el color del navegador y el manifiesto, desde `tokens.json` y la configuración) más `npm run icons` (los íconos de `app/public/icons/`, desde `symbol-light.svg` y `tarjeta-1`). Las pruebas avisan si alguno quedó viejo.

**Las pruebas de pantallas** (`app/e2e/`) recorren la app con las tarjetas de la cafetería de ejemplo (*Café take-away*, *Café en grano ¼ kg*…). Si la cafetería nueva tiene otras tarjetas, ajustar esos nombres en las pruebas. El nombre de la cafetería lo leen de la configuración.

Antes de dar por buena una pantalla con la marca nueva, la skill **revisar-pantalla**; antes de dar por bueno un texto propio de la cafetería, la skill **voz**.

### 6. Publicar

Lo que es de la cafetería pero no de la marca:

| Qué | Dónde |
|---|---|
| Cuentas, bases, Turnstile y secretos | [`docs/implementacion/entorno.md`](../docs/implementacion/entorno.md) |
| Nombres de la app y de las bases, sus ID y la clave pública de Turnstile | [`app/wrangler.jsonc`](../app/wrangler.jsonc) (hoy `club`, `club-dev`, `club-prod` y valores de relleno) |
| El dominio | [`docs/implementacion/dominio.md`](../docs/implementacion/dominio.md) |
| Datos personales: quién es responsable, el registro en la AAIP | [`docs/implementacion/datos-personales.md`](../docs/implementacion/datos-personales.md) |

Para trabajar en la compu no hace falta nada de esto: la app corre con claves de prueba y una base local.

## Lista para tachar

- [ ] `app/src/cafes/<id>.ts` con los datos y las tarjetas de la cafetería, y `cafes/index.ts` apuntando a ella.
- [ ] `marca/tokens.json` con los colores y las tipografías, con el contraste verificado.
- [ ] Los cinco logos en `app/public/brand/`.
- [ ] Los sellos en `app/public/stamps/`, y cada tarjeta con su `stamp`.
- [ ] `npm run brand`, y las pruebas en verde.
- [ ] Revisadas en el celular la bienvenida, la billetera, el código, el festejo y la caja.
- [ ] `wrangler.jsonc`, cuentas, secretos y dominio de la cafetería.
