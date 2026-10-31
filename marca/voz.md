# Voz y tono

La voz es cómo habla la app siempre. El tono es cuánto cambia según el momento: no es lo mismo darle la bienvenida a alguien que avisarle que su DNI no está bien escrito.

Esta es la voz base de la marca blanca: la que ya tienen todos los textos de la app. Cada cafetería puede sumarle lo suyo (su nombre, su bienvenida, sus premios) en su configuración (`app/src/cafes/`), sin cambiar las palabras del Club ni el formato.

## Cómo suena

Como el barista que te atiende hace años: te trata de vos, te llama por tu nombre y no te apura.

| Rasgo | Somos | No somos | Así sí | Así no |
|---|---|---|---|---|
| **Cálida** | Cercana, de vos, con el nombre de la persona | Empalagosa, de signos de exclamación en cada línea | Buen día, Marta. | ¡¡Hola Marta!! ¡Qué alegría verte! |
| **Clara** | Una idea por frase, palabras de todos los días | Técnica, de sistema | Poné tu número de documento. | Ingresá tu DNI para autenticarte. |
| **Pausada** | Sin apuro, un paso a la vez, sin presión | Lenta, condescendiente, infantil | Listo. Ya podés usar tu tarjeta. | ¡Muy bien! ¡Lo hiciste perfecto! |

## Dónde se ubica

```
Formal    ──────────●──── Coloquial       de vos, sin lunfardo
Simple    ──●──────────── Complejo        palabras de mostrador, no de app
Serio     ───────●─────── Juguetón        cálido, con un guiño ocasional
Contenido ─────●───────── Expresivo       emoción solo en el premio
```

## El saludo

La app saluda con el nombre de la persona, sin el apellido, según la hora del local:

| Hora | Saludo |
|---|---|
| Hasta las 12:59 | Buenos días, Marta. |
| 13:00 a 19:59 | Buenas tardes, Marta. |
| Desde las 20:00 | Buenas noches, Marta. |

El nombre de la cafetería se presenta una vez, en la bienvenida (`welcome` en su configuración).

## El tono, según el momento

| Momento | Tono | Ejemplo |
|---|---|---|
| Cartel del mostrador | Invitación directa | **Tu tarjeta del Club, ahora en el celular.** Escaneá y poné tu DNI. |
| Bienvenida | Cálido, presenta sin vender | Cada visita suma un sello. Juntá los sellos y ganá tu premio. |
| Pedir el DNI | Claro, explica para qué | Poné tu número de documento. Lo usamos para que tu tarjeta sea solo tuya. |
| Alta nueva | Breve, sin formulario de más | ¿Cómo te llamás? Así te saludamos cuando venís. |
| Consentimiento | Transparente, sin letra chica escondida | Guardamos tu nombre y tu documento solo para el Club. No los compartimos con nadie. |
| Panel de tarjetas | Informativo, sereno | Café take-away · 5 de 8 |
| Sello sumado (cliente) | Contento, contenido | Sumaste un sello · 6 de 8 |
| Tarjeta completa | El único momento con exclamación: al sellar el casillero del premio | ¡Completaste la tarjeta! |
| Premio disponible | El casillero del premio se enciende y la franja dice la regla. Lo ofrece la caja | En la 5ª compra, 30% OFF |
| Premio canjeado | Cálido | **Premio canjeado.** Este café va por cuenta de la casa. Que lo disfrutes, Marta. |
| Error del cliente | Calmo, dice qué hacer, sin culpa | Ese número tiene pocos dígitos. Revisalo y probá de nuevo. |
| Sin conexión | Tranquilizador | Sin conexión. Tus sellos se actualizan cuando vuelva. (El código se sigue mostrando.) |
| Caja (barista) | Imperativo, corto, con el dato | Sumar sello a Marta García · Café take-away 5 de 8 |
| Confirmación en caja | Hecho + salida | Sello sumado · 6 de 8. **Deshacer** |
| Panel del gerente | Neutro, de dato | 42 sellos esta semana · 8 más que la anterior |

## Palabras

| Decimos | No decimos | Por qué |
|---|---|---|
| tarjeta | pase, wallet, cuenta, perfil | Es lo que la gente ya tenía en papel |
| sello | punto, check, estrella | Así se llama en la tarjeta de papel |
| premio | recompensa, beneficio, reward | Es la palabra de mostrador |
| canjear el premio | usar, redimir, cobrar | "Usado" suena a descarte; canjear es la palabra del mostrador |
| entrar | iniciar sesión, loguearse, login | Nadie dice "me logueo a la cafetería" |
| tu número de documento (DNI) | credencial, usuario, ID | Nombra el papel que la persona tiene en la mano |
| el código de tu tarjeta | QR, token, hash | "QR" solo si hace falta aclarar el dibujo |
| guardar en la pantalla de inicio | instalar la PWA, agregar acceso directo | Describe lo que la persona ve |
| el barista | el administrador, el operador | Del lado del cliente siempre es una persona |
| el nombre del Club | programa de fidelización | El nombre propio, siempre completo la primera vez |

Del lado de la caja y del panel se dice además *deshacer* y *administrador*: es lenguaje de trabajo.

## Formato

- **Tuteo rioplatense:** podés, tenés, mostrale, escaneá. Nunca "usted", nunca "tú".
- **Números:** cifras, no palabras: *5 de 8*, *te faltan 2*. Precios sin signo $, con punto de miles: *4.500*.
- **Documento:** se muestra con puntos de miles, *30.123.456*. Se tipea sin puntos.
- **Fechas:** *1 de octubre*, sin el año salvo que cambie. Días de la semana con minúscula.
- **Horas:** *9:30*, formato de 24 horas.
- **Mayúsculas:** oración normal en la app. Las mayúsculas sostenidas quedan para el nombre del Club en la bienvenida y etiquetas cortas (`app-etiqueta`).
- **Signos:** sin emojis. Un solo signo de exclamación por pantalla como máximo, y solo para festejar.
- **Botones:** verbo + cosa: *Seguir*, *Ver mi código*, *Sumar sello*, *Canjear premio*. Nunca *OK*, *Aceptar* o *Enviar* solos.
- **Largo:** un título, una línea de explicación y un botón por pantalla. Si hace falta más, es otra pantalla.

## Reescrituras

| Antes | Después |
|---|---|
| Error 429: demasiadas solicitudes. | Probá de nuevo en unos minutos. |
| ¡Felicitaciones! Has acumulado 7 puntos y obtuviste una recompensa. | ¡Completaste la tarjeta! Tu próximo café va por cuenta de la casa. |
| Para continuar, acepte los términos y condiciones. | Guardamos tu nombre y tu documento solo para el Club. ¿Estás de acuerdo? |
| Instale nuestra PWA para una mejor experiencia. | Guardá la tarjeta en tu pantalla de inicio y la abrís como cualquier app. |
| Operación exitosa. | Sello sumado · 6 de 8. |

## Prueba rápida

Antes de dar un texto por bueno:

1. ¿Lo diría el barista en voz alta, en el mostrador?
2. ¿Lo entiende alguien de 75 años sin anteojos de cerca? (corto, sin siglas)
3. ¿Dice qué tiene que hacer la persona después?
4. ¿Usa las palabras del Club (*tarjeta, sello, premio, canjear, entrar*)?
