# Stack

> Decidido el 05/10/2026. Qué usamos, por qué y qué se descartó. Cómo se organiza el código: [arquitectura.md](arquitectura.md). Cómo funciona Cloudflare y sus planes: [cloudflare.md](cloudflare.md).

## Qué usamos

| Pieza | Elección | Por qué |
|---|---|---|
| Alojamiento | **Cloudflare Workers** + archivos estáticos | Gratis o USD 5 por mes, casi sin mantenimiento, con un centro de datos en Buenos Aires |
| Base de datos | **D1** (SQLite) con **jurisdicción UE** | La UE es un destino adecuado para la Ley 25.326 ([datos-personales.md](datos-personales.md)). La jurisdicción no se puede cambiar después |
| Contra robots | **Turnstile**, validado en el servidor | Gratis e invisible para la persona |
| Framework | **React Router 7** (*framework mode*), full-stack con React 19 | Formularios que funcionan aunque el JavaScript no haya cargado (celulares viejos, mala señal), corre en Cloudflare y en Node, la comunidad más grande y la mejor ayuda de los asistentes de IA |
| Lenguaje | **TypeScript**, en el cliente y el servidor | Menos errores y un solo lenguaje |
| Acceso a la base | **Drizzle** | Tipos en las consultas, migraciones en SQL y paso posible a Postgres |
| Validar lo que entra | **Valibot** | En cada `loader` y `action` |
| Sesiones | **Propias**, en una cookie firmada (`HttpOnly`, `Secure`), sin tabla, renovadas al usarse | 12 meses el cliente, 15 días a 1 mes el equipo. Sin dependencias externas |
| DNI y PIN | **HMAC-SHA256** con Web Crypto y claves secretas de Cloudflare | Requisito del spec. Detalle en [arquitectura.md](arquitectura.md) |
| Estilos | **CSS propio con variables** generadas desde `tokens.json` | Cambiar de cafetería es cambiar las variables |
| PWA | **Service worker propio** (`src/web/sw/`), compilado con esbuild (09/10/2026) | Guarda la app y el código de cada tarjeta para mostrarlos sin conexión. Se descartó `vite-plugin-pwa`: lo que se guarda son páginas del servidor, propias de cada cliente, y no la página única de una SPA, que es lo que resuelve Workbox. Ver [arquitectura.md](arquitectura.md#la-app-sin-conexión) |
| Calidad | **Biome** · **Vitest** · **Playwright** | Ver la skill `pruebas` y [ci-cd.md](ci-cd.md) |
| Publicar | `wrangler` desde **GitHub Actions** | Ver [ci-cd.md](ci-cd.md) |

Hoy están instalados React Router, Vite, Wrangler, Biome y Vitest. El resto se suma con el primer cambio que lo usa.

## Sello en vivo

Decidido el 07/10/2026: **en tiempo real, con Durable Objects.** Mientras el código de la tarjeta está abierto, la pantalla tiene un WebSocket abierto con el objeto de su tarjeta; cuando la caja suma, canjea o deshace, le avisa y el sello aparece al instante. Los Durable Objects con SQLite entran en el plan gratis (100.000 pedidos por día) y, con la *WebSocket Hibernation API*, una conexión quieta no cuesta nada. Antes se había pensado preguntar cada 2–3 segundos. Detalle en [arquitectura.md](arquitectura.md#el-sello-en-vivo).

## Qué se descartó

| Opción | Por qué no |
|---|---|
| Servidor propio en Buenos Aires | 2 a 4 horas de mantenimiento por mes, y los respaldos y las caídas quedan a nuestro cargo |
| Render o Supabase en la UE | USD 15 a 30 por mes, contra USD 0 a 5 en Cloudflare |
| AWS, Azure o Google Cloud | Más caros y complejos para este tamaño |
| Vercel | Su plan gratis no permite uso comercial |
| SvelteKit | Más liviano y fácil de aprender, pero con menos comunidad y ayuda de IA que React |
| React + Hono por separado | Más código y formularios que dependen de JavaScript. La API se puede sumar después si hace falta |
| Next.js | El más pesado y complejo, y su camino en Cloudflare está cambiando |
| Astro | Pensado para contenido; la caja tiene mucho estado. Puede servir para el catálogo de la tienda |

## Para tener en cuenta

- **React Router 8** ya salió, pero la plantilla de Cloudflare sigue en la 7. Las opciones `future.v8_*` ya están activadas en [`react-router.config.ts`](../../app/react-router.config.ts) para que el cambio sea fácil.
- **Para no quedar atados a Cloudflare:** React Router corre en Node, Drizzle habla Postgres, y la base se exporta todos los meses con `wrangler d1 export` ([cloudflare.md](cloudflare.md), *Si un día queremos irnos*).
