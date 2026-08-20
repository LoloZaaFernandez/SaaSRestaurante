# Módulo: Menú

Catálogo administrativo de productos para el restaurante. Permite gestionar ítems, categorías y grupos modificadores por tenant.

## Objetivo del sprint

Reemplazar los datos mock del menú por datos reales de la API Fastify y completar la administración básica del catálogo desde el frontend.

## Responsabilidades

- Consultar los ítems reales del menú desde el backend.
- Crear ítems con nombre, descripción, precio, categoría y estado.
- Editar el nombre, precio y estado de un ítem.
- Activar y desactivar ítems mediante baja lógica.
- Crear y renombrar categorías.
- Crear grupos modificadores.
- Asignar y quitar grupos modificadores de cada ítem.
- Mantener el aislamiento de datos por tenant mediante el contexto autenticado y RLS.

## Flujo funcional del frontend

La pantalla se encuentra en `/menu` dentro de `apps/web` y se organiza en tres secciones:

### Ítems

- Carga ítems, categorías, grupos y asignaciones desde la API.
- Muestra únicamente los datos recibidos del backend; no utiliza los diez ítems hardcodeados del mock anterior.
- Permite buscar por nombre o descripción.
- Permite filtrar por categoría y estado.
- Permite crear un ítem.
- Permite editar nombre, precio y estado.
- Permite activar o desactivar un ítem.
- Permite expandir cada ítem para asignar grupos modificadores.

### Categorías

- Crear una categoría.
- Renombrar una categoría desde la propia lista.
- La posición se asigna al final de la lista al crearla.

### Grupos modificadores

- Crear un grupo con nombre, mínimo, máximo y obligatoriedad.
- Consultar los grupos existentes.
- La asignación a los ítems se realiza desde la sección de ítems.

## Superficie de API

Todas las rutas administrativas requieren autenticación y utilizan el `tenantId` del token JWT.

### Ítems

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/menu/items` | Lista los ítems activos. |
| `GET` | `/menu/items?includeInactive=true` | Lista activos e inactivos para administración. |
| `POST` | `/menu/items` | Crea un ítem. |
| `PATCH` | `/menu/items/:id` | Edita `name`, `price` o `active`. |
| `DELETE` | `/menu/items/:id` | Realiza baja lógica estableciendo `active=false`. |

Ejemplo de creación:

```json
{
  "name": "Milanesa napolitana",
  "description": "Milanesa con salsa, jamón y queso",
  "price": "12.50",
  "categoryId": "uuid-de-categoria",
  "active": true
}
```

### Categorías

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/menu/categories` | Lista las categorías ordenadas por posición y nombre. |
| `POST` | `/menu/categories` | Crea una categoría. |
| `PATCH` | `/menu/categories/:id` | Renombra o actualiza la posición de una categoría. |

### Grupos modificadores y asignaciones

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/menu/modifier-groups` | Lista los grupos modificadores del tenant. |
| `POST` | `/menu/modifier-groups` | Crea un grupo modificador. |
| `GET` | `/menu/items/:id/modifier-groups` | Obtiene los grupos asignados a un ítem. |
| `PUT` | `/menu/items/:id/modifier-groups` | Reemplaza la asignación de grupos del ítem. |

Ejemplo de asignación:

```json
{
  "modifierGroupIds": [
    "uuid-del-grupo-extras",
    "uuid-del-grupo-punto-de-carne"
  ]
}
```

## Datos y persistencia

El sprint utiliza las tablas existentes, sin agregar migraciones nuevas:

| Tabla | Uso |
| --- | --- |
| `menu_categories` | Categorías del catálogo. |
| `menu_items` | Ítems, precios, descripción y estado. |
| `modifier_groups` | Configuración de grupos modificadores. |
| `modifiers` | Opciones individuales de cada grupo, existentes en la base. |
| `menu_item_modifiers` | Relación entre ítems y grupos modificadores. |

Los ítems se desactivan de forma lógica. No se eliminan físicamente, por lo que los pedidos históricos conservan sus referencias y snapshots.

## Reglas de negocio

- Los precios se transportan como texto decimal con hasta dos posiciones, por ejemplo `12.50`.
- La interfaz acepta punto o coma decimal y normaliza el valor antes de enviarlo a la API.
- Un ítem inactivo no debe aparecer disponible para nuevos pedidos.
- Los pedidos existentes conservan su snapshot aunque el ítem cambie de precio o estado.
- Durante la edición de un ítem no se cambia la categoría porque el endpoint `PATCH /menu/items/:id` definido para este sprint solo contempla nombre, precio y estado.
- Un grupo debe tener `min >= 0`, `max >= 1` y `min <= max`.
- Las asignaciones de grupos reemplazan la relación anterior del ítem en una única operación lógica.
- Todas las consultas y escrituras se ejecutan dentro del tenant autenticado.

## Validación realizada

Desde la raíz del monorepo:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Resultado esperado:

- Typecheck correcto en los paquetes del monorepo.
- 30 pruebas API exitosas.
- Build de producción de Next.js exitoso.

Validación local adicional:

- Frontend: `http://localhost:3000/menu`
- API: `http://localhost:3001/health`
- PostgreSQL local: puerto `5433`, según la configuración del proyecto.

## Alcance pendiente

Este sprint no agrega CRUD para los modificadores individuales (`modifiers`) ni edición o eliminación de grupos modificadores, porque esos endpoints no forman parte del alcance solicitado. Pueden agregarse en un sprint posterior si el producto requiere administrar también las opciones internas de cada grupo.

## Archivos principales

- `apps/web/app/menu/page.tsx` — interfaz administrativa.
- `apps/web/lib/api.ts` — cliente y tipos del menú.
- `apps/api/src/modules/menu/menu.routes.ts` — rutas HTTP.
- `apps/api/src/modules/menu/menu.service.ts` — lógica de negocio y persistencia.
- `apps/api/src/modules/menu/menu.schemas.ts` — validaciones de entrada.
- `apps/api/src/integration.test.ts` — pruebas de integración.

## Relacionados

- [[../architecture/order-flow|Flujo de pedidos]]
- [[../architecture/multi-tenancy|Multi-tenancy]]
- [[../runbooks/local-development|Desarrollo local]]
- [[templates/module|Plantilla de módulo]]
