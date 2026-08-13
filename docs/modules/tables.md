# Módulo: Mesas

## Responsabilidades

- Plano de mesas: posición, capacidad y estado del salón.
- Estados: `free`, `occupied`, `reserved`, `cleaning`.
- Vincular una mesa a su pedido activo.

## Reglas

- Una mesa tiene un único pedido `open` a la vez.
- Al cobrar (`paid`) o cancelar, la mesa pasa al estado según la convención del local (p. ej. `cleaning`).

## Superficie de API (borrador)

- `GET /tables`
- `POST /tables/:id/assign`
- `PATCH /tables/:id/status`

## Relacionados

- [[../modules/orders|Módulo pedidos]]
- [[templates/module|Template de módulo]]