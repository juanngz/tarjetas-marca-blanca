# Varias cafeterías

> La app es una **marca blanca**: el mismo código para todas las cafeterías, con lo propio de cada una separado. Hoy se publica **una copia por cafetería** (su repo, su Worker y su base). Más adelante, si conviene, una sola app que sirva a varias según el dominio (abajo).

## Qué es de cada cafetería y dónde vive

| Qué | Dónde | Cómo se cambia |
|---|---|---|
| **Las tarjetas y sus reglas** | `app/src/cafes/<id>.ts` | Cada tarjeta es un dato: nombre, cantidad de sellos, premio, juego de sellos, color y textos. La de ejemplo es `example.ts` |
| **Los textos propios** | `app/src/cafes/<id>.ts` | Nombre, nombre del Club, bienvenida, quién guarda los datos. El resto de los textos es del producto ([voz](../../marca/voz.md)) |
| **El tema** | `marca/tokens.json` | Colores, tipografías, textura y patrones. `npm run tokens` los pasa a la app |
| **Los logos y los sellos** | `app/public/brand/`, `app/public/stamps/` | Se reemplazan los SVG con el mismo nombre. `npm run icons` dibuja el ícono de la app |
| **Cuál está activa** | `app/src/cafes/index.ts` | Una línea: `export { miCafeteria as activeCafe } from "./mi-cafeteria";` |
| **La dirección** | El dominio de la cafetería ([dominio.md](dominio.md)) | Cada cafetería con su dominio, o con una dirección dentro de un dominio del producto |
| **El equipo de la caja** | La base de la cafetería | Cada cuenta del equipo pertenece a una cafetería y solo ve la suya |
| **Los datos** | Una base por cafetería (abajo) | `app/wrangler.jsonc` |

El paso a paso para vestir la app con la marca de una cafetería está en [`marca/README.md`](../../marca/README.md).

**Cómo llega cada pedido a su cafetería:** `platform/currentCafe.server.ts` devuelve la configuración del pedido (hoy, siempre la activa) y `platform/db/cafeDb.server.ts`, su base. Las pantallas reciben el nombre y el Club desde el *loader* de la raíz (`root.tsx`, `components/brand.ts`). Para servir a varias desde una sola app, alcanza con que esas dos funciones elijan según el dominio.

**Las migraciones** traen la historia de la primera cafetería (por ejemplo, la 0012 le suma a cada cliente la tarjeta de 1 kg). En una base nueva, sin clientes, no hacen nada: una cafetería nueva arranca con todas aplicadas y sus tarjetas salen de su configuración.

## Una base por cafetería

Cloudflare D1 está pensado para tener **muchas bases chicas** (hasta 50.000 por cuenta en el plan pago, sin costo extra por base).

| | **Una base por cafetería** (propuesta) | Una base compartida con una columna "cafetería" |
|---|---|---|
| Aislamiento | Total: un error no mezcla clientes de dos locales | Depende de no olvidarse el filtro en ninguna consulta |
| Datos personales | Cada cafetería es responsable de sus datos: quedan físicamente separados | Mezclados en la misma base |
| Si una cafetería se va | Se exporta y se borra su base entera | Hay que filtrar y borrar fila por fila |
| Respaldos | Por cafetería: se puede volver atrás una sin tocar las otras | Volver atrás afecta a todas |
| Cambios en la estructura | Hay que aplicarlos en todas las bases (con un script) | Una sola vez |
| Números de todas juntas | Hay que consultar cada base | Una consulta |

**Propuesta:** una base por cafetería, más una base central chica con la lista de cafeterías y su configuración, si un día se sirven todas desde una sola app. El código ya recibe "qué base usar" en cada pedido.

## Lo que no se hace ahora

- Panel para dar de alta cafeterías.
- Cobros, planes o abonos por cafetería.
- Un dominio o nombre para el producto.
- Personalización de tarjetas o de la marca desde un panel: la configuración de cada cafetería se carga a mano, en el código.

## Para vender a cada cafetería

- Nombre y dominio del producto.
- Precio del servicio por cafetería.
- Contrato tipo (responsable y encargado de datos, salida, mantenimiento).
- Inscripción de cada base en el registro de la AAIP, a nombre de cada cafetería.

## Abiertos

- [ ] Confirmar el modelo de una base por cafetería si se sirven varias desde una sola app.
- [ ] Una base central con la lista de cafeterías y su configuración, si hace falta.
