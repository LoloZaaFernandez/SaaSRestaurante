# SaasRestaurante

SaaS de gestión para restaurantes: panel administrativo, gestión de menú, plano de mesas, toma de pedido y caja. Monorepo basado en pnpm + Turborepo, con frontend Next.js, API Fastify y PostgreSQL multitenant con Row Level Security.

## Arquitectura

El sistema se divide en tres capas bien delimitadas, donde los datos fluyen desde la UI hasta la base de datos de forma unidireccional:

```
┌──────────────────────────────────────────────────────────────┐
│  apps/web — UI (Next.js 15, App Router)                  :3000│
│  Dashboard · Menú · Mesas · Pedidos · Caja · Ajustes          │
└────────────────────────────┬─────────────────────────────────┘
                             │  HTTP/JSON — validación con schemas zod
                             │  de packages/contracts
┌────────────────────────────▼─────────────────────────────────┐
│  apps/api — Fastify 5                                    :3001│
│  modules/tenants · auth · menu · orders · health              │
│  routes (HTTP) → services (casos de uso) → repositories        │
└────────────────────────────┬─────────────────────────────────┘
                             │  pg (postgres) — conexión como rol saas_app
┌────────────────────────────▼─────────────────────────────────┐
│  PostgreSQL 16 — multitenant con RLS                      :5432│
│  tenant_id por tabla · get_tenant_id() · set_app_tenant()     │
└──────────────────────────────────────────────────────────────┘
```

El backend sigue **Screaming Architecture**: la estructura de `modules/` revela el dominio del negocio (tenants, auth, menu, orders, health), no la tecnología subyacente. Cada módulo se compone de:

- **Routes**: capa HTTP (Fastify), declara schemas y delega en el service.
- **Service**: casos de uso y reglas de negocio; inyecta el repositorio como dependencia.
- **Repository**: abstracción de persistencia. Hoy son implementaciones in‑memory, pensadas para reemplazarse por PostgreSQL.

`packages/contracts` actúa como **contrato compartido**: schemas de zod que definen los tipos de dominio (vía `z.infer`) y son consumidos tanto por la API como por el frontend. Son la fuente única de verdad para el formato de los datos que cruzan la red, eliminando la deriva entre frontend y backend.

`packages/db` concentra todo lo relacionado con PostgreSQL: migraciones (node‑pg‑migrate), seed y helpers de RLS.

## Estructura del monorepo

```
saasrestaurante/
├── apps/
│   ├── web/                  # Frontend Next.js 15 (App Router) — marca "Lunaris"
│   │   └── app/              #   Rutas: dashboard, menu, tables, orders, caja, ajustes, login
│   └── api/                  # Backend Fastify 5 con Screaming Architecture
│       └── src/
│           ├── modules/      # Módulos de dominio: tenants, auth, menu, orders, health
│           └── shared/       # Config, env, logger, errores comunes
├── packages/
│   ├── db/                   # Migraciones, seed y helpers RLS (node-pg-migrate)
│   │   ├── migrations/       # 11 migraciones numeradas (1_extensions … 11_app_role)
│   │   └── src/              # seed.ts, rls.ts, helpers de tenant
│   └── contracts/            # Schemas zod compartidos (tipos vía z.infer) — sin deps de runtime
├── docs/                     # Vault Obsidian: ADRs, arquitectura, módulos, runbooks (no compila)
├── docker-compose.yml        # PostgreSQL 16 + Adminer para desarrollo local
├── pnpm-workspace.yaml       # Workspace pnpm + allowBuilds para esbuild/sharp
├── turbo.json                # Orquestación de tareas entre workspaces
├── tsconfig.base.json        # Configuración base de TypeScript para todo el repo
└── package.json              # Scripts raíz (dev, build, db:migrate, db:seed…)
```

## Requisitos

| Herramienta | Versión mínima | Notas |
|-------------|---------------|-------|
| Node.js | >= 24 | Verificado con Node 24 |
| pnpm | 11.21.0 | Es el `packageManager` declarado en el repo |
| Docker Desktop | Última | Para PostgreSQL 16 y Adminer |

## Puesta en marcha (local)

### 1. Archivos de entorno

Cada workspace tiene su `.env.example`. Copialos a `.env` (todos están en `.gitignore`):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
```

Valores de referencia para `apps/api/.env`:

```dotenv
DATABASE_URL=postgres://saas_app:saas_app@localhost:5432/saas_restaurante
JWT_SECRET=una-clave-secreta-de-desarrollo
PORT=3001
NODE_ENV=development
```

> Usar credenciales del rol `saas_app` en la API es **intencional**: así la aplicación queda sujeta a RLS (ver [Base de datos y multi-tenancy](#base-de-datos-y-multi-tenancy)). El superusuario `saas` se usa solo en `packages/db/.env` para migraciones y seed.

En `apps/api/.env` el `DATABASE_URL` apunta a `saas_app:saas_app`. Y en `packages/db/.env`:

```dotenv
DATABASE_URL=postgres://saas:saas@localhost:5432/saas_restaurante
```

Para `apps/web/.env`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> `NEXT_PUBLIC_API_URL` es público (se expone al navegador). El entorno de build de Turborepo también lee `DATABASE_URL` como dependencia global (`turbo.json`).

### 2. Levantar PostgreSQL

```bash
docker compose up -d
```

Levanta PostgreSQL 16 (usuario/pass/db: `saas`/`saas`/`saas_restaurante`, puerto `5432`, volumen nombrado y healthcheck) y Adminer en `http://localhost:8080`. El puerto 5432 debe estar libre — si tenés otro PostgreSQL corriendo, detené ese contenedor o remapeá el puerto en `docker-compose.yml`.

