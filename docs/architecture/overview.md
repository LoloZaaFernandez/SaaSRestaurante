# Visión general de la arquitectura

SaaS multi-tenant de gestión para restaurantes. El frontend se sirve a los navegadores, la API expone REST/JSON, y PostgreSQL guarda todo con aislamiento por tenant.

## Diagrama del monorepo

```ascii
SaasRestaurante/
├── apps/
│   ├── web/        # Next.js 15 (App Router), Tailwind — frontend
│   └── api/        # Fastify — backend REST/JSON
├── packages/
│   ├── db/         # conexión pg, migraciones, helpers de RLS
│   └── contracts/  # tipos y DTOs compartidos entre web y api
├── docs/           # este vault (Obsidian versionado)
├── docker-compose.yml  # PostgreSQL local
├── pnpm-workspace.yaml
└── package.json    # scripts pnpm delegados a Turborepo
```

## Diagrama de flujo web → api → pg

```ascii
+------------------+      +-----------------+      +--------------+
|  Browser (web)   |      |  apps/api       |      |  PostgreSQL  |
|  Next.js 15      | ---> |  Fastify        | ---> |   (:5433)    |
|  Tailwind UI     | REST |  REST / JSON    |  SQL  |  RLS x tenant|
+------------------+      +-----------------+      +--------------+
        ^                        |                        ^
        |                   autentica             set_app_tenant()
        |                 resuelve tenant           (por request)
        |                        |
        +------ packages/contracts (tipos compartidos)
```

## Flujo de datos

1. La web usa los tipos de `packages/contracts` (contrato único entre frontend y API).
2. La web llama a la API apuntando a `NEXT_PUBLIC_API_URL` (ver [[../runbooks/local-development|desarrollo local]]).
3. Fastify autentica, resuelve el `tenant_id` del usuario y llama a `set_app_tenant(...)` antes de cada transacción.
4. PostgreSQL aplica RLS: cada fila solo se lee/edita si su `tenant_id` coincide con el tenant activo.
5. El frontend renderiza manteniendo la sesión vía cookies/headers.

Reglas de aislamiento y helper de sesión en [[multi-tenancy|Multi-tenancy]].

## Decisiones relacionadas

- [[../decisions/ADR-001-monorepo|ADR-001 — Monorepo]]
- [[../architecture/multi-tenancy|Multi-tenancy]]
- [[../architecture/order-flow|Flujo de pedidos]]
- [[../runbooks/local-development|Desarrollo local]]
