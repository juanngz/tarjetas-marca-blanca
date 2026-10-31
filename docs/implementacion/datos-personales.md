# Datos personales: qué dice la ley y qué nos toca

> Documento de trabajo. Fecha: 05/10/2026. Resumen hecho a partir de la normativa y de publicaciones de estudios jurídicos. **No es asesoramiento legal**: el spec deja la revisión profesional como riesgo aceptado, y este documento sirve para saber qué preguntar si se hace.

## El marco vigente

| Norma | Qué regula |
|---|---|
| **Ley 25.326** (2000) | La ley de protección de datos personales. Sigue vigente |
| **Decreto 1558/2001** | Su reglamentación. El artículo 12 detalla las transferencias internacionales |
| **Disposición 60-E/2016** y **Resolución AAIP 34/2019** | La lista de países con protección "adecuada" y las primeras cláusulas modelo |
| **Resolución AAIP 198/2023** | Acepta las cláusulas modelo de la Red Iberoamericana para transferir a países no adecuados |
| **Resolución AAIP 47/2018** | Medidas de seguridad recomendadas (no obligatorias: se eligen según el riesgo) |
| **Resolución AAIP 126/2024** | Clasificación de infracciones y graduación de sanciones |
| **Ley 27.699** (2022) | Aprueba el Convenio 108+ del Consejo de Europa: suma, entre otras cosas, el deber de avisar a la autoridad si hay un incidente de seguridad |

**¿Hay ley nueva?** No. Hay proyectos para reemplazar la 25.326 (por ejemplo, 1751-D-2026 y 3397-D-2026), pero al 26/09/2026 no tenían dictamen. Si se aprueba una ley nueva, vendría en la línea del reglamento europeo, con privacidad desde el diseño y portabilidad. Lo que hagamos bien hoy nos deja preparados.

## Qué datos guardamos

| Dato | ¿Es dato personal? | ¿Es sensible? |
|---|---|---|
| Nombre | Sí | No |
| DNI guardado con hash y clave secreta | **Sí.** Seudonimizado no es lo mismo que anónimo: con la clave se puede volver a relacionar con la persona | No |
| Sellos, canjes y fechas de cada cliente | Sí, porque están asociados a una persona | No |
| Usuarios del equipo y registro de quién hizo cada acción | Sí (datos de los empleados) | No |

No guardamos datos sensibles (salud, origen, religión, biometría). Eso baja el nivel de exigencia, pero la ley se aplica igual.

## Dónde se pueden guardar

**La regla (artículo 12 de la ley):** está prohibido transferir datos personales a países que no tengan un nivel de protección adecuado. Guardarlos en un servidor de otro país cuenta como transferencia.

### Países adecuados: se puede, sin trámites extra

Según la lista de la AAIP:
- La **Unión Europea** y el Espacio Económico Europeo (por ejemplo, Alemania, Irlanda, Finlandia, Francia o Países Bajos).
- **Reino Unido**, **Suiza**, **Uruguay**, **Canadá** (solo el sector privado), **Nueva Zelanda** e **Israel**.
- Andorra, Guernsey, Jersey, Isla de Man e Islas Feroe.

Y, por supuesto, **Argentina**: si los datos no salen del país, no hay transferencia.

### Países no adecuados: solo con un mecanismo

**Estados Unidos, Brasil, Chile, México, Colombia, Japón y Corea, entre otros, no están en la lista.** Ahí están las regiones más baratas o más cercanas de muchos proveedores (São Paulo, Santiago, costa este de EE. UU.). Para usarlas hace falta uno de estos mecanismos:

| Mecanismo | Qué es | Cómo nos queda |
|---|---|---|
| **Consentimiento expreso** del cliente (Decreto 1558/2001, artículo 12) | Que el cliente acepte, de forma expresa e informada, que sus datos se guarden en otro país | Posible: se suma al texto del alta. La AAIP recomienda además usar cláusulas modelo |
| **Cláusulas contractuales modelo** (Disposición 60-E/2016 o Resolución 198/2023, modelo "responsable → encargado") | Un contrato con el proveedor con cláusulas aprobadas | Difícil: los proveedores grandes (Cloudflare, AWS, Google) ofrecen sus propios contratos, basados en las cláusulas europeas, no en las argentinas ni en las iberoamericanas |
| Normas corporativas vinculantes | Para grupos de empresas | No aplica |