### 3. Instalar dependencias

```bash
pnpm install
```

### 4. Migrar y sembrar la base

```bash
pnpm db:migrate
pnpm db:seed
```

Las migraciones corren como `saas` (dueño de las tablas) via `migrate.config.ts`; el seed crea el tenant demo y los datos de referencia.

### 5. Levantar dev (api + web)

```bash
pnpm dev
```

Turborepo ejecuta API y web en paralelo: API en `http://localhost:3001`, web en `http://localhost:3000`.

### 6. Verificar

```bash
curl http://localhost:3001/health
# → {"status":"ok","db":"up"}
```

## Base de datos y multi-tenancy

El aislamiento entre tenants se resuelve en la base de datos, no en la aplicación. Es la decisión arquitectónica clave del proyecto.

- Cada tabla de dominio tiene una columna `tenant_id`, con RLS habilitado **y forzado** (`FORCE ROW LEVEL SECURITY`).
- Helpers SQL provistos en las migraciones:
  - `get_tenant_id()`: lee `current_setting('app.tenant_id')`.
  - `set_app_tenant(uuid)`: establece el tenant actual como setting local de la transacción.
- La API se conecta con el rol **`saas_app`** (creado en la migración 11), un rol no superusuario. Esto es obligatorio: los superusuarios — y los dueños de tablas — **eluden RLS incluso con FORCE**, de modo que el rol de la aplicación tiene que ser no superusuario para que el aislamiento surta efecto.
- Patrón de acceso: `BEGIN → set_app_tenant(tenantId) → queries → COMMIT`. El setting es local de la transacción, por lo que un error o un `ROLLBACK` no contaminan conexiones posteriores.

Migraciones (ordenadas): `1_extensions`, `2_tenants`, `3_users`, `4_branches`, `5_menu`, `6_tables`, `7_orders`, `8_payments`, `9_shifts`, `10_rls`, `11_app_role`.

### Referencia del seed

| Elemento | Valor |
|----------|-------|
| Tenant demo | `11111111-1111-1111-1111-111111111111` |
| Email admin | `admin@demo-restaurante.com` |
| Ítems de menú | 10 (p. ej. Milanesa napolitana) |
| Mesas | 8 |
| Grupos de modificadores | 2 |

## Scripts útiles

Todos los scripts se ejecutan desde la raíz del monorepo:

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Levanta API y web en modo desarrollo (Turborepo, tareas persistentes sin caché) |
| `pnpm build` | Compila todos los workspaces en orden de dependencias |
| `pnpm lint` | Ejecuta lint en todos los workspaces |
| `pnpm test` | Ejecuta la suite de tests (Vitest en la API) |
| `pnpm typecheck` | Typecheck de todos los workspaces |
| `pnpm db:migrate` | Aplica migraciones de `packages/db` |
| `pnpm db:seed` | Carga los datos de referencia (tenant demo) |
| `pnpm db:rls` | Aplica/aísla las políticas RLS |

Se pueden invocar scripts de un workspace puntual con `pnpm --filter <paquete> <script>`, p. ej. `pnpm --filter @saasrestaurante/api test`.

## Documentación

La documentación técnica vive en `docs/`, una **vault de Obsidian** que no forma parte del build:

- `docs/decisions/` — ADRs (registro de decisiones arquitectónicas, p. ej. ADR-001 monorepo).
- `docs/architecture/` — Vistas de arquitectura: overview, multi-tenancy, flujo de pedidos.
- `docs/modules/` — Documentación por módulo (auth, menu, orders, payments, tables, tenant).
- `docs/runbooks/` — Procedimientos operativos: desarrollo local, migraciones de base de datos.
- `docs/templates/` — Plantillas para nuevas notas (módulo, daily).

## Gotchas conocidos

- **Fuente única de truth duplicada**: `packages/contracts` define los schemas zod compartidos; no redefinir tipos de dominio a mano en la web ni en la API.
- **Crear `.env` desde `.env.example`**: todos los `.env` están gitignoreados; sin ellos el dev no arranca.
- **Dos credenciales distintas para el mismo Postgres**: la API usa `saas_app` (sujeto a RLS), `packages/db` usa `saas` (superusuario, para migraciones/seed). Mezclarlas rompe el aislamiento entre tenants.
- **`migrate.config.ts`**: node-pg-migrate carga `dotenv` desde una config TS; conservá el flag `-f migrate.config.ts` en los scripts de `packages/db`.
- **`pnpm-workspace.yaml` con `allowBuilds`**: pnpm 11 requiere aprobar scripts de build nativos (`esbuild`, `sharp`) explícitamente; no agregar dependencias con build scripts sin declararlas ahí.
- **Bug de Fastify 5 durante el setup**: registrar un `addHook` directamente sobre la instancia raíz que llame a `reply.header()` y luego `app.inject()` cuelga el proceso. Los hooks que setean headers deben declararse dentro de un plugin.
- **Auth es un esqueleto**: el decorator/guard de JWT funciona, pero el login está mockeado — devuelve 401 para las credenciales del seed hasta que se conecte a la base real.
- **Puerto 5432 ocupado**: si otro proyecto ya tiene PostgreSQL, `docker compose up -d` falla. Detené ese contenedor o remapeá el puerto en `docker-compose.yml`.