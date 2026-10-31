---
name: pruebas
description: Estrategia de pruebas del Club - qué probar, en qué capa (reglas del negocio, servidor con D1, recorridos en el navegador, accesibilidad, después de publicar), con qué herramienta y con qué datos. Usar siempre que se escriba, cambie o revise código de la app, al arreglar un error, al agregar una regla del negocio o una pantalla, al revisar un pull request, o cuando alguien pregunte "cómo lo pruebo", "qué pruebas faltan" o "escribí los tests".
---

# Pruebas del Club

Probar mucho lo que le puede costar plata o confianza a la cafetería (sellos, premios, el DNI) y poco lo visual. Las reglas salen del [spec](../../../docs/propuestas-tarjeta-fidelizacion.md), de los [flujos del cliente](../../../docs/flujos-cliente.md) y de los [flujos del equipo](../../../docs/flujos-equipo.md): si una prueba contradice esos documentos, gana el documento y se avisa.

## Cómo trabajar

1. **La prueba primero, a partir del spec.** Antes de escribir el código, escribir la prueba con lo que *tiene que pasar* según el spec o el flujo, no con lo que el código ya hace. Verla fallar.
2. Escribir el código mínimo para que pase.
3. **Cada error arreglado suma una prueba** que lo habría detectado. Primero la prueba que reproduce el error (falla), después el arreglo (pasa).
4. Antes de pedir revisión: `npm run lint`, `npm run typecheck`, `npm test` (y `npm run test:e2e` si tocó pantallas), todo en verde. Nunca saltear, desactivar ni borrar una prueba para que la CI pase.

## Las capas

Elegir la capa **más baja** que alcance para probar lo que importa.

| Capa | Herramienta | Qué va acá | Cuántas |
|---|---|---|---|
| **1. Reglas del negocio** | Vitest, en `app/src/**/*.test.ts` junto al código | Funciones puras, sin base ni framework: sumar sello, completar la tarjeta, canjear, deshacer, hash y validación del DNI, saludo según la hora, configuración de tarjetas por cafetería | **Muchas.** Al menos una por regla del spec |
| **1b. Casos de uso** | Vitest, en `app/src/application/*.test.ts`, con los puertos en memoria de `app/test/fakes.ts` | Lo que hace la app sin base: qué se valida antes de la puerta, qué se guarda, qué devuelve en cada caso, reintentos | Una por camino del caso de uso |
| **2. Servidor + base** | Vitest con `getPlatformProxy` de Wrangler y una D1 local con las migraciones (el *pool* de Workers pide Vitest 4; ver [plan.md](../../../docs/implementacion/plan.md)) | *Loaders* y *actions* de punta a punta del servidor: lo que se guarda, quién lo hizo, sesiones, permisos, aislamiento entre cafeterías | Varias por acción importante |
| **3. Recorridos** | Playwright, celular de 360 × 740 px, en `app/e2e/journeys/*.spec.ts` | Solo los caminos que no pueden fallar (lista abajo) | **5 a 8 en total.** No sumar más sin motivo |
| **4. Accesibilidad y reglas de pantalla** | axe + Playwright, en `app/e2e/screens/*.spec.ts`, con `expectScreenRules()` de `app/e2e/support/screenRules.ts` | Una pasada por pantalla: axe sin errores, más los chequeos propios (abajo) | Una por pantalla |
| **5. Después de publicar** | Un pedido a la dirección publicada, en la CI | Que dev y prod respondan | Una por ambiente |

Más **una manual:** probar en un celular real en dev antes de pasar a prod.

## Lo que siempre tiene prueba

**Reglas del Club** (capa 1, y la 2 si toca la base):
- Las tarjetas de la cafetería de ejemplo (`app/src/cafes/example.ts`): Café take-away, 7 sellos + premio; Café en grano ¼ kg, ½ kg y 1 kg, 4 sellos + premio. Las pruebas de las reglas usan siempre la de ejemplo, no la activa.
- Al completar, gana un premio y los sellos vuelven a cero. Los premios se acumulan.
- **Canjear no suma sello.** Los sellos y los premios **no vencen**.
- **Todo se puede deshacer**, y deshacer queda registrado con quién lo hizo. Deshacer un canje devuelve el premio.
- Un sello que completó la tarjeta **no se puede deshacer si su premio ya se canjeó**.
- **Escanear el QR suma un sello solo**, a nombre de quien está en la caja; con un premio en la tarjeta no suma y abre el aviso. Tipear el código no suma: abre la tarjeta.
- **Tocar dos veces o reintentar con mala señal suma un solo sello** (y canjea un solo premio): la caja guarda solo si la tarjeta sigue en la versión que vio el barista.

**DNI y seguridad** (capa 2):
- **El DNI nunca queda en texto en la base:** después de anotar a alguien, buscar el número en todas las columnas y que no aparezca.
- El mismo DNI con la misma clave da el mismo hash; con otra clave, otro.
- Un DNI mal escrito (letras, pocos dígitos, puntos) se rechaza con un mensaje en la voz del Club.
- El DNI no aparece en ninguna respuesta de la caja ni del panel, ni en los registros.
- Sin Turnstile válido no hay alta ni ingreso.
- Una persona del equipo de una cafetería no ve datos de otra.
- La sesión del cliente dura 12 meses y se renueva al usarse.

**Recorridos** (capa 3, los únicos):
1. Anotarse con DNI y nombre, y ver las cuatro tarjetas.
2. Volver a entrar con el mismo DNI.
3. La caja escanea, el sello se suma solo y el cliente lo ve.
4. Completar una tarjeta y canjear el premio.
5. Deshacer en la caja.
6. **Sin conexión, el código de la tarjeta se sigue mostrando.**

**Reglas de pantalla** (capa 4, chequeos propios además de axe):
- Ningún texto visible de menos de **16px**.
- Botón principal de al menos **56px** de alto; *Sumar sello* y *Canjear premio* en la caja, **72px**. Nada que se toque de menos de 48px.
- Sin scroll horizontal a 360 px.

## Datos de prueba

- **Siempre inventados:** *Marta García, 30.123.456*. Nunca datos reales, ni para reproducir un error de un cliente: se inventa un caso equivalente.
- Usar **fábricas** (funciones que arman un cliente, una tarjeta o un movimiento con valores por defecto) en vez de repetir objetos en cada prueba. Están en [`app/test/factories.ts`](../../../app/test/factories.ts).
- **Capa 2:** `testDb()` de [`app/test/db.ts`](../../../app/test/db.ts) levanta una D1 en memoria con las migraciones, una por archivo de pruebas (`beforeAll`), y `clear()` en `beforeEach`. Para una restricción de la base, comprobar cuál falló con `errorCause()`, no solo que falle.
- **Cada prueba arranca de cero:** base limpia, sin depender del orden ni de otra prueba.
- La clave del DNI en las pruebas es una de prueba, nunca la de dev ni la de prod.
- La hora se fija en la prueba (por ejemplo, para el saludo), nunca se usa la hora real.

## Cómo se escriben

- **En inglés**, como el resto del código ([arquitectura.md](../../../docs/implementacion/arquitectura.md#el-código-en-inglés)): `describe("redeem a reward")`, `it("doesn't add a stamp")`. El nombre dice la regla, no la implementación.
- Una regla por prueba. Si el nombre necesita un "y", son dos pruebas.
- Probar lo que se ve desde afuera (qué devuelve, qué queda guardado, qué ve la persona), no cómo está hecho por dentro.
- **Dónde va cada prueba:** las de Vitest terminan en `.test.ts` y viven al lado del código, en `app/src/`. Las de Playwright terminan en `.spec.ts` y viven en `app/e2e/`: `journeys/` (capa 3), `screens/` (capa 4) y `support/` (ayudantes como `signUp()`, `typeDocument()`, `madeUpDni()` y `signInAtRegister()`).
- Las de Playwright corren contra la app compilada, con su propia base local (`.wrangler/e2e`), vacía y migrada en cada corrida: nunca la de desarrollo, ni dev, ni prod. Como comparten la base, cada prueba se anota con su propio documento inventado (`madeUpDni()`). La caja entra con *Ana · barista* y *Equipo* con *Bruno · gerente*, que deja `scripts/seed.mjs`; para probar un error al entrar se usa un email que no existe, así Ana no queda bloqueada para las otras pruebas.
- En Playwright, buscar por lo que ve la persona: `getByRole("button", { name: "Sumar sello" })`, nunca por clases de CSS.
- Los textos que aparecen en las pruebas también siguen la voz del Club (skill **voz**).

## Lo que no se prueba

- Detalles de estilo (colores exactos, márgenes): los cuida la skill **revisar-pantalla**.
- El framework, Cloudflare o las librerías en sí.
- Capturas de pantalla comparadas píxel a píxel: se rompen solas.
- No hay porcentaje de cobertura obligatorio. La medida es: **cada regla del spec tiene su prueba y cada error arreglado también.**

## Comandos

Desde `app/`:

| Comando | Qué corre |
|---|---|
| `npm test` | Capas 1 y 2 |
| `npm run test:e2e` | Capas 3 y 4 (levanta la app y abre un navegador) |

Si una capa todavía no tiene su herramienta instalada (por ejemplo, `getPlatformProxy` o Playwright), instalarla en el mismo pull request que trae la primera prueba de esa capa, y sumar su comando a esta tabla, al [README](../../../README.md) y a la CI ([`ci-cd.yml`](../../../.github/workflows/ci-cd.yml)).

## Al revisar un pull request

- ¿Cada regla nueva o cambiada tiene su prueba, en la capa más baja posible?
- ¿Cada error arreglado tiene la prueba que lo reproduce?
- ¿Algún dato parece real? Si sí, frenar.
- ¿Se agregó un recorrido de Playwright? ¿Hacía falta, o alcanzaba con una capa más baja?
- ¿Alguna prueba se salteó, se desactivó o se debilitó para que pase?
