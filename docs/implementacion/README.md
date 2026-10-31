# Implementación

> Decisiones técnicas, cuentas y lo que falta antes del lanzamiento. Actualizado: 06/10/2026.
> Base: [spec](../propuestas-tarjeta-fidelizacion.md) (etapas, primera salida, volumen y costos), [flujos del cliente](../flujos-cliente.md) y [flujos del equipo](../flujos-equipo.md).

## Lo que condiciona todo

Datos del spec que pesan en cada elección:

| Dato | Qué implica |
|---|---|
| Como mucho 50 ventas por hora en el pico | Cualquier plan gratuito alcanza. No hace falta escalar nada |
| Alojamiento al menor costo posible, pagado por los desarrolladores | Costo bajo y predecible, y poco mantenimiento: lo hacen los desarrolladores |
| Guardamos nombre y DNI (Ley 25.326) | Los datos no pueden ir a países sin protección adecuada (EE. UU. y Brasil no lo son) salvo consentimiento |
| App web guardada como ícono (PWA) | El código de la tarjeta tiene que verse sin conexión: hace falta un *service worker* |
| DNI guardado con hash y clave secreta | La clave va en los secretos del proveedor, nunca en el repo |
| Después viene la tienda online y el stock | La base de datos tiene que poder crecer (pagos, productos, pedidos) |
| El local puede cerrar por vacaciones | Nada que se pause por inactividad |

## Documentos

| Documento | Qué resuelve |
|---|---|
| [plan.md](plan.md) | Las etapas para llegar a la primera salida |
| [stack.md](stack.md) | Qué usamos, por qué y qué se descartó |
| [arquitectura.md](arquitectura.md) | Cómo se organiza el código: núcleo, plataforma, rutas y base de datos |
| [cloudflare.md](cloudflare.md) | Cómo funciona Cloudflare, sus planes, nuestro uso estimado y cómo irnos si hace falta |
| [ci-cd.md](ci-cd.md) | Cómo se prueba y se publica cada cambio |
| [entorno.md](entorno.md) | Cuentas, accesos y secretos: Bitwarden, GitHub, Cloudflare y la compu de cada uno |
| [dominio.md](dominio.md) | Qué dominio, a nombre de quién, cuánto cuesta y cómo se configura |
| [datos-personales.md](datos-personales.md) | Qué dice la Ley 25.326 y qué obligaciones tenemos |
| [entrega.md](entrega.md) | Qué es de la cafetería y qué de los desarrolladores, y qué pasa si la relación termina |
| [varias-cafeterias.md](varias-cafeterias.md) | Cómo queda preparado para venderlo a otras cafeterías |
| [../CONTRIBUTING.md](../../CONTRIBUTING.md) | Cómo trabajamos en el repo: ramas, commits, pull requests |
| [../CLAUDE.md](../../CLAUDE.md) | Contexto del proyecto para quien trabaje con Claude |

## Decisiones

