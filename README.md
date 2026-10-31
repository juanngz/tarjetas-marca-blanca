# Club de fidelización · marca blanca

Tarjeta de fidelización digital para cafeterías. Reemplaza las tarjetas de sellos de papel por una app que el cliente guarda en el celular y abre con su DNI, y una caja donde el equipo suma sellos y canjea premios.

Viene **sin marca**: grises, la letra del celular y logos de relleno. Para cada cafetería se cambian su configuración, su tema, sus logos y sus sellos, y se corre un comando: ver la [puesta en marcha](marca/README.md).

Stack: React Router 7 en Cloudflare (Workers + D1), con CI/CD en GitHub Actions.

## Levantar el proyecto

Cualquiera con el repo lo levanta en minutos, **sin cuentas de Cloudflare ni claves**.

Hace falta **Node 24** (la versión del archivo [`.nvmrc`](.nvmrc)) y Git.

```sh
git clone <repo de la cafetería>
cd <repo>/app
nvm use          # o instalar Node 24 a mano
npm run setup    # instala, copia las claves de prueba y crea la base local con datos inventados
npm run dev      # abre la app en http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run setup` | Una vez, o cuando algo se desarma: instala dependencias, copia `.dev.vars.example` a `.dev.vars` si no existe, aplica las migraciones a la base local y genera los tipos |
| `npm run dev` | La app en la compu, con una copia local de Cloudflare y de la base |
| `npm test` | Las pruebas de las reglas del negocio, los casos de uso y el servidor con la base (capas 1 y 2) |
| `npm run test:e2e` | Los recorridos y la accesibilidad en un navegador de celular (capas 3 y 4). Levanta la app con una base propia, sin tocar la tuya. La primera vez: `npx playwright install chromium` |
| `npm run lint` | Formato y lint |
| `npm run typecheck` | Errores de tipos |
| `npm run db:generate -- --name=what-changes` | Después de cambiar el esquema (`src/platform/db/schema.ts`): escribe la migración en `migrations/`. Va en el mismo pull request |
| `npm run db:migrate:local` | Aplica a la base local las migraciones nuevas de tu rama |
| `npm run staff:create` | Crea una persona del equipo de la caja. En local, en tu base; en dev o prod, te da el comando ([entorno.md](docs/implementacion/entorno.md)) |
| `npm run staff:change-pin` | Le pone un PIN nuevo a alguien del equipo (buscada por email) y la destraba |
| `npm run brand` | Después de cambiar la marca de la cafetería: corre `tokens` y `icons` ([puesta en marcha](marca/README.md)) |
| `npm run tokens` | Después de cambiar el tema (`marca/tokens.json`) o el nombre de la cafetería: vuelve a escribir `src/styles/tokens.css`, `src/styles/theme.ts` y `public/manifest.webmanifest` |
| `npm run icons` | Después de cambiar `public/brand/symbol-light.svg` o el color `tarjeta-1`: vuelve a dibujar el ícono de la app (`public/icons/`) |
| `npm run db:seed` | Carga los datos inventados en tu base local: la clienta *Marta García* (DNI 30.123.456) *Ana · barista* para la caja (`/register`, `ana@example.com`, PIN `428613`) y *Bruno · gerente* para *Equipo* (`bruno@example.com`, PIN `517284`). Se puede repetir |
| `npm run db:reset` | Borra la base local y la vuelve a crear con las migraciones y los datos inventados. Para cuando se rompió o al cambiar de rama. Cortar `npm run dev` antes |

**La base local** vive solo en tu compu (`app/.wrangler/state/`), es una sola para todas las ramas y nunca se conecta a dev ni a prod. Los datos de prod nunca bajan a una compu.

**Qué no hace falta para desarrollar:**
- **Cuenta de Cloudflare:** la app corre en la compu con una copia local.
- **Claves:** se usan las de prueba de [`app/.dev.vars.example`](app/.dev.vars.example). Turnstile tiene claves de prueba que siempre dejan pasar.
- **Publicar:** lo hace GitHub Actions. Al fusionar en la rama `dev` se publica en **dev**; al fusionar `dev` en `main`, en **prod** ([CI/CD](docs/implementacion/ci-cd.md)).

**Con Claude Code en la nube:** el proyecto se prepara solo al iniciar la sesión ([`.claude/hooks/session-start.sh`](.claude/hooks/session-start.sh)).

Las cuentas, los accesos y los secretos de producción son solo para quien administra: [`docs/implementacion/entorno.md`](docs/implementacion/entorno.md).

## Por dónde empezar a leer

| Qué | Dónde |
|---|---|
| Cómo se viste para una cafetería | [Puesta en marcha](marca/README.md) |
| Qué se construye y por qué | [Spec de la tarjeta](docs/propuestas-tarjeta-fidelizacion.md) |
| Pantallas y flujos | [Cliente](docs/flujos-cliente.md) · [Caja y panel](docs/flujos-equipo.md) |
| Decisiones técnicas, CI/CD, dominio | [`docs/implementacion/`](docs/implementacion/) |
| Cuentas, accesos y configuración | [`docs/implementacion/entorno.md`](docs/implementacion/entorno.md) |
| Reglas de interfaz, movimiento y voz | [`marca/interfaz.md`](marca/interfaz.md) · [`marca/movimiento.md`](marca/movimiento.md) · [`marca/voz.md`](marca/voz.md) |
| Cómo trabajamos: ramas, commits, pull requests | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Contexto para trabajar con Claude | [`CLAUDE.md`](CLAUDE.md) |
