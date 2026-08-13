# Módulo: Tenant

Un tenant es un restaurante cliente del SaaS.

## Responsabilidades

- Alta y edición de restaurantes (nombre, slug, plan).
- Ciclo de vida del tenant: `active`, `suspended`, `cancelled`.
- Aislamiento de datos del tenant con `tenant_id` + RLS.

## Datos clave

| Entidad | Descripción |
| --- | --- |
| `tenants` | `id`, `name`, `slug`, `plan`, `status`, `created_at` |

Casi todas las tablas de negocio referencia `tenant_id`.

## Consideraciones

- Crear el tenant con su RLS habilitado **antes** de cargar datos de negocio.
- El `slug` permite URLs legibles y resolución del tenant en la API.

## Relacionados

- [[../architecture/multi-tenancy|Multi-tenancy]]
- [[../architecture/overview|Vista de arquitectura]]
- [[templates/module|Template de módulo]]