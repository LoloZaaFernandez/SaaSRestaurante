# ADR-001 — Monorepo con pnpm + Turborepo y stack modular

- **Status**: Aceptado
- **Fecha**: 2026-08-13
- **Decisores**: Equipo Lunaris

## Context

El producto es un SaaS multi-tenant para restaurantes: frontend de administración (web), API de datos y capa de base de datos compartida. Necesitamos un repositorio único donde convivan app, API y paquetes compartidos, con versionado y CI coherentes, y un solo lugar para las decisiones técnicas. El equipo prefiere una base simple y bien entendida antes que frameworks pesados sin control.

## Decision

- **Monorepo**: pnpm workspaces + Turborepo para orquestar tareas y cachear builds.
- **Frontend**: Next.js 15 (App Router) en `apps/web`, estilizado con Tailwind CSS. El sistema visual final lo aporta el design system "lunaris".
- **Backend**: Fastify en `apps/api`.
- **Base de datos**: PostgreSQL con migraciones vía `node-pg-migrate` + driver `pg` en `packages/db`.
- **Aislamiento multi-tenant**: Row Level Security con `tenant_id` en todas las tablas de negocio.
- **Contratos compartidos**: `packages/contracts` con tipos y DTOs que comparten web y api.
- **Documentación**: vault de Obsidian versionado en `docs/`.

## Consequences

### Positivas
- Una sola fuente de verdad para tipos y contratos entre frontend y API.
- Builds cacheados por Turborepo: solo se reconstruye lo que cambió.
- Onboarding simple: `pnpm install` y `pnpm dev` desde la raíz.
- Docs versionadas junto al código, sin plataforma externa.

### Negativas / Trade-offs
- Curva de aprendizaje de monorepo y workspaces.
- Requiere disciplina en las boundaries entre paquetes para no acoplar apps.

## Options considered

| Opción | Resultado |
| --- | --- |
| Monorepo pnpm + Turborepo | **Elegida** |
| Multi-repo (web, api, db separados) | Descartada: duplica contratos y dificulta cambios coordinados |
| Nx | Descartada: más peso del necesario para el tamaño del equipo |
| Docs en plataforma externa (Confluence/Notion) | Descartada: queremos docs que viajen con el código |

## Relacionados

- [[../architecture/overview|Vista de arquitectura]]
- [[../architecture/multi-tenancy|Multi-tenancy]]
- [[../runbooks/local-development|Desarrollo local]]