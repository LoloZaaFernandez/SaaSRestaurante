# Desarrollo local

## Prerrequisitos

- Node 24, pnpm 11 y Docker.
- Crear los archivos `.env` por app a partir de sus `.env.example` (p. ej. `apps/web/.env`).

## Pasos

```bash
# 1. Levantar PostgreSQL con docker
docker compose up -d

# 2. Instalar dependencias del monorepo
pnpm install

# 3. Correr las migraciones de base de datos
pnpm db:migrate

# 4. Cargar datos demo
pnpm db:seed

# 5. Levantar web y api en dev
pnpm dev
```

Turborepo lanza `apps/web` (Next.js, puerto por defecto `:3000`) y `apps/api` (Fastify, `:3001`) en paralelo con hot reload.

## Variables clave

- `NEXT_PUBLIC_API_URL=http://localhost:3001` en `apps/web/.env` — apunta la web a la API local.
- `DATABASE_URL=postgres://...` en `apps/api/.env` y `packages/db/.env` — conexión a PostgreSQL.

## Reseteo rápido de la base

```bash
docker compose down -v   # borra el volumen de datos
pnpm db:migrate
pnpm db:seed
```

## Relacionados

- [[../architecture/overview|Vista de arquitectura]]
- [[database-migrations|Migraciones de base de datos]]
- [[../decisions/ADR-001-monorepo|ADR-001 — Monorepo]]