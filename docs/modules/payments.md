# Módulo: Pagos

## Responsabilidades

- Registrar el cobro de un pedido (efectivo, tarjeta u otro medio).
- Cerrar el pedido asociado: `open` → `paid`, en la misma transacción.
- Proveer el ticket: detalle de ítems + total.

## Reglas

- Cobrar y cerrar el pedido ocurren **en la misma transacción** contra PostgreSQL.
- El monto pagado debe coincidir con el total del pedido (o ajustarse explícitamente, p. ej. propina).

## Superficie de API (borrador)

- `POST /orders/:id/pay`
- `GET /payments/:orderId`

## Relacionados

- [[../architecture/order-flow|Flujo de pedidos]]
- [[../modules/orders|Módulo pedidos]]
- [[templates/module|Template de módulo]]