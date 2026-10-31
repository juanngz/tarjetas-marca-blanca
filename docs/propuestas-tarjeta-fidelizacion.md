# Tarjeta de fidelización digital — Propuestas y riesgos de seguridad

> Documento de trabajo. Define la tarjeta de fidelización, compara dos formas de acceso y detalla los riesgos de seguridad de cada una.
> Fecha: 29/09/2026 · Actualizado: 03/10/2026, alineado con los [flujos del cliente](flujos-cliente.md), los [flujos del equipo](flujos-equipo.md), las [reglas de interfaz](../marca/interfaz.md) y las decisiones del 03/10. 06/10/2026: alojamiento en Cloudflare.
> **Decisión:** se eligió la Propuesta A, con cuenta por DNI, sin contraseña, con sesión larga en el celular y opción de guardarla como ícono (PWA). La Propuesta B queda como alternativa analizada.
> Alcance de la revisión de seguridad: análisis a nivel diseño, no una auditoría técnica (todavía no hay nada construido para probar).

---

# 1. Base común a las dos propuestas

## Qué es

Una tarjeta de sellos digital que reemplaza a la de papel. El cliente la usa desde su celular, sin descargar nada de la tienda de apps: es una página web que se puede guardar como ícono en la pantalla de inicio (PWA).

## Etapas

1. **El Club** (este documento). Primero se hace la parte del cliente. La primera salida es la app del cliente junto con una caja mínima: entrar, escanear, tipear el código corto, sumar sello, canjear premio y deshacer. El panel del gerente va después.
2. **Tienda online.**
3. **Gestión de stock.**

El área de equipo y la base de datos se piensan desde el principio para crecer hacia la tienda y el stock. No hay fecha de lanzamiento.

## En la caja

- **Quién y con qué:** el equipo de una cafetería chica son pocas personas. Se escanea con un celular del local (por ejemplo, el del gerente), en la misma app que usan los clientes, con un login de equipo separado del ingreso por DNI.
- **Entrada del equipo:** una dirección aparte dentro del mismo sitio (por ejemplo `/caja`), guardada como su propio ícono en el celular del gerente. La app del cliente no tiene ningún enlace a la vista: 5 toques seguidos en el logo de la cafetería, solo en la bienvenida, la abren, y pide email y PIN (08/10/2026).
- **Una cuenta por persona.** Como las dos comparten el celular del gerente, quien va a atender sale de la cuenta del otro y entra con la suya. Cada acción queda a nombre de quien está ingresado. Para la primera salida, las cuentas las crean los desarrolladores; desde el panel, en la fase 2.
- **Un QR por tarjeta, fijo.** Cada tarjeta tiene su propio QR y su código corto. No cambian nunca, se muestran aunque no haya conexión y no llevan el DNI: son códigos al azar. Como el QR es de la tarjeta, la caja no tiene que elegir a qué tarjeta va el sello.
- Si el QR no se puede escanear, el barista identifica la tarjeta de otras dos maneras:
  - tipeando el código corto de la tarjeta;
  - buscando al cliente por su DNI o su nombre y eligiendo la tarjeta, como último recurso.
- Al escanear, la caja **suma el sello sola** y muestra la confirmación con el nombre del titular, la tarjeta y sus sellos, con **Deshacer** (decidido el 08/10/2026). Si la tarjeta tiene un premio, no suma: muestra la tarjeta con **Canjear premio**. Si el barista tipea el código, ve la tarjeta y toca **Sumar sello**.
- Después de cada sello, la cámara se apaga y para escanear otra vez hay que tocar *Escanear otra tarjeta*. Dos cafés son dos escaneos. Cualquier sello o canje se puede deshacer, y todo queda registrado con quién lo hizo. No hay bloqueo por tiempo.
- Solo el login de equipo puede sellar o canjear. Si un cliente escanea un QR, no puede sumar nada.
- Cuando el cliente completa la tarjeta, gana un premio y los sellos vuelven a cero para empezar otra vuelta. La confirmación de la caja lo avisa para que el barista se lo diga.
- Los premios se acumulan: el cliente puede juntar varios y canjearlos cuando quiera, y la tarjeta sigue sumando. La caja muestra cuántos premios tiene disponibles. Canjear no suma sello.
- **Volumen:** como mucho 50 ventas por hora en el pico, menos de una por minuto.

