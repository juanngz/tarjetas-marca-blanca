# Arquitectura del código

> Documento de trabajo. Fecha: 06/10/2026, actualizado el 07/10/2026 (código en inglés y *Clean Architecture*). **Decidido.** Cómo se organiza el código de [`app/`](../../app/): capas, carpetas, base de datos y reglas. Framework: React Router 7 en Cloudflare ([stack.md](stack.md)).

## En una línea

*Clean Architecture*: las reglas del Club en un **núcleo** de funciones puras (`core/`); lo que hace la app, en **casos de uso** que solo conocen sus **puertos** (`application/`); todo lo que habla con el mundo de afuera en **adaptadores** (`platform/`), conectados en un solo lugar; y cada pantalla en **su carpeta de `routes/`**, que solo llama a casos de uso.

## Las ideas que usamos

| Idea conocida | Cómo la usamos |
|---|---|
| **Núcleo funcional, cáscara imperativa** (*Functional Core, Imperative Shell*) | `core/` son reglas puras, sin base ni red; `platform/` y `routes/` son la cáscara que lee, guarda y responde |
| ***Clean Architecture*** (puertos y adaptadores) | Las dependencias apuntan siempre hacia adentro: `routes/` → `application/` → `core/`. Los casos de uso piden lo de afuera por **puertos** (`application/ports.ts`: repositorios, reloj, hash, sesiones, puerta); `platform/` los implementa; `platform/app.server.ts` los conecta. Decidido el 07/10/2026, en reemplazo de la versión sin interfaces |
| **Libro mayor** (*ledger*) | Los sellos no se guardan como un número: se guardan los movimientos y el estado se calcula. Como en la contabilidad y en la mayoría de los programas de puntos |
| **Convención de rutas de React Router** | Cada dirección es una carpeta en `routes/` con su `route.tsx` |
| **Lenguaje del negocio** (la parte simple de DDD) | El código usa las palabras del spec y de [`voz.md`](../../marca/voz.md), traducidas siempre igual: ver [El código en inglés](#el-código-en-inglés) |

**Descartadas:** *event sourcing* completo (el libro mayor liviano alcanza), una unidad de trabajo (*unit of work*) genérica (cada repositorio guarda todo junto lo que tiene que ser atómico: ver [Las transacciones](#las-transacciones)) y *Feature-Sliced Design* (cinco capas con reglas propias). Organizar por rebanadas o por área se evaluó y se eligió la convención de React Router.

## El código en inglés

Decidido el 07/10/2026: **todo el código se escribe en inglés.** Lo que ve una persona sigue en español.

| En inglés | En español |
|---|---|
| Nombres de variables, funciones, tipos, archivos y carpetas | Los textos de las pantallas (botones, avisos, títulos, `alt`, `aria-label`) |
| Comentarios y nombres de las pruebas (`describe`, `it`) | Los mensajes de los scripts para el equipo (`scripts/staff.mjs`) |
| Tablas, columnas y valores guardados en la base | Los documentos, los commits y los pull requests |
| Direcciones (`/cards`, `/sign-up`), campos de los formularios, cookies, secretos | Los nombres de los tokens del tema (`--fondo`, `--tinta`): vienen de [`tokens.json`](../../marca/tokens.json) |
| Los errores internos (los lee un desarrollador en los registros) | |

**El glosario.** Cada palabra del Club se traduce siempre igual:

| Spec y voz | Código |
|---|---|
| tarjeta · sello · premio | `card` · `stamp` · `reward` |
| canjear · deshacer · sumar sello | `redeem` · `undo` · `addStamp` |
| movimiento · libro mayor · saldo | `entry` · `ledger` · `balance` |
| sellos por vuelta | `stampsPerRound` |
| cliente · equipo · persona del equipo | `customer` · `staff` · `member` |
| barista · gerente | `barista` · `manager` |
| caja | `register` |
| resumen (los números del gerente) | `summary` |
| cafetería | `cafe` |
| billetera · la de adelante | `wallet` · `front` |
| anotarse (alta) · entrar · salir | `signUp` · `signIn` · `signOut` |
| documento · código corto · código del QR | `document` · `shortCode` · `qrCode` |
| take-away · ¼ kg · ½ kg · 1 kg (tipos de tarjeta) | `take-away` · `beans-quarter` · `beans-half` · `beans-kilo` |
| juego de dibujos del sello | `stamp` (el nombre del juego en `public/stamps/`: `seal`) |
| color de la tarjeta (1 a 4, `tarjeta-1`… en el tema) | `color` |
| la marca (nombre, Club) | `brand` |

Una palabra nueva del negocio se agrega a esta tabla en el mismo pull request.

## Las carpetas

```
app/src/
├── core/            entidades: reglas del Club, puras
├── application/     casos de uso y sus puertos (ports.ts)
├── platform/        adaptadores: base, seguridad, registros, reloj (.server) y la raíz de composición
├── cafes/           la configuración de cada cafetería
├── routes/          una carpeta por dirección: pantalla + servidor + pruebas
├── web/             lo que comparten las rutas y no es visual: leer formularios, la tarjeta de adelante en la URL
├── components/      piezas visuales compartidas
├── styles/          variables de la marca y estilos base
├── root.tsx
└── routes.ts        flatRoutes(): lee la carpeta routes/

app/test/            lo que usan las pruebas: la D1 en memoria (db.ts), los puertos en memoria (fakes.ts) y las fábricas
app/migrations/      las migraciones en SQL, generadas por Drizzle
```

### `core/`: las reglas del Club

Funciones puras en TypeScript: reciben datos y devuelven datos.

| Archivo | Qué tiene |
|---|---|
| `card.ts` | El estado de una tarjeta a partir de sus movimientos: sellos de la vuelta, premios disponibles; completar, canjear, deshacer; y el saldo justo después de un movimiento (`balanceAfter`), para la confirmación de la caja |
| `document.ts` | Validar el formato de un DNI o de otro documento (no el hash: eso es plataforma) |
| `codes.ts` | Qué caracteres usa el código corto (sin letras que se confundan, como 0 y O), y si lo que tipeó o leyó la caja es un código corto o el del QR |
| `progress.ts` | Cuánto le falta para el premio: *Le faltan 2 para el café gratis.* |
| `greeting.ts` | *Buenos días*, *Buenas tardes* o *Buenas noches* según la hora |
| `displayCard.ts` | Las tarjetas de un cliente listas para mostrar, en el orden fijo de la cafetería |
| `customerName.ts` | Validar el nombre con el que se anota el cliente |
| `staffPin.ts` | PIN del equipo de 6 números, sin secuencias ni repetidos |
| `access.ts` | Qué puede hacer cada rol y a quién puede cambiar el gerente ([Los roles del equipo](#los-roles-del-equipo)) |
| `when.ts` | Cuándo pasó algo, con la voz del Club: *8 de octubre, 12:00*, en la hora del café |
| `summary.ts` | Los números de *Resumen* (Flujo J): las fechas elegidas y las rápidas (7, 30 y 90 días), los cuatro números de arriba, día por día (o semana, o mes), cuántas veces vino cada cliente, cada tarjeta, el mapa de días y horas en la hora del café, y la frase de cada uno |
| `staff.ts` | Los roles del equipo y el email con el que entran (el mismo que pide `scripts/staff.mjs`) |

**No puede** importar nada del proyecto, ni la base, ni React, ni Cloudflare. Tampoco busca la hora: la recibe. Por eso se prueba en segundos.

### `application/`: los casos de uso

Lo que hace la app, paso a paso: validar con el núcleo, pedir o guardar por los puertos, devolver un resultado. **No conoce** el `Request`, Drizzle, D1, React Router ni Cloudflare: recibe datos simples y sus dependencias como parámetro.

| Archivo | Qué tiene |
|---|---|
| `ports.ts` | Los puertos: `CustomerRepository`, `CardRepository`, `StaffRepository`, `Clock`, `DocumentHasher`, `PinVerifier`, `PinIssuer`, `CodeGenerator`, `SessionIssuer`, `BotGate`, `Logger`. Solo tipos |
| `signIn.ts` | Entrar con el documento: si ya es del Club, su sesión; si es nuevo, confirmar el número |
| `signUp.ts` | El alta: nombre, consentimiento, el cliente con sus tarjetas y su sesión |
| `viewWallet.ts` | La billetera: el saludo y las tarjetas en el orden fijo |
| `viewCard.ts` | El código de una tarjeta |
| `isSignedIn.ts` | Si la sesión todavía es de un cliente que existe |
| `recordEntry.ts` | Sumar sello, canjear o deshacer, con el saldo al día y reintentos si la tarjeta cambió; con la versión que vio el barista, nunca dos veces |
| `findCard.ts` | *Buscar tarjeta* en la caja: por el código corto o el del QR |
| `viewRegisterCard.ts` | La tarjeta en la caja: el nombre del cliente, la tarjeta, cuánto le falta y su versión |
| `registerEntry.ts` | Sumar sello o canjear sobre la tarjeta que vio el barista, y deshacer |
| `viewEntry.ts` | La confirmación de un movimiento, como quedó la tarjeta con él |
| `gateMessages.ts` | Los mensajes de la puerta, con la voz del Club |
| `staffSignIn.ts` | Entrar a la caja con email y PIN, y el bloqueo de 15 minutos. Un solo mensaje si el email o el PIN están mal o si está bloqueada, que ya dice que hay que esperar: así no dice qué emails son del equipo. Y cada intento fallido tarda al menos 1,2 segundos, para que el tiempo tampoco lo diga |
| `summary.ts` | *Resumen*, del gerente: revisa `core/access.ts` y lee desde el primer día elegido |
| `team.ts` | *Equipo*, del gerente: ver al equipo, agregar un barista, cambiar su nombre o email, un PIN nuevo, dar de baja y volver a activar. Cada uno revisa `core/access.ts` y responde `forbidden` |

Cada caso de uso se prueba con los puertos en memoria de [`test/fakes.ts`](../../app/test/fakes.ts): rápido y sin base. Lo que importa que quede guardado de verdad se prueba además contra D1, en `platform/`.

### `platform/`: los adaptadores

La prueba: **¿cambiaría si nos mudáramos de Cloudflare?** Si sí, va acá. Cada adaptador implementa un puerto de `application/ports.ts`.

| Archivo | Qué hace |
|---|---|
| `app.server.ts` | **La raíz de composición:** el único lugar que conecta los casos de uso con sus adaptadores, una vez por pedido (`appFor(request, env)`). Las rutas solo entran por acá |
| `db/schema.ts` | Las tablas, con Drizzle |
| `db/customerRepository.server.ts` | `CustomerRepository` en D1: buscar por hash o por id; el alta del cliente con sus tarjetas, todo junto |
| `db/staffRepository.server.ts` | `StaffRepository` en D1: buscar a una persona del equipo por email o por id, y sus PIN fallidos (con `security/pinAttempts.server.ts`) |
| `db/summaryRepository.server.ts` | `SummaryRepository` en D1: lo que cuenta *Resumen*, en un solo viaje, con el cliente de cada tarjeta (la de un cliente borrado cuenta como uno propio). Solo lo que sigue en pie (nada deshecho), los sellos de antes como una cuenta por tarjeta, y los premios sin canjear de los clientes que siguen en el Club |
| `db/cardRepository.server.ts` | `CardRepository` en D1: las tarjetas con su saldo, la tarjeta para la caja (solo con dueño), los movimientos de una tarjeta en orden (en un solo viaje) y guardar un movimiento con el saldo nuevo |
| `db/cafeDb.server.ts` | La base D1 de la cafetería del pedido |
| `currentCafe.server.ts` | De qué cafetería es el pedido. Hoy, siempre la activa (`cafes/index.ts`); mañana, según el dominio |
| `security/rateLimit.server.ts` | El tope de intentos por conexión (*Rate Limiting* de Workers, `SIGN_IN_LIMIT`) |
| `security/botGate.server.ts` | `BotGate`: el tope de intentos y Turnstile |
| `secrets.server.ts` | Lee los secretos una vez y frena con un error claro si falta alguno |
| `security/hmac.server.ts` | HMAC-SHA256 con Web Crypto; comparar en tiempo constante |
| `security/documentHasher.server.ts` | `DocumentHasher`: el HMAC del DNI con la clave secreta |
| `security/turnstile.server.ts` | Le pregunta a Cloudflare si el Turnstile es válido |
| `security/sessions.server.ts` | `SessionIssuer`. Crear, leer, renovar y cerrar sesiones: una cookie firmada, sin tabla ([Las sesiones](#las-sesiones)) |
| `security/staffPin.server.ts` | Guardar y verificar el PIN del equipo: HMAC con la clave secreta `PIN_HMAC_KEY`. Y `PinIssuer`: sortear un PIN nuevo, nunca uno fácil |
| `security/pinAttempts.server.ts` | Bloquear 15 minutos a una persona después de 5 PIN fallidos seguidos. Cada PIN toma su intento antes de revisarse, así muchos mandados a la vez no pasan de 5 |
| `codes.server.ts` | `CodeGenerator`: el código del QR y el código corto, al azar |
| `live/cardWatch.server.ts` | El *Durable Object* `CardWatch`, uno por tarjeta: tiene abiertas las conexiones de las pantallas del código y les avisa. Solo lo importa `workers/app.ts` |
| `live/watchers.server.ts` | `CardWatchers`: avisarle al `CardWatch` de una tarjeta qué pasó |
| `live/liveRequest.server.ts` | `/live/cards/:type`: con la sesión del cliente, solo su tarjeta y solo desde las páginas de la app |
| `log.server.ts` | `Logger`: registrar eventos y errores **tachando el DNI y el nombre** |
| `clock.ts` | `Clock`: la hora actual, que las pruebas pueden fijar |

**Tres reglas:**
1. **No toma decisiones del negocio.** Un `if` sobre sellos o premios acá está en el lugar equivocado: va en `core/` o en un caso de uso.
2. Cada archivo es un **envoltorio fino** sobre una sola cosa externa.
3. Todo lo que toca secretos o la base termina en **`.server.ts`**: React Router nunca lo manda al celular.

### `cafes/`: la configuración

Un archivo por cafetería: las tarjetas (nombre, sellos, premio, juego de sellos y color), los textos propios (el nombre de la cafetería y del Club, la bienvenida, quién guarda los datos) y la zona horaria. `example.ts` es la cafetería de ejemplo (la usan las pruebas de las reglas) e `index.ts` dice cuál es la activa. Es **configuración**, no infraestructura: la usan el núcleo (cuántos sellos) y las pantallas (colores y textos). Cómo se arma una nueva: [`marca/README.md`](../../marca/README.md) y [varias-cafeterias.md](varias-cafeterias.md).

**La marca en las pantallas:** el *loader* de la raíz (`root.tsx`) trae el nombre de la cafetería y su Club (`components/brand.ts`): los títulos de las páginas, los textos de los logos y el sello de la caja los leen de ahí con `useBrand()` y `pageTitle()`. Los colores, las letras y los tamaños salen del tema (`marca/tokens.json`, pasado a `styles/tokens.css`); los logos, de `public/brand/`, y los sellos, de `public/stamps/`. Ningún color ni nombre de una cafetería queda fijo en el código.

### `routes/`: una carpeta por dirección

Convención de React Router (`@react-router/fs-routes`). En cada carpeta, **solo `route.tsx` es la ruta**; lo demás vive al lado:

```
routes/register._staff.card.$code/
├── route.tsx            pantalla + loader + action (finitos)
└── route.test.ts        sus pruebas, de punta a punta con la D1 de prueba
```

**El `loader` y la `action` son finitos:** leen el formulario o la dirección, piden el caso de uso a `appFor(request, env)`, lo llaman con datos simples y convierten el resultado en `redirect` o `data`. Las reglas y la orquestación no van ahí.

**El mapa de la primera salida:**

| Carpeta | Dirección | Qué es | Sesión |
|---|---|---|---|
| `_index` | `/` | Bienvenida con el documento (o a las tarjetas, si ya entró). Si es nuevo, confirma el número en una hoja, ahí mismo | — |
| `sign-up` | `/sign-up` | Nombre y consentimiento, la primera vez. Sin loader: el documento viaja en el formulario | — |
| `_customer` | — | *Layout*: exige sesión de cliente y la renueva | Cliente |
| `_customer.cards._index` | `/cards` | Las 4 tarjetas, como billetera (`?front=` elige la de adelante; cambiarla no le pide nada al servidor) | Cliente |
| `_customer.cards.$type` | `/cards/take-away` | Una tarjeta con su QR y código corto | Cliente |
| `_customer.sign-out` | `/sign-out` | Confirmar y cerrar la sesión | Cliente |
| `_customer.install` | `/install` | Guardar en la pantalla de inicio (etapa 5) | Cliente |
| `register.sign-in` | `/register/sign-in` | Entrar el equipo | — |
| `register.sign-out` | `/register/sign-out` | Salir de la caja, sin confirmación (solo el formulario) | — |
| `register._staff.team` | — | *Layout* de *Equipo*: solo el gerente; un barista vuelve a la caja | Gerente |
| `register._staff.team._index` | `/register/team` | La lista del equipo | Gerente |
| `register._staff.team.new` | `/register/team/new` | Agregar barista; el PIN, una sola vez | Gerente |
| `register._staff.team.$member` | `/register/team/…` | Una persona: cambiarla, PIN nuevo, baja, y su historial | Gerente |
| `register._staff` | — | *Layout*: exige sesión de equipo | Equipo |
| `register._staff._index` | `/register` | Escanear o tipear el código | Equipo |
| `register._staff.card.$code` | `/register/card/K7M2QX` | *Sumar sello* · *Canjear premio* | Equipo |
| `register._staff.summary` | `/register/summary` | *Resumen*: los números del Club entre dos fechas (`?from=2026-10-05&to=2026-10-11`); un barista vuelve a la caja | Gerente |
| `register._staff.done.$entry` | `/register/done/123` | Confirmación con *Deshacer* | Equipo |
| — | `/live/cards/take-away` | El WebSocket del sello en vivo. No es una ruta: lo atiende la entrada del Worker (`workers/app.ts`), antes de React Router ([El sello en vivo](#el-sello-en-vivo)) | Cliente |

Los *layouts* con `_` (`_customer`, `_staff`) no agregan nada a la dirección: **exigen la sesión una sola vez**, así una pantalla nueva no puede olvidarse de pedirla. El de cliente también la **renueva**: devuelve el `Set-Cookie` con `data(…, { headers })` y React Router lo suma a la respuesta de cualquier pantalla de adentro (si la pantalla no define su propio `headers`). Al pasar de una pantalla a otra no se le pregunta (la pantalla no lo espera, `web/instant.ts`): la renueva cuando se abre la app y cada vez que una pantalla le vuelve a preguntar al servidor, cosa que la billetera y el código de una tarjeta hacen enseguida cuando se muestran desde la copia del teléfono. Las pantallas de adentro leen la sesión sin renovarla y le piden al caso de uso los datos del cliente: si lo borraron, el caso de uso no lo encuentra y la pantalla vuelve a la bienvenida.

**Ojo con el anidamiento:** si existe la carpeta `a.b`, la carpeta `a.b.c` se muestra **adentro** de `a.b`. Por eso la de las 3 tarjetas es `_customer.cards._index` y no `_customer.cards`: así `/cards/take-away` es una pantalla propia. Al agregar una ruta, revisar el árbol con `npx react-router routes`.

### `web/`: lo que comparten las rutas

Funciones chicas sobre `Request`, `FormData` y `URL` que usan varias rutas: `form.ts` (leer un campo del formulario), `frontCard.ts` (si de una dirección a otra solo cambia la tarjeta de adelante), `offline.ts` y `offlineCopy.ts` (qué hace una pantalla sin conexión) y `sw/`, el *service worker* ([La app sin conexión](#la-app-sin-conexión)). Una ruta no puede importar otra ruta, así que lo compartido que no es visual vive acá. Lo que usa una sola pantalla queda en su carpeta, como `routes/_customer.cards._index/wallet.ts` (qué tarjeta va adelante y el orden de las de atrás).

### `components/` y `styles/`

- `components/`: lo que usan varias pantallas (la tarjeta, la grilla de sellos, el QR, botones, avisos). Lo que usa una sola pantalla queda en su carpeta de `routes/`.
- `styles/`: `base.css` (los estilos base), `cards.css` (la billetera y la tarjeta), `register.css` (la caja) y `tokens.css`, generado desde [`tokens.json`](../../marca/tokens.json) con `npm run tokens` (que también escribe `theme.ts`, el color del navegador, y el manifiesto de la app desde `manifest.ts`). `appIcon.ts` dibuja el ícono de la app (`npm run icons`).

## Quién puede usar a quién

```
routes/  ──▶  platform/app.server.ts  ──▶  application/  ──▶  core/
   │                  │                        ▲
   │                  └──▶  platform/ (adaptadores) ──┘ implementan los puertos
   └──▶  components/  ──▶  core/ (solo tipos y cálculos)
cafes/ ◀── todos la pueden leer
```

| Carpeta | Puede usar | No puede usar |
|---|---|---|
| `core/`, `cafes/` | Entre ellas (`core/` usa solo los tipos de `cafes/`) | Todo lo demás, también `web/` |
| `application/` | `core/`, `cafes/` | `platform/`, `routes/`, `web/`, `components/`, Drizzle, React, React Router, Wrangler. Tampoco devuelve códigos HTTP: dice qué pasó (`reason`) y la ruta elige el estado |
| `platform/` | `application/` (puertos y casos de uso), `core/`, `cafes/` | `routes/`, `components/` |
| `routes/` | `platform/app.server.ts`, `application/` (tipos), `core/`, `web/`, `components/`, `cafes/` | El resto de `platform/` y otra carpeta de `routes/` (lo compartido sube a `web/`, `components/` o `core/`) |
| `web/` | `core/`, `cafes/` | `platform/`, `application/`, `routes/`, `components/` |
| `components/` | `core/`, `cafes/` | `platform/`, `application/`, `routes/` |

**La revisa el lint:** `noRestrictedImports` de Biome, por carpeta, en [`biome.json`](../../app/biome.json). Un import prohibido frena la CI con un mensaje que apunta acá. Las pruebas (`*.test.ts`) pueden importar lo que necesiten.

### Las transacciones

No hay una unidad de trabajo genérica: lo que tiene que guardarse todo junto es **un solo método de un repositorio**, que lo hace en un `batch` de D1.

| Método | Qué guarda junto |
|---|---|
| `CustomerRepository.createWithCards` | El cliente y sus tarjetas |
| `CardRepository.appendEntry` | El movimiento y el saldo nuevo de la tarjeta, solo si la tarjeta sigue en la `version` que se leyó |

Si un caso de uso nuevo necesita guardar dos cosas juntas, se agrega un método así al repositorio, con su prueba contra D1.

## La base de datos

Una base por cafetería ([varias-cafeterias.md](varias-cafeterias.md)), con jurisdicción UE.

| Tabla | Qué guarda |
|---|---|
| `customers` | id, **`dni_hmac`** (único; nunca el número), `name`, `created_at` (fecha de alta), `updated_at` |
| `cards` | id, `customer_id` (vacío si se lo borró: la tarjeta queda **sin dueño** y no aparece en la caja), `type`, **`qr_code`** (largo, al azar), **`short_code`** (6 caracteres, al azar). Fijos para siempre. Su **saldo** (`stamps`, `rewards`), su `version` y `created_at` |
| `entries` | los movimientos: tarjeta, `stamp`, `redeem` o `undo`, **qué anula** (`undoes_id`, solo en `undo`), cuándo (`at`) y **quién lo hizo** (`staff_id`). **Solo crece:** ninguna fila se cambia ni se borra |
| `staff_audit` | quién cambió a cada persona del equipo, qué (`added`, `name-changed`, `email-changed`, `pin-reset`, `deactivated`, `reactivated`) y cuándo. Nunca el PIN ni los valores. **Solo crece.** Se guarda junto con el cambio (migración 0007) |
| `staff` | las personas de la caja: **email** (único, con el que entran), `name` (se puede repetir), `role` (`barista` o `manager`), **PIN con HMAC**, intentos fallidos, hasta cuándo está bloqueada **`deactivated_at`** (cuándo dejó de trabajar; vacío: activa), `created_at` y `updated_at` |

Los id son al azar (`crypto.randomUUID()`), no números seguidos. Las restricciones viven en la base y tienen su prueba: un documento por cliente, una tarjeta de cada tipo, códigos únicos, `stamp`, `redeem` o `undo`, un deshacer dice qué anula y cada movimiento se deshace una sola vez, una persona del equipo por email.

**Al borrar a un cliente** (Flujo G), se borran de verdad su nombre y el hash de su documento (lo pide la Ley 25.326 si el cliente lo solicita; no alcanza con marcarlo como borrado). Sus tarjetas quedan **sin dueño** y sus movimientos quedan con su tarjeta, su tipo y quién los hizo: es un historial anónimo y los números del panel siguen cerrando. Su cookie de sesión apunta a un id que ya no existe: no encuentra nada y vuelve a la bienvenida. Una persona del equipo con movimientos no se puede borrar: se le pone `deactivated_at`.

**El libro mayor:** el estado de una tarjeta se calcula desde sus movimientos (`core/card.ts`). Deshacer es **una fila nueva** de tipo `undo` que apunta al sello o canje que anula (`undoes_id`), como un asiento contable que anula a otro: nada se tacha. Su `at` y su `staff_id` dicen quién deshizo y cuándo, así que la auditoría ya está incluida. **El saldo:** cada tarjeta guarda una copia de su estado (`stamps`, `rewards`) para leerla sin recorrer sus movimientos: las pantallas del cliente leen solo eso. Lo mantiene el caso de uso `recordEntry` (`application/recordEntry.ts`), que valida con las reglas del núcleo y guarda el movimiento y el saldo nuevo **en una sola transacción** (`CardRepository.appendEntry`). Si dos acciones llegan a la vez sobre la misma tarjeta, solo se guarda la que encuentra la tarjeta en la `version` que leyó; la otra vuelve a leer y reintenta (hasta 3 veces; si no, la caja recibe `busy` y no se pierde nada sin avisar). Así tampoco se puede canjear dos veces el mismo premio. El libro sigue siendo la verdad: si un saldo no coincidiera, se vuelve a sacar del libro con la misma cuenta (`cardBalance`, o el `UPDATE` de la migración 0003).

**Fechas de auditoría** (migración 0005): `created_at` dice cuándo se creó la fila y `updated_at` cuándo cambió por última vez (vacío: nunca cambió). Las pone Drizzle (`$defaultFn` y `$onUpdateFn` en `schema.ts`); un `INSERT` o `UPDATE` escrito en SQL, como el de `scripts/staff.mjs`, las tiene que poner a mano. Un PIN fallido no cuenta como cambio de la persona. `cards` no tiene `updated_at`: solo cambia con sus movimientos, y el libro dice cuándo. `entries` no necesita ninguna de las dos: su `at` y su `staff_id` ya son la auditoría. **Quién** hizo cada cambio: en `staff_audit` para el equipo (08/10/2026); para los clientes, pendiente.

**Migración 0004:** pasó la base al inglés (tablas, columnas y valores guardados) copiando cada tabla a una nueva con su nombre en inglés. Los id no cambiaron.

## El sello en vivo

Decidido el 07/10/2026: **en tiempo real**, con un *Durable Object* por tarjeta.

| Tema | Cómo |
|---|---|
| Quién escucha | La pantalla del código, mientras está a la vista. Abre un WebSocket a `/live/cards/take-away`; la entrada del Worker revisa la sesión del cliente, que el pedido venga de la app (`Origin`) y que la tarjeta sea suya, y se lo pasa al `CardWatch` de esa tarjeta |
| Quién avisa | Los casos de uso de la caja (`registerEntry.ts`), después de guardar: qué pasó (`stamp`, `completed`, `redeem`, `undo`) y la versión nueva de la tarjeta. Si el aviso falla, el movimiento igual cuenta y queda en el registro |
| Qué hace la pantalla | Vuelve a pedir la tarjeta (el saldo sale siempre de la base) y muestra lo que pasó: el sello que se imprime, el festejo o *Premio canjeado*. Un deshacer solo actualiza |
| Si se corta | Al bloquear el celular la conexión se cierra; al volver, se reconecta y se pone al día. Mientras está abierta, un `ping` cada 25 s la mantiene (lo contesta Cloudflare sin despertar al objeto) |
| Qué guarda | Nada: ni el nombre ni el documento. Solo las conexiones abiertas, mientras lo están |
| Dónde vive | Cerca del café (`locationHint: "sam"`). No guarda datos personales, así que no necesita la jurisdicción UE de la base |
| Costo | SQLite, el único tipo del plan gratis. Con la *WebSocket Hibernation API*, una conexión quieta no cuesta nada |
| Pruebas | Los casos de uso, con avisos en memoria; la entrada `/live`, con un objeto falso; el recorrido completo, en Playwright (el cliente ve el sello sin recargar) |

## La app sin conexión

Hecho el 09/10/2026 (etapa 5a). Lo que pide el [flujo 5](../flujos-cliente.md#flujo-5--casos-fuera-del-camino): sin conexión, el código de cada tarjeta se muestra igual.

| Tema | Cómo |
|---|---|
| El *service worker* | Propio, en `src/web/sw/sw.ts`. Lo compila esbuild al final del build como `/sw.js`, con la lista de los archivos de la app (`vite.config.ts`). En `npm run dev` no hay |
| Qué guarda | Los archivos de la app, al abrirla la primera vez (no el lector de QR de la caja, 1 MB). Y la billetera y el código de cada tarjeta: los pide al servidor y, sin conexión, muestra el último que guardó. Qué se guarda y qué no lo decide `cachePlan.ts`, con sus pruebas |
| Qué no guarda | Nada de la caja (`/register`): ni se registra ahí. Nada de lo que se envía. Tampoco *Tus sellos y premios* |
| Una tarjeta que nunca se abrió | La billetera trae los códigos de las 3 y el celular guarda una copia (`web/offlineCopy.ts`, en `localStorage`). Sin conexión, el `clientLoader` de la billetera y del código salen de esa copia (`orWhatIsKept`) |
| El mapa de pantallas | Viene entero con la página (`routeDiscovery: "initial"`): sin conexión, abrir una tarjeta no le pregunta al servidor dónde está |
| Al volver la conexión | Las pantallas del cliente se vuelven a pedir solas, y el código se pone al día con el sello en vivo |
| Al salir | La bienvenida borra la copia y las páginas guardadas: *Salir*, o una sesión que terminó. Si el servidor manda a la bienvenida, el *service worker* también las borra |
| Una versión nueva | Se instala sola al abrir la app con conexión: vuelve a pedir las páginas guardadas y recién ahí borra los archivos viejos |
| Lo que no cubre | Con señal muy mala (que no corta pero no responde), el celular espera a la red como siempre. A probar en el celular real |

## Otras decisiones

| Tema | Decisión |
|---|---|
| Validar lo que entra | **Valibot**, en cada `loader` y `action` |
| Nombres | Todo en inglés, con el [glosario](#el-código-en-inglés) |
| Hora | Siempre de `platform/clock.ts`; el núcleo la recibe |
| Registros | Solo con `platform/log.server.ts`, también los errores de React Router (`handleError` en `entry.server.tsx`). Nunca `console.log` con datos de un cliente: los errores de Drizzle traen los datos de la consulta |
| Pruebas | Al lado del código (`*.test.ts`), según la skill `pruebas` |

## El ingreso del equipo

Decidido el 06/10/2026: **email + PIN de 6 números** ([Flujo A](../flujos-equipo.md)).

| Tema | Cómo |
|---|---|
| Guardar el PIN | `HMAC-SHA256(PIN_HMAC_KEY, id de la persona + PIN)`. Con la persona adentro, dos con el mismo PIN no tienen el mismo hash |
| Por qué HMAC y no PBKDF2 | Un PIN de 6 números tiene un millón de combinaciones: un hash lento no lo protege si se filtra la base, pero **la clave secreta sí** (sin ella no se puede probar ninguna). Y es rápido: entra holgado en los **10 ms** de cálculo del plan gratis |
| Comparar | En tiempo constante, para no dar pistas por cuánto tarda |
| Intentos | 5 fallidos seguidos bloquean a esa persona 15 minutos; se guarda en la tabla `staff`. Cada PIN toma su intento antes de revisarse: mandar muchos a la vez no da más de 5 (09/10/2026). El bloqueo responde igual que un PIN mal puesto, con el mismo mensaje, para no decir qué emails son del equipo (09/10/2026). Un intento fallido (email desconocido, PIN mal puesto o bloqueo) responde en no menos de 1,2 segundos (`FAILED_SIGN_IN_MS`), así el tiempo no dice qué emails son del equipo |
| PIN fáciles | Regla en `core/`: no se aceptan secuencias ni repetidos (`123456`, `000000`) |
| Crear un PIN | Para un barista, el gerente desde *Equipo*: la app lo sortea y se muestra una vez (08/10/2026). Para un gerente, los desarrolladores con `npm run staff:create` |

## Las sesiones

Decidido el 06/10/2026: **cookie firmada, sin tabla en la base**.

| Tema | Cómo |
|---|---|
| Qué lleva la cookie | De quién es y cuándo vence (y, en el equipo, la huella del PIN), firmado con HMAC. Si se cambia una letra, no sirve. Va firmada, no cifrada: no lleva nada secreto |
| Claves | `CUSTOMER_SESSION_KEY` y `STAFF_SESSION_KEY`. Cambiar una saca a todos los de ese tipo, sin tocar a los otros |
| Cookie | `__Host-session` (cliente) y `__Host-staff-session` (equipo), `HttpOnly`, `Secure`, `SameSite=Lax`. El vencimiento va también adentro de lo firmado: el celular no lo puede estirar |
| Duración | Cliente 12 meses, equipo 30 días (decidido el 07/10/2026); se renuevan al usarse (la cookie nueva se manda como mucho una vez por día), así que cuentan desde el último uso |
| Cliente | No consulta la base para saber quién es |
| Equipo | En cada pedido se lee su fila: si tiene `deactivated_at`, o si su PIN cambió (la huella no coincide), queda afuera |
| Se pierde el celular de la caja | El gerente le cambia el PIN a esa persona desde el panel. El gerente **no** puede cambiarse el suyo: si la sesión expuesta es la suya, los desarrolladores le cambian el PIN con el script o cambian `STAFF_SESSION_KEY` |
| *Salir* | Borra la cookie del celular. Una copia de esa cookie seguiría sirviendo hasta vencer: es el costo de no tener tabla |

Por qué no una tabla: no hace falta limpiar sesiones vencidas ni escribir al renovar, y la base no guarda quién usó el Club ni cuándo. Lo que se pierde (cortar un solo celular de un cliente, ver las sesiones abiertas) no hace falta: con la sesión de un cliente solo se ven sellos.

## Los roles del equipo

Decidido el 07/10/2026: **los permisos se controlan en el caso de uso, no en la pantalla.**

| Tema | Cómo |
|---|---|
| Por qué en el código | D1 es SQLite: no tiene usuarios, `GRANT` ni políticas por fila. El Worker entra a la base con un solo acceso |
| Dónde | `core/access.ts`: qué puede hacer cada rol (`barista`, `manager`), como regla pura. Por ejemplo: el gerente no puede cambiarse su propio PIN |
| Quién lo controla | **El caso de uso**: recibe a la persona (de `readStaffSession`) y, si no puede, devuelve `reason: "forbidden"`; la ruta responde 403. Un `action` se puede llamar con un POST aunque el botón esté oculto |
| Además | El layout de la ruta saca a quien no puede entrar a una pantalla, y la pantalla oculta los botones. Las dos cosas son solo comodidad |
| Cambio de rol | Vale desde el pedido siguiente: la fila se lee en cada pedido |
| El cliente | No tiene rol: ve solo lo suyo. El `customerId` sale siempre de la cookie, nunca de la dirección ni del formulario |
| Los desarrolladores | No tienen rol en la app: operan con los scripts y la CI |
| Permisos en tablas | No: con dos roles fijos, el código se prueba y se revisa en el pull request. Solo si cada cafetería quisiera armar sus propios roles |
| Pruebas | En `core/`, todos los roles contra todas las acciones; en cada caso de uso del gerente, que el barista reciba `forbidden` |

**Construido el 08/10/2026 con *Equipo*** (Flujo H), la primera acción solo del gerente. `can(rol, acción)` dice qué puede hacer cada rol, y `canManage(quién, a quién)` a quién puede cambiar: el gerente cambia a los baristas, nunca a otro gerente ni a sí mismo.

## Abiertos

- [x] Duración de la sesión del equipo → 30 días sin usar (07/10/2026).

## Referencias

- [Functional Core, Imperative Shell (Gary Bernhardt)](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell)
- [Convención de rutas por archivos de React Router](https://reactrouter.com/how-to/file-route-conventions)
- [Epic Stack](https://github.com/epicweb-dev/epic-stack): una app completa con React Router, para mirar cómo resuelven sesiones y pruebas
