# Qué se le entrega a la cafetería

> Documento de trabajo. Fecha: 05/10/2026. **Decidido: modelo A, servicio** (05/10/2026). Define qué queda en manos de la cafetería y qué en manos de los desarrolladores, hoy y si algún día la relación termina. Es la base del acuerdo con la cafetería (pendiente del spec).

## Lo que ya está decidido

Del [spec](../propuestas-tarjeta-fidelizacion.md) y de [Equipo y cuentas](README.md#equipo-y-cuentas):

- **Pago único** por el desarrollo.
- **El alojamiento lo pagan los desarrolladores**, y el mantenimiento queda a su cargo.
- **El dominio va a nombre de la cafetería.**
- **Los datos de los clientes son de la cafetería** (responsable); los desarrolladores los procesan (encargados). Ver [datos-personales.md](datos-personales.md).
- Las cuentas (GitHub, Cloudflare) son **personales de los desarrolladores**, porque las quieren reutilizar en otros proyectos.

## Por qué A

| Modelo | Idea | Por qué no |
|---|---|---|
| **A. Servicio** (elegido) | Los desarrolladores operan todo; la cafetería usa el Club | — |
| B. Llave en mano | Se entrega todo a la cafetería, que queda a cargo | Contradice lo decidido: el alojamiento lo pagaría la cafetería y las cuentas serían suyas. Complica reutilizar el código |
| C. Mixto | Como A, pero si se separan la cafetería recibe una licencia del código | Se puede negociar más adelante si la cafetería lo pide |

## Decisión: modelo A (servicio)

Los desarrolladores operan todo con sus cuentas: el Club es un servicio que la cafetería usa. **El dominio y los datos son de la cafetería; el código y las cuentas, de los desarrolladores.** Pueden reutilizar el sistema para otras cafeterías.

**El punto débil que hay que cubrir en el acuerdo:** si la relación termina, la cafetería se queda sin la app. Para que eso no deje a los clientes de un día para el otro sin sus tarjetas:

- **Aviso anticipado** (por ejemplo, 60 días) antes de dar de baja el servicio, de cualquiera de las dos partes.
- **Período de transición** en el que el Club sigue funcionando.
- **Entrega de la salida** descripta abajo (datos, clave del DNI, dominio).
- Si en el futuro la cafetería lo pide, se puede negociar aparte una licencia del código (lo que sería pasar al modelo C).

## Qué incluiría la salida

Si la relación termina, en un plazo a acordar (por ejemplo, 30 días):

1. **Exportación completa de la base** (clientes, tarjetas, sellos, historial) en un formato estándar.
2. **La clave del hash del DNI**, sin la cual no se puede reconocer a los clientes (por un canal seguro).
3. **Transferencia del dominio** a una cuenta de la cafetería, si estuviera en la cuenta de los desarrolladores.
4. Un período de transición en que el Club sigue funcionando mientras se muda.

## Para el acuerdo con la cafetería

Lo que el contrato tiene que dejar por escrito:

- Quién es dueño de qué (datos, dominio, código, cuentas).
- Quién paga los costos mensuales y hasta cuándo.
- Qué incluye el mantenimiento y qué se cobra aparte.
- Responsable y encargado de los datos personales (Ley 25.326), confidencialidad y aviso de incidentes.
- Qué pasa si la relación termina (la salida de arriba).
- Si los desarrolladores pueden ofrecer el mismo sistema a otras cafeterías.

## Abiertos

- [ ] Definir si los costos mensuales los absorben los desarrolladores o hay un abono.
- [x] Reutilizar el sistema para otras cafeterías → sí, el código es de los desarrolladores (modelo A).
- [ ] Definir el aviso anticipado y el período de transición si la relación termina.
- [ ] Escribir el acuerdo con la cafetería con estos puntos.