## Panel del gerente (solo lectura, pensado para el celular)

Se entra con el mismo login de equipo. No entra en la primera salida.

- Alertas de casos raros arriba de todo: muchos sellos en poco tiempo, muchos *deshacer*.
- Lista de clientes y sus sellos.
- Canjes realizados.
- Sellos por día de la semana y por hora.
- Clientes activos del mes y clientes nuevos.

## Reglas y alcance

- Los sellos los suma únicamente la caja, así que la tarjeta no se puede falsificar.
- **Las tarjetas son de cada cafetería** (`app/src/cafes/`): cuántas, sus nombres, sellos y premios. Todas siguen la misma forma: el premio se gana con el último sello y se usa en la compra siguiente, la que en papel es el último casillero. La cafetería de ejemplo tiene 4:

  | Tarjeta | Regla | Premio |
  |---|---|---|
  | Café take-away | Cada 7 cafés, el 8º es gratis | Un café take-away gratis |
  | Café en grano ¼ kg | Cada 4 compras, la 5ª tiene 30% OFF | 30% OFF en ¼ kg |
  | Café en grano ½ kg | Cada 4 compras, la 5ª tiene 30% OFF | 30% OFF en ½ kg |
  | Café en grano 1 kg | Cada 4 compras, la 5ª tiene 30% OFF | 30% OFF en 1 kg |

- Todas están disponibles desde que el cliente se anota (si se suma una tarjeta con clientes ya anotados, una migración se la crea a cada uno, como la 0012), siempre en ese orden y con un solo ícono en la pantalla de inicio. Cada una suma sellos y premios por separado: un premio de take-away no sirve para café en grano, y al revés.
- **La tarjeta dibuja sus casilleros como en papel** (18/10/2026): los sellos (7 en take-away, 4 en grano) y, al final, el del premio, que dice lo que da (*Gratis*, *30%*). El contador cuenta todos los casilleros (*5 de 8*, *3 de 5*).
- Con el 7º (o el 4º) sello el cliente gana el premio: la tarjeta queda en *7 de 8* (*4 de 5*) y el casillero del premio se ilumina, porque la próxima compra es la del premio. **Sellar ese casillero es canjear el premio:** esa compra va gratis o con 30% OFF, la tarjeta se completa y vuelve a *0*.
- **El premio se puede guardar:** si el cliente no lo quiere usar en esa compra, el barista toca *Sumar sello y guardarlo*. Suma un sello normal y arranca la vuelta siguiente; el premio queda guardado y se canjea en cualquier compra.
- Debajo de los casilleros, una franja dice la regla de la tarjeta, corta (19/10/2026): *El 8º café, gratis* / *En la 5ª compra, 30% OFF* Está apagada sin premios y se ilumina, con un aura, mientras hay uno para canjear (10/10/2026). Un premio guardado se ve en la etiqueta de la esquina de la tarjeta.
- Debajo del casillero del premio va lo que da (*Gratis*, *30%*), salvo que el dibujo del sello ya lo tenga adentro.
- **Los sellos y los premios no vencen.**
- La regla de una tarjeta ya creada solo cambia con una migración que recalcula todos los saldos desde los movimientos (así se pasó a 8 y 5 sellos el 09/10/2026, con la 0008, y se volvió a 7 y 4 el 10/10/2026, con la 0011). Si no, se crea una tarjeta nueva y la anterior se desactiva.
- Se piden los datos mínimos (documento y nombre), con consentimiento según la Ley 25.326.
- Los avisos puntuales ("Hoy 2x1") no se garantizan en la primera versión.
- Pago único de desarrollo. Por ahora el alojamiento lo pagan los desarrolladores, lo necesario y al menor costo posible, y el mantenimiento también queda a su cargo.
- **Fase 2:** sumar o restar sellos a mano desde el panel (por ejemplo, para pasar los de la tarjeta de papel); corregir un documento mal tipeado en el alta (lo hace el gerente; si el cliente ya se anotó de nuevo con el número correcto, se unen las dos cuentas); crear una tarjeta nueva y desactivar la anterior; y enviar avisos desde el panel.