### Cómo queda el Club

**Cloudflare con D1 en jurisdicción UE: cumple sin trámites extra.** La base queda en la UE, pero el código corre en toda la red de Cloudflare (incluido Buenos Aires) y algunos registros técnicos pueden quedar fuera de la UE: por eso nunca se registran el DNI ni el nombre. Si algún día se usara un servicio en EE. UU., São Paulo o Santiago, haría falta sumar el consentimiento expreso al alta.

**Un matiz más:** la mayoría de los proveedores son empresas de EE. UU., aunque los datos estén en Europa. La ley argentina mira el país donde se guardan los datos, no la nacionalidad de la empresa. Pero eso no evita que un proveedor estadounidense pueda recibir pedidos de autoridades de su país. Para nuestro caso (nombre y DNI con hash, sin datos sensibles) es un riesgo bajo.

## Obligaciones que nos tocan, estén donde estén los datos

| Obligación | Qué hay que hacer | Estado |
|---|---|---|
| **Consentimiento informado** (artículos 5 y 6) | Antes de guardar los datos, informar para qué se usan, quién es el responsable y su domicilio, que darlos es necesario para usar el Club, y cómo ejercer los derechos. El consentimiento tiene que ser expreso y destacado | Ya está en el flujo (casilla en *Tu nombre y consentimiento*). Falta el texto de *Más información* |
| **Dónde se guardan los datos** | Mencionarlo en *Más información*, aunque sea un país adecuado | Se sacó del texto provisorio (06/10/2026). Revisarlo antes de pasar a prod |
| **Inscribir la base en el Registro Nacional de Bases de Datos** (AAIP) | Las bases privadas de clientes se inscriben. Es un trámite en línea; según publicaciones, gratuito para bases chicas | **Responde un pendiente del spec: sí, hay que inscribirla.** El titular es la cafetería |
| **Derecho de acceso** (artículo 14) | Si un cliente pide qué datos tenemos, responder en **10 días corridos**. Gratis, cada 6 meses | Definir el canal (por ejemplo, en el local o por mail) |
| **Rectificación y supresión** (artículo 16) | Corregir o borrar los datos de un cliente que lo pida en **5 días hábiles** | En los flujos: Flujo G de [flujos-equipo.md](../flujos-equipo.md). A mano en la primera salida; *Borrar cliente* desde el panel después |
| **Seguridad** (artículo 9 y Resolución 47/2018) | Medidas acordes al riesgo: HTTPS, DNI con hash, acceso del equipo con clave, registro de acciones, respaldos | En gran parte ya está en el spec |
| **Confidencialidad** (artículo 10) | Quien accede a los datos guarda secreto | Sumarlo al acuerdo con la cafetería y entre los desarrolladores |
| **Avisar incidentes** (Convenio 108+) | Si hay una filtración, avisar a la AAIP | Definir quién avisa y cómo |
| **Contrato responsable-encargado** | La cafetería es la responsable de los datos; los desarrolladores y el proveedor de alojamiento son encargados | Ya está como pendiente en el spec (*Datos personales*) |

**Sanciones:** la AAIP puede aplicar apercibimientos, multas, suspensión y, en casos graves, la clausura de la base. La Resolución 126/2024 actualizó cómo se gradúan. Para un negocio chico que cumple lo básico, el riesgo real es bajo; lo importante es poder mostrar que se hizo lo razonable.

## Propuesta

1. **Datos en un país adecuado:** hecho, D1 con jurisdicción UE. Así no dependemos del consentimiento para la transferencia.
2. **En el texto de *Más información*:** finalidad, responsable (la cafetería, con su domicilio), dónde se guardan los datos, cómo pedir acceso, corrección o borrado, y que se puede dejar el Club en cualquier momento.
3. **Inscribir la base** en el Registro Nacional de Bases de Datos, a nombre de la cafetería, antes del lanzamiento.
4. **Borrar a un cliente a pedido:** hecho, Flujo G de [flujos-equipo.md](../flujos-equipo.md) (a mano en la primera salida; desde el panel después).
5. **No guardar el DNI ni el nombre en los registros técnicos** (logs) de ningún proveedor.
6. Si algún día se quiere revisión legal, este documento es la base de la consulta.

## Abiertos

