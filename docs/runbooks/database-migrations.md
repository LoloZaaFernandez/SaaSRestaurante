# Migraciones de base de datos

Usamos `node-pg-migrate` + `pg` desde `packages/db`. Las migraciones se versionan junto al código y se disparan desde la raíz con pnpm.

## Agregar una migración

```bash
pnpm --filter @saasrestaurante/db migrate:create "nombre-descriptivo"
```

Se genera un archivo con prefijo de timestamp que garantiza el orden.

## Aplicar / revertir

```bash
pnpm db:migrate        # migra hacia adelante
pnpm --filter @saasrestaurante/db migrate:down   # revierte la última
```

## Reglas

- Las migraciones son **inmutables una vez mergeadas**: si necesitás ajustar algo, agregá una migración nueva; nunca edités una ya aplicada.
- Todo cambio de esquema va como migración, incluidas políticas RLS.

## Cuándo tocar RLS

Una migración debe **tocar RLS** cuando:

- Creás una tabla de negocio perteneciente a un tenant → habilitar RLS y crear política.
- Cambiás la semántica de acceso (roles, columnas de aislamiento).
- Modificás el esquema de `tenants` o de los helpers de sesión (`current_tenant_id`).

Pasos para una tabla tenant-scoped nueva:

1. `tenant_id uuid NOT NULL REFERENCES tenants(id)`, con índice.
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
3. Política `USING` + `WITH CHECK` comparando con `current_tenant_id()`.

Patrón completo en [[../architecture/multi-tenancy|multi-tenancy]]. Cuando una política cambia, reaplicar con `pnpm db:rls` en local.

## Relacionados

- [[../modules/tenant|Módulo tenant]]
- [[local-development|Desarrollo local]]
- [[../architecture/multi-tenancy|Multi-tenancy]]