## Costos de terceros (iguales en las dos)

| Ítem | Costo | Frecuencia |
|---|---|---|
| Dominio propio | Orden de USD 10–15 | Anual |
| Alojamiento (Cloudflare: Workers + D1) | Gratis por ahora; USD 5 si hace falta el plan pago | Mensual |
| Lector USB de QR | Opcional, solo si el flujo se hace lento en horas pico | Único |

La cuenta de Cloudflare ya está creada; el dominio todavía no ([dominio.md](implementacion/dominio.md)). Con el volumen del local alcanza con los planes más chicos.

## Riesgos de seguridad comunes a las dos propuestas

| Riesgo | Qué podría pasar | Qué hacemos |
|---|---|---|
| **Fraude interno** | El empleado le suma sellos a un conocido o a su propia tarjeta. Con un solo empleado en caja, nadie más mira | El panel del gerente marca casos raros (tarjetas con muchos sellos en poco tiempo, muchos "deshacer"). Deshacer no borra nada, queda anotado |
| **Adivinar códigos cortos** | Alguien prueba códigos hasta dar con la tarjeta de otro | Solo la caja autenticada puede buscar por código, y el código es lo bastante largo para no adivinarse. Conviene cortar los intentos fallidos seguidos (ver nota) |
| **Filtración de datos** | Se filtra la lista de clientes (nombres y DNI) | Guardar lo mínimo, el DNI cifrado, todo bajo conexión segura, copias de respaldo y acceso al panel con clave fuerte. Sirve además para cumplir la Ley 25.326 |
| **Formularios abusados** | Alguien crea miles de cuentas falsas usando la página de alta | Una verificación invisible contra robots (por ejemplo, Cloudflare Turnstile, gratis) y un tope de altas por conexión |
| **Dominio y continuidad** | Si el dominio se vence o si el desarrollador deja de estar disponible, la tarjeta deja de funcionar | Que el dominio quede a nombre de la cafetería, con renovación avisada, y que tengan una copia de los datos |
| **Datos personales** | La cafetería es la dueña de los datos y el desarrollador los procesa | Dejar por escrito en el contrato quién responde por qué. Por ahora no lo revisa un profesional: el texto del consentimiento lo escribe el equipo y queda como riesgo aceptado. Falta averiguar si hay que inscribir la base ante la AAIP |

**Nota sobre el tope de intentos fallidos:** no limita cuántos sellos se suman (el anti doble-escaneo se resuelve con confirmación y "deshacer", sin límite por tiempo). Solo corta cuando hay muchos códigos incorrectos seguidos. Es una decisión pendiente; la propuesta es no cortar y compensar con alertas en el panel.

---

# 2. Propuesta A: tarjeta con cuenta por DNI (elegida)

**Idea:** cada cliente tiene una sola cuenta, identificada por su DNI. No hay contraseña ni códigos por mail: se entra con el DNI y el celular queda conectado por mucho tiempo, como pasa con WhatsApp.

**Por qué así:** el público es mayormente gente mayor. Recibir y tipear un código por mail o recordar una contraseña es una barrera. El DNI se lo saben de memoria.

## Cómo lo vive el cliente

1. Escanea el QR del mostrador.
   - **Si no tiene sesión:** llega a la bienvenida, que pide el DNI. Si ya tiene cuenta, entra directamente. Si es nuevo, confirma el número (*¿Es correcto 30.123.456?*), pone su nombre y acepta el uso de sus datos. No se pide mail ni teléfono. Después ve una mini guía, que se puede saltear, para guardar la app en la pantalla de inicio (PWA), con dibujos para iPhone y Android.
   - **Si ya tiene sesión:** entra directo al panel con sus tarjetas.
2. En el panel ve sus 4 tarjetas con sus sellos y premios disponibles. Cada una tiene su QR fijo y su código corto. No hay códigos que esperar.
3. El celular queda conectado por mucho tiempo (por ejemplo, 12 meses), y el plazo se renueva cada vez que usa la app. En la práctica, no vuelve a ingresar.
4. Para sumar un sello o canjear un premio, abre la tarjeta de lo que compra y muestra su QR. El barista lo escanea con el celular del gerente. Mientras el código está abierto, la pantalla se actualiza sola: el cliente ve aparecer el sello o el canje sin tocar nada.

