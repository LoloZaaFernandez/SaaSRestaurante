# Módulo: Autenticación

## Responsabilidades

- Login / logout de usuarios del tenant.
- Sesión (HTTP-only cookie) y resolución del `tenant_id` a partir del usuario.
- Roles dentro del tenant (p. ej. admin, mozo, cocina).

## Consideraciones

- El `tenant_id` nunca viaja como input del cliente: se resuelve del token/sesión en el servidor.
- Cada request llama a `set_app_tenant(...)` antes de tocar datos ([[../architecture/multi-tenancy|multi-tenancy]]).
- La web distingue usuario autenticado (cookie de sesión) y redirige a `/login` o `/dashboard` según corresponda.

## Superficie de API (borrador)

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Relacionados

- [[../architecture/multi-tenancy|Multi-tenancy]]
- [[../decisions/ADR-001-monorepo|ADR-001 — Monorepo]]
- [[templates/module|Template de módulo]]