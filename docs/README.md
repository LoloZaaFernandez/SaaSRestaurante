# Lunaris — Documentación del Proyecto

Vault de Obsidian con la documentación técnica y operativa del SaaS de gestión para restaurantes **Lunaris** (nombre de trabajo: SaasRestaurante).

## ¿Qué hay acá?

- `decisions/` — ADRs: decisiones de arquitectura con contexto, decisión y consecuencias.
- `architecture/` — vistas de arquitectura, multi-tenancy y flujos clave.
- `modules/` — documentación funcional y técnica de cada módulo del sistema.
- `runbooks/` — procedimientos operativos (desarrollo local, migraciones).
- `templates/` — plantillas para crear contenido nuevo.

## Convenciones

- Idioma: español.
- Enlaces entre notas con sintaxis `[[...]]` de Obsidian.
- Toda decisión de arquitectura se registra como ADR en `decisions/`.
- Para un módulo nuevo: copiar [[templates/module|plantilla de módulo]].

## Sincronizar el vault con git

1. Abrí la carpeta `docs/` como vault (File → Open folder as vault en Obsidian).
2. Commiteá los cambios junto al resto del repo:

```bash
git add docs/
git commit -m "docs: ..."
```

3. Antes de empezar a trabajar: `git pull` para no pisar cambios de otros.
4. No subas `docs/.obsidian/workspace.json` ni `workspace-mobile.json`: son del estado local del editor, no del contenido. Solo `app.json` (config de comportamiento) versiona.

> Tip: Obsidian escribe a disco a medida que editás; git queda como copia de seguridad e historial.

## Página de entrada

- Empezá por [[architecture/overview|Vista de arquitectura]] y por [[decisions/ADR-001-monorepo|ADR-001 — Monorepo]].