## Si cambia de celular o pierde el acceso

Vuelve a entrar con su DNI desde el celular nuevo y recupera todo. No se crea otra cuenta.

## Compartir la tarjeta

La tarjeta se puede usar desde más de un celular: cualquiera que entre con el DNI la usa. Es intencional. Por ejemplo, una madre que le compra un café a su hija puede sumar el sello o canjear el premio en la tarjeta de la hija.

## El DNI

- Garantiza una sola cuenta por persona.
- Se guarda **cifrado de una sola vía** (hash con clave secreta): el sistema puede comprobar si un DNI ya existe, dejar entrar al cliente y encontrarlo cuando el barista lo tipea, pero si se filtra la base de datos no se ven los números.
- Para quien no tenga DNI (turistas, extranjeros), se acepta otro documento.
- Si alguien se anota con el documento mal tipeado, el gerente lo corrige más adelante (fase 2).

## A favor

- No hay nada que recordar ni que esperar: ni contraseña, ni código, ni mail.
- No se generan tarjetas duplicadas.
- Cambiar de celular es tan simple como anotarse: se entra con el DNI.
- No hace falta un servicio de envío de mails.

## A tener en cuenta

- En iPhone, el ícono de la pantalla de inicio no comparte la sesión con Safari. Si el cliente se anota en Safari y después crea el ícono, al abrirlo le va a pedir el DNI una vez más.
- El DNI es un dato personal más delicado que un mail, aunque legalmente no es un dato sensible. Por eso se guarda cifrado y se explica para qué se pide.

## Seguridad propia de la Propuesta A

| Riesgo | Qué podría pasar | Qué hacemos |
|---|---|---|
| **Filtración del DNI** | Se roba la base de datos y se usan los DNI para estafas de identidad | El DNI se guarda cifrado de una sola vía, con la clave guardada aparte de la base de datos |
| **Probar DNIs en masa** | Un programa prueba miles de DNIs en el inicio de sesión para armar una lista de DNIs con nombres | Verificación invisible contra robots y tope de intentos de ingreso por conexión |
| **Sesión larga en un celular perdido** | Quien encuentre el celular ve la tarjeta | Primero tiene que pasar el bloqueo del celular, y solo ve sellos. Para canjear tendría que ir al local con ese celular |

**Lectura:** A prioriza la simplicidad para gente mayor. Entrar con el DNI de otra persona no se considera un riesgo sino un uso previsto (familiares que comparten la tarjeta). Lo que sí se cuida es el DNI guardado, que va cifrado.

**Opción descartada dentro de A:** se analizó el ingreso con un código enviado por mail (servicios como Brevo o Resend, gratis a este volumen). Se descartó por el público: esperar y tipear un código es una barrera para gente mayor, y los mails a veces tardan o caen en spam.

---

# 3. Propuesta B: tarjeta con dirección propia (sin login) — alternativa no elegida

**Idea:** cada cliente tiene su tarjeta en una dirección web personal y única. No hay cuenta ni ingreso: alcanza con abrir esa dirección. Al anotarse recibe un mail con el link.

## Cómo lo vive el cliente

1. Escanea el QR del mostrador y llega a la página de alta.
2. Se anota. El mail es opcional, pero se le sugiere con un argumento claro ("dejá tu mail y, si perdés tu celular, recuperás tu tarjeta").
3. Recibe su tarjeta en su dirección propia: sellos, QR personal y código corto.
4. **Si dejó su mail, le llega un correo con el link a su tarjeta.** Queda guardado en su casilla como respaldo.
5. Se le sugiere crear un ícono en la pantalla de inicio. No hay nada que ingresar ni que se venza.

## Si pierde el acceso

- Vuelve a escanear el QR del mostrador, toca "Recuperar mi tarjeta", pone su mail y le llega otra vez el correo con el link. O busca el mail original en su casilla.
- Si se anota dos veces con el mismo mail, el sistema lo detecta y le reenvía el link a su tarjeta existente en lugar de crear otra.
- Si no dejó ningún dato y pierde el ícono: la caja le arma una tarjeta nueva y le carga los sellos a mano, **con autorización del gerente** y con registro en la auditoría.

## A favor

- Es la más rápida para anotarse y no tiene nada que recordar.
- Pide menos datos, lo que favorece la privacidad.
- Es más simple de desarrollar y mantener.
- Con el mail de bienvenida, la recuperación queda casi tan cubierta como con cuenta.

## A tener en cuenta

- Quien tenga el link ve esa tarjeta. Solo ve sellos y no los puede cambiar, pero el link y el mail funcionan como una llave, y conviene avisarle al cliente que no los comparta.
- El respaldo depende de que el cliente deje el mail. Cuanto más se pida, más se parece a la propuesta A.
- El mail de bienvenida puede caer en spam. Con un dominio propio bien configurado, eso se reduce mucho.

## Seguridad propia de la Propuesta B

| Riesgo | Qué podría pasar | Qué hacemos |
|---|---|---|
| **El link es la llave** | Quien lo tenga entra a esa tarjeta. Se filtra si el cliente reenvía el mail, comparte una captura o usa una computadora compartida | Link largo e imposible de adivinar, que no aparezca en buscadores, y una opción "cambiar mi link" si sospecha que alguien lo tiene |
| **Mail sin verificar** | Alguien se anota con el mail de otro y "ocupa" su lugar; después la víctima recibe el link de una tarjeta que otro también tiene | El mail solo queda asociado a la tarjeta cuando el cliente toca el link del correo de bienvenida |
| **"Recuperar mi tarjeta"** | Un desconocido pide recuperar la tarjeta de un mail ajeno | El link siempre va solo a ese mail y la pantalla no confirma si existe. Recuperar **reenvía el mismo link**, sin invalidar el anterior: si no, cualquiera podría dejar sin acceso a otro cliente |
| **Mail en casillas compartidas** | Un mail familiar o de trabajo lo leen otros y ven la tarjeta | Riesgo bajo (solo se ven sellos). Se informa al cliente |

**Lectura:** B tiene menos cosas que atacar (no hay ingreso ni códigos), pero el link vale como contraseña, y el punto más delicado no es técnico: es la carga manual de sellos. Si la cafetería quiere una solución liviana, hay que decidir cuánto se controla.

---

# 4. Comparación

| | A. Cuenta por DNI (elegida) | B. Dirección propia + mail |
|---|---|---|
| Al anotarse | Nombre y DNI | Nombre y mail opcional |
| Mail | No se pide | Opcional pero sugerido |
| Ingreso | Con el DNI, y queda conectado por mucho tiempo | Ninguno |
| Si pierde el acceso | Vuelve a entrar con el DNI | Recupera el link por mail |
| Duplicados | Se evitan siempre (uno por DNI) | Se evitan si dejó mail |
| Depende de que lleguen mails | No | Sí, para recuperar |
| Desarrollo y mantenimiento | Similar | Similar |
| Superficie de ataque | Baja | Baja |
| Impacto si alguien entra a una tarjeta | Bajo | Bajo |
| Datos personales guardados | Nombre y DNI cifrado | Menos (mail opcional) |
| Punto más débil | El DNI guardado (se cifra) | El link como llave y la carga manual de sellos |
| Riesgo de fraude interno | Cubierto con registro | Algo mayor por la carga manual |

**Decisión:** A, con cuenta por DNI. Al principio se recomendaba B por simple, pero el público de la cafetería (gente mayor) cambió la evaluación: A por DNI no pide nada que recordar ni que esperar, evita duplicados siempre y para recuperar la tarjeta alcanza con volver a entrar con el DNI.

Ninguna de las dos tiene un riesgo que la descarte: ambas quedan seguras si se implementan los controles indicados.

---

# 5. Antecedentes en el mercado

- Los servicios comerciales de tarjetas de sellos (Loopy Loyalty, BonusQR, stmpr, Passtastic) usan Apple/Google Wallet. En lo que muestran, no piden cuenta: la tarjeta guardada en el Wallet hace de identidad.
- **StampClub**, el más parecido a una tarjeta web, usa cuentas de cliente (ingreso una vez, una cuenta para todas las tarjetas). Su razón es que junta tarjetas de muchos negocios, algo que no aplica a un solo local.
- **VeeCard** ata los sellos al mail del cliente (ingreso con Google o Apple) y no al celular.
- Un proyecto de código abierto (paquete Laravel) usa una página pública de la tarjeta con un token propio, es decir, el modelo B.
- No se encontró un servicio comercial que use el modelo B como único método.
- Notificaciones en iPhone: solo funcionan si el cliente guarda la página en la pantalla de inicio, y algunos desarrolladores reportan que a veces dejan de llegar. Por eso los avisos no se prometen en la primera versión.

*Fuente: páginas de cada producto y documentación pública. No se probó ninguno de los servicios.*

---

# 6. Pendientes de decisión

## Abiertos

- [x] **Cómo entra el equipo** → email + PIN de 6 números, con bloqueo de 15 minutos después de 5 intentos fallidos (06/10/2026; ver Flujo A de [flujos-equipo.md](flujos-equipo.md)).
- [ ] Decidir si se limitan los intentos fallidos consecutivos de código (propuesta: solo alertas en el panel).
- [ ] Averiguar si la base de clientes debe inscribirse ante la AAIP.
- [ ] Escribir el texto de *Más información* del consentimiento.
- [ ] Probar en un iPhone real cuánto dura la sesión con la tarjeta guardada en la pantalla de inicio y sin guardar, y si el código de un solo uso evita volver a pedir el documento.
- [ ] Comprar el dominio y decidir a nombre de quién. Recomendación: de la cafetería (ver *Dominio y continuidad*); un `.com.ar` pide la clave fiscal del titular.
- [ ] Definir qué pasa con los sellos y premios de una tarjeta desactivada: si se pueden seguir usando o si se pasan a la tarjeta nueva (fase 2).
- [ ] Precio del desarrollo.
- [ ] **Para la tienda online:** si una compra online de café en grano suma sello, y si el cliente del Club es el mismo de la tienda (la tienda va a necesitar mail o teléfono).

## Resueltos

- [x] Propuesta A o B → A, con cuenta por DNI.
- [x] Tema visual de la caja → el mismo tema claro que la billetera del cliente; cada tarjeta con su color (06/10/2026).
- [x] Dónde se aloja la app → Cloudflare: Workers + D1 con jurisdicción UE, plan gratis por ahora (05/10/2026; ver [cloudflare.md](implementacion/cloudflare.md)).
- [x] Cómo entra el equipo → con un login propio, en la misma app que los clientes.
- [x] Qué muestra la caja al escanear → nombre, sellos, *Sumar sello* y, si hay premios, *Canjear premio*.
- [x] Cuántas tarjetas → 4: Café take-away, Café en grano ¼ kg, Café en grano ½ kg y Café en grano 1 kg (la cuarta, el 14/10/2026).
- [x] Reglas y premios → como en papel: take-away, cada 7 cafés, el 8º gratis. Café en grano: cada 4 compras, la 5ª con 30% OFF (10/10/2026; del 09/10 al 10/10, 8 y 5).
- [x] Vencimiento → los sellos y los premios no vencen.
- [x] Mail o teléfono → no se piden; solo documento y nombre.
- [x] Varias personas en un mismo celular → no se contempla; hay un botón *Salir*.
- [x] Qué celular escanea → el del gerente.
- [x] QR fijo o que cambia → fijo.
- [x] Un QR por cliente o por tarjeta → uno por tarjeta; el cliente elige cuál mostrar.
- [x] Cuentas del equipo → una por persona, aunque compartan el celular del gerente.
- [x] Primera salida → la app del cliente con una caja mínima (entrar, escanear, tipear el código corto, sumar, canjear, deshacer). La búsqueda por DNI o nombre y el panel del gerente van después.
- [x] Por dónde entra el equipo → una dirección aparte dentro del mismo sitio (por ejemplo `/caja`), sin enlace desde la app del cliente.
- [x] Quién crea las cuentas del equipo → los desarrolladores para la primera salida; desde el panel, en la fase 2.
- [x] DNI mal tipeado en el alta → lo corrige el gerente (fase 2).
- [x] Revisión legal por un profesional → por ahora no.
- [x] Quién paga el alojamiento y mantiene la app → los desarrolladores, por ahora.
- [x] Volumen → como mucho 50 ventas por hora en el pico.
- [x] Fecha de lanzamiento → no hay.