- [x] Elegir el alojamiento con los datos en un país adecuado → Cloudflare con D1 en jurisdicción UE (05/10/2026).
- [ ] Escribir el texto de *Más información* con los puntos de la propuesta.
- [ ] Inscribir la base en el Registro Nacional de Bases de Datos (titular: la cafetería).
- [ ] Definir el canal para pedidos de acceso, corrección y borrado, y quién responde.
- [x] Sumar el borrado de un cliente a los flujos del equipo → Flujo G (05/10/2026).
- [ ] Definir quién avisa a la AAIP si hay un incidente.
- [ ] Confirmar en la AAIP los requisitos y el costo actuales de la inscripción.

## Fuentes

- **Normativa:** [Decreto 1558/2001, texto actualizado](https://www.argentina.gob.ar/normativa/nacional/decreto-1558-2001-70368/actualizacion) · [AAIP: transferencias internacionales](https://www.argentina.gob.ar/transferencias-internacionales) · [Resolución AAIP 198/2023 (Boletín Oficial)](https://www.boletinoficial.gob.ar/detalleAviso/primera/296189/20231018) · [Ley 25.326 (OEA)](https://www.oas.org/juridico/pdfs/arg_ley25326.pdf)
- **Países adecuados:** [Reino Unido en la lista argentina (IAPP)](https://iapp.org/news/a/el-reino-unido-se-incorpora-a-la-lista-argentina-de-paises-adecuados-para-la-transferencia-internacional-de-datos-personales) · [Transferencia internacional (Marval)](https://www.marval.com/Publicacion/transferencia-internacional-de-datos-personales-13335) · [Transferencia desde Argentina (Estudio Lexar)](https://estudiolexar.com/transferencia-internacional-de-datos-personales-desde-argentina/)
- **Cláusulas modelo:** [La AAIP aprobó cláusulas modelo (abogados.com.ar)](https://abogados.com.ar/la-aaip-aprobo-clausulas-contractuales-modelo-para-transferencia-internacional-de-datos-personales/33646) · [Cláusulas de la Red Iberoamericana (Baker McKenzie)](https://insightplus.bakermckenzie.com/bm/investigations-compliance-ethics/argentina-aaip-approves-use-of-iadpn-model-contractual-clauses-for-international-transfers-of-personal-data) · [Nuevas cláusulas modelo (Marval)](https://www.marval.com/Publicacion/transferencia-internacional-de-datos-nuevas-clausulas-modelo-15673)
- **Proyectos de ley:** [Proyectos para reemplazar la 25.326 (LexLatin)](https://lexlatin.com/noticias/ley-25326-argentina-reemplazar-proteccion-datos-personales) · [Reforma en el Congreso (Posturas)](https://posturas.com.ar/reforma-ley-datos-personales-argentina-congreso/)
- **Seguridad y Convenio 108+:** [Resolución 47/2018 (Marval)](https://www.marval.com/Publicacion/nueva-resolucion-sobre-medidas-de-seguridad-y-datos-personales-13216?lang=en) · [Convenio 108+ aprobado (O'Farrell)](https://www.estudio-ofarrell.com/el-congreso-de-la-nacion-aprobo-el-convenio-108-sobre-proteccion-de-las-personas-con-respecto-al-tratamiento-automatizado-de-datos-personales)
- **Sanciones:** [Resolución 126/2024 (abogados.com.ar)](https://abogados.com.ar/resolucion-1262024-aaip-cambios-en-la-clasificacion-de-infracciones-a-las-leyes-nro-25326-y-26951-y-en-el-regimen-de-graduacion-de-sanciones/34897) · [Clasificación de infracciones (IAPP)](https://iapp.org/news/a/se-modifico-la-clasificacion-y-graduacion-por-infracciones-a-la-ley-de-proteccion-de-datos-personales-en-argentina)
- **Inscripción de bases:** [Registro de bases de datos (Diario Judicial)](https://www.diariojudicial.com/news-52931-registro-de-bases-de-datos-esperan-60-mil-inscriptos-a-fin-de-ano) · [Obligación de inscribirse (Diario Judicial)](https://www.diariojudicial.com/news-52486-todos-deben-inscribirse-en-el-registro)
- **Seudonimización con hash:** [AEPD: hash como técnica de seudonimización](https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/la-aepd-publica-recomendaciones-para-aquellos-que-utilicen)
