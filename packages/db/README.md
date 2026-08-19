# @saasrestaurante/db

Database package for the restaurant SaaS. Plain `pg` + raw SQL, multi-tenant by row with Postgres Row Level Security (RLS). No ORM.

## Tooling

- [node-pg-migrate](https://github.com/salsita/node-pg-migrate) v7 for migrations (TypeScript migrations, loaded via `-j ts`)
- `tsx` to run seed / RLS scripts
- `pg` + `dotenv` for the pool and env loading

## Quick start

### 1. Start Postgres

From the repo root:

```bash
docker compose up -d
```

This boots Postgres 16 with `user=saas`, `password=saas`, database `saas_restaurante` (see root `docker-compose.yml`).

### 2. Configure env

```bash
cp .env.example .env
```

`DATABASE_URL=postgres://saas:saas@localhost:5433/saas_restaurante`

### 3. Run migrations

```bash
pnpm --filter @saasrestaurante/db migrate:up
```

Rollback (last migration first):

```bash
pnpm --filter @saasrestaurante/db migrate:down
```

### 4. Seed demo data

```bash
pnpm --filter @saasrestaurante/db seed
```

Creates one demo tenant (fixed id `11111111-1111-1111-1111-111111111111`), an admin user, 1 branch, 3 menu categories, 10 menu items, 2 modifier groups and 8 tables. Idempotent: re-running it wipes and recreates that tenant's data.

### 5. Enable RLS

Migration `10_rls` already enables RLS, creates the policies and helper functions. `rls:apply` is a belt-and-suspenders script that re-applies the same DDL and then verifies tenant context:

```bash
pnpm --filter @saasrestaurante/db rls:apply
```

## Connecting as the app (tenant context)

Row Level Security keyed on `tenant_id` uses a per-connection GUC. The helper functions are:

```sql
-- returns the current tenant id (raises to NULL if unset)
SELECT get_tenant_id();

-- sets the tenant for the current transaction (scoped, resets on commit)
SELECT set_app_tenant('11111111-1111-1111-1111-111111111111');
```

The app must call `set_app_tenant(<tenant uuid>)` inside **every transaction**. On a fresh connection there is no tenant context, so every query fails closed (returns zero rows) until the tenant is set — by design.

> NOTE: the docker-compose `saas` user is a superuser, and superusers bypass RLS. Use `rls:apply` to sanity-check the machinery, but for real tenant isolation the API must connect with a non-superuser role (e.g. an `app_user` with `GRANT ... ON ALL TABLES` and no `BYPASSRLS`).

## Schema

All tables carry `tenant_id UUID NOT NULL REFERENCES tenants(id)`. `order_items`, `payments`, `shifts`, `menu_item_modifiers`, `orders`, etc. snapshot values (name/price at sale time) so history survives catalog changes. RLS policies select on `tenant_id = get_tenant_id()` for every tenant-scoped table; the `tenants` table itself selects on `id = get_tenant_id()` (its own row).

## Layout

```
migrations/             node-pg-migrate TS migrations (numbered, run in filename order)
src/client.ts           pg Pool + query helper from DATABASE_URL
src/seed.ts             idempotent demo seed
src/rls.ts              re-apply RLS DDL + verify tenant context
src/index.ts            re-exports pool, query, types
```

## Scripts

| Script       | Command created from `package.json`                                     |
| ------------ | ---------------------------------------------------------------------- |
| `migrate:up` | `node-pg-migrate up -m migrations -j ts`                               |
| `migrate:down` | `node-pg-migrate down -m migrations -j ts`                           |
| `seed`       | `tsx src/seed.ts`                                                       |
| `rls:apply`  | `tsx src/rls.ts`                                                        |
| `typecheck`  | `tsc --noEmit`                                                          |