| # | Tema | Decisión | Estado |
|---|---|---|---|
| 1 | Alojamiento y base de datos | **Cloudflare**: Workers + D1 con jurisdicción UE + Turnstile + DNS. Ver [stack.md](stack.md) y [cloudflare.md](cloudflare.md) | **Decidido** (05/10/2026) |
| 1b | Plan de Cloudflare | **Gratis, por ahora.** Se revisa antes del lanzamiento (el de USD 5/mes da 30 días de *Time Travel* y no corta al pasar un límite) | **Decidido** (05/10/2026) |
| 1c | Cuenta de Cloudflare | **Cuenta propia por cafetería (o del producto)**, con el equipo como miembros; el dueño de la cafetería sin acceso. Ver [entorno.md](entorno.md) | **Decidido** (05/10/2026) |
| 2 | Framework (frontend y backend) | **React Router 7**, full-stack con React. Ver [stack.md](stack.md) | **Decidido** (05/10/2026) |
| 2b | Varias cafeterías | **Marca blanca:** tarjetas, textos, tema, logos y sellos configurables por cafetería, una copia publicada y una base por cafetería. Ver [varias-cafeterias.md](varias-cafeterias.md) y la [puesta en marcha](../../marca/README.md) | **Decidido** |
| 2c | Arquitectura del código | Núcleo funcional (`core/`), infraestructura (`platform/`), rutas con la convención de React Router y libro mayor de movimientos. Ver [arquitectura.md](arquitectura.md) | **Decidido** (06/10/2026) |
| 2d | Roles del equipo | Los permisos de barista y gerente se controlan en el caso de uso, con una regla pura en `core/access.ts`. Construido con *Equipo*, la primera acción solo del gerente. Ver [arquitectura.md](arquitectura.md#los-roles-del-equipo) | **Decidido** (07/10/2026); **construido** (08/10/2026) |
| 2e | Modo oscuro | **Solo el tema claro**, aunque el celular esté en modo oscuro: la app le pide a cada navegador que no la oscurezca (`color-scheme: only light`, un resguardo para Samsung Internet y `darkreader-lock`). Sin tema oscuro ni forma de cambiarlo. Lo único que no se puede frenar es la inversión de colores de accesibilidad del celular. Ver [plan.md](plan.md), *Manifiesto e ícono* | **Decidido** (23/10/2026); a confirmar en un Samsung real |
| 3 | Sello en vivo | **En tiempo real:** la pantalla del código abre un WebSocket con un Durable Object por tarjeta, y la caja le avisa al registrar. Ver [arquitectura.md](arquitectura.md#el-sello-en-vivo) | **Decidido** (07/10/2026) |
| 3b | Lector de QR de la caja | **`@yudiel/react-qr-scanner`**, que lee con ZXing en WebAssembly en todos los celulares, sin depender de Google Play Services ni de un CDN. Ver [plan.md](plan.md), *Cómo quedó la 4c* | **Decidido** (08/10/2026); a confirmar en el celular del gerente |
| 4 | CI | GitHub Actions: revisar, probar y compilar en cada pull request y en cada fusión. Ver [ci-cd.md](ci-cd.md) | **Decidido** (05/10/2026) |
| 5 | CD | Dos ramas y dos ambientes: la rama **`dev`** se publica en dev y **`main`** en prod, desde GitHub Actions. Cada cambio entra por pull request a `dev`; de `dev` a `main` cuando el equipo decide publicar. Ver [ci-cd.md](ci-cd.md) | **Decidido** (05/10/2026) |
| 6 | Proteger `main` | **Por acuerdo, gratis:** nadie sube directo a `main`; producción solo se publica desde la CI (ver [ci-cd.md](ci-cd.md)) | **Decidido** (05/10/2026) |
| 7 | Dominio | Por cafetería, a su nombre: `<cafeteria>.com` en Cloudflare o `<cafeteria>.com.ar` en NIC. Ver [dominio.md](dominio.md) | Por cafetería: decidir antes de imprimir el cartel y del lanzamiento |
| 8 | Mail del dominio | Reenvío gratis con Cloudflare Email Routing (por ejemplo `hola@` → un Gmail) | Opcional |
| 9 | Datos personales | Datos en la UE (país adecuado), base inscripta en la AAIP a nombre de la cafetería y borrado a pedido (Flujo G). Ver [datos-personales.md](datos-personales.md) | **Decidido** dónde se guardan (05/10/2026); falta inscribir |
| 10 | Entrega a la cafetería | **Modelo A, servicio:** ustedes operan todo; dominio y datos de la cafetería; código y cuentas de ustedes. Ver [entrega.md](entrega.md) | **Decidido** (05/10/2026) |
| 11 | Gestor de contraseñas | **Bitwarden**, organización gratis para el equipo. Ver [entorno.md](entorno.md) | **Decidido** (05/10/2026) |

Cuando una decisión se cierra, se marca acá con la fecha y, si tuvo discusión, se anota el porqué en el documento del tema.

## Equipo y cuentas

| Tema | Decisión | Por qué / qué implica |
|---|---|---|
| Quién programa | **El equipo de desarrollo** | — |
| Mail de las cuentas | **El mail personal de cada uno** | Las cuentas se reutilizan entre cafeterías. Cada uno entra con su propio usuario |
| GitHub | **Una copia del repo por cafetería**, en la cuenta del equipo | Si algún día se entrega el proyecto, se transfiere el repo |
| Cloudflare | **Cuenta propia por cafetería (o del producto)**, con el equipo como **miembros** con su usuario personal y verificación en dos pasos | Ver [entorno.md](entorno.md), paso 3 |
| Dominio | **El titular es la cafetería**, aunque se compre desde la cuenta de ustedes | Si se entrega el proyecto, el dominio se transfiere a una cuenta del local |

**Lo que hay que resguardar sí o sí:**

| Secreto | Dónde vive | Si se pierde |
|---|---|---|
| **Clave del hash del DNI** | Secretos de Cloudflare, Bitwarden y una **copia en papel** guardada por la cafetería | **No se puede reconocer a ningún cliente por su DNI:** todos tendrían que volver a anotarse |
| Token de Cloudflare para publicar desde GitHub Actions | Secretos de GitHub | Se genera otro; molestia menor |
| Clave del hash del PIN del equipo | Secretos de Cloudflare | Se genera otra y se vuelven a cargar los PIN del equipo; molestia menor |
| Clave secreta de Turnstile | Secretos de Cloudflare | Se genera otra; molestia menor |
| PIN iniciales del equipo de la caja | Se entregan a cada persona | Se restablecen |
| Acceso a la cuenta del dominio y al panel de nic.ar (si se usa) | Cuenta del titular | Riesgo de perder el dominio |

Qué va en cada colección de Bitwarden y cómo se nombra cada ítem: [entorno.md](entorno.md), paso 1.

## Pendientes, por cafetería

**Marca** (paso a paso en [marca/README.md](../../marca/README.md))
- [ ] Configuración, tema, logos y sellos de la cafetería, y `npm run brand`.

**Cuentas** (paso a paso en [entorno.md](entorno.md))
- [ ] Cuenta de Cloudflare con verificación en dos pasos, y el equipo como miembros con su usuario personal.
- [ ] Bases, Turnstile y secretos de la cafetería, y sus ID en `app/wrangler.jsonc`.
- [ ] Antes del lanzamiento: generar la clave del hash del DNI, guardarla en Bitwarden y en papel.
- [ ] Definir si los costos mensuales los absorben ustedes o hay un abono.

**Dominio** (ver [dominio.md](dominio.md))
- [ ] Elegir el dominio con la cafetería.
- [ ] Definir el titular con la cafetería: para `.com.ar` necesita su clave fiscal.
- [ ] Registrar y delegar los DNS a Cloudflare.

**Datos personales** (ver [datos-personales.md](datos-personales.md))
- [ ] Escribir el texto de *Más información* (finalidad, responsable, dónde se guardan, derechos).
- [ ] Inscribir la base en el Registro Nacional de Bases de Datos, a nombre de la cafetería.

**Diseño**
- [ ] Los logos y los sellos de la cafetería, con sus cuatro estados ([marca/README.md](../../marca/README.md)).
