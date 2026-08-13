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