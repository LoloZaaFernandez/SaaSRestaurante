# Multi-tenancy con Row Level Security

## Modelo

Cada tenant es un restaurante. Toda tabla de negocio lleva una columna `tenant_id` (UUID) que referencia `tenants.id`, y el aislamiento se aplica en la base, no en la app.

```sql
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  price       numeric(12,2) NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX menu_items_tenant_idx ON menu_items (tenant_id);
```

## Helper: set_app_tenant

La API setea el tenant de la sesión antes de cada operación. El `true` de `set_config` hace que el valor viva **solo en la transacción actual**.

```sql
CREATE FUNCTION set_app_tenant(tenant uuid) RETURNS void AS $$
  SELECT set_config('app.tenant_id', tenant::text, true);
$$ LANGUAGE sql VOLATILE;

CREATE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;
```

## Políticas RLS

```sql
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY menu_items_tenant_isolation ON menu_items
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
```

- `USING` filtra lecturas y el destino de UPDATE/DELETE.
- `WITH CHECK` valida la escritura: nadie puede insertar/editar una fila de otro tenant.

Las políticas se aplican con `packages/db` vía el script raíz `pnpm db:rls` (ver [[../runbooks/database-migrations|migraciones]]).

## Reglas de oro

- Toda tabla de negocio tiene `tenant_id` y sus políticas `USING` + `WITH CHECK`.
- `set_app_tenant` se invoca **dentro de la misma transacción** que el resto de las queries.
- RLS no es la única capa: la API también valida el tenant contra el token del usuario.
- Lo global (catálogos de sistema, deploy) no lleva `tenant_id` ni RLS.

## Relacionados

- [[../decisions/ADR-001-monorepo|ADR-001 — Monorepo]]
- [[../modules/tenant|Módulo tenant]]
- [[../runbooks/database-migrations|Migraciones de base de datos]]