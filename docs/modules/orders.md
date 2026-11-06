# Módulo: Pedidos

## Responsabilidades

- Creación de pedidos asociados a una mesa (o delivery).
- Agregar / remover ítems con cantidad.
- Cambio de estado: `open` → `paid | cancelled`.

## Reglas

- `order_items.unit_price` guarda el snapshot del precio al momento del alta (ver [[../architecture/order-flow|flujo de pedidos]]).
- Las cantidades son positivas.
- Un pedido pago es inmutable salvo correcciones auditadas.

## Superficie de API (borrador)

- `POST /orders`
- `GET /orders/:id`
- `POST /orders/:id/items`
- `POST /orders/:id/pay`

## Relacionados

- [[../architecture/order-flow|Flujo de pedidos]]
- [[../modules/payments|Módulo pagos]]
- [[templates/module|Template de módulo]]
## Toma de pedido con modificadores, notas y mesero

Endpoints de apoyo (todos autenticados y acotados al tenant por RLS):

| Ruta | Uso |
|------|-----|
| `GET /branches` | Sucursales activas |
| `GET /tables?branchId=` | Mesas reales de la sucursal (orden natural por etiqueta) |
| `GET /menu/modifier-catalog` | Grupos con sus opciones (`required/min/max`) y `itemGroups` (ítem → grupos asignados) |
| `GET /users?role=waiter` | Personal activo (`id`, `fullName`, `role`; sin email ni hash) |
| `GET /orders?status=&branchId=&limit=` | Historial; los cancelados sólo salen con `status=cancelled` |

`POST /orders` acepta además `waiterId` (opcional) y `notes` por ítem (máx. 200, se recorta; vacío = sin nota).

Validaciones: ítem activo; los modificadores deben pertenecer a los grupos asignados al ítem, sin repetir, respetando
`min`/`max` (un grupo `required` exige al menos 1); la mesa debe pertenecer a la sucursal y la sucursal estar activa;
`waiterId` debe ser un usuario activo del tenant con rol `waiter` (si se omite, es quien crea el pedido).
Los usuarios no tienen sucursal en el esquema, por lo que no se valida mesero↔sucursal.

El carrito web guarda un borrador en `localStorage` (`lunaris.order-draft.v1`) con sólo ids, cantidades y notas; los
precios se recalculan siempre con el menú vigente y el total definitivo es el que devuelve el servidor.
