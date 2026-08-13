# Módulo: Menú

Catálogo de productos del restaurante.

## Responsabilidades

- CRUD de ítems del menú (`menu_items`): nombre, descripción, precio, categoría, activo.
- Categorías para agrupar (entradas, principales, postres, bebidas).
- Publicar / despublicar ítems con el flag `active`.

## Reglas

- Los precios se editan en el menú, pero los pedidos usan el snapshot de `order_items`.
- Un ítem inactivo no puede agregarse a pedidos nuevos; los pedidos en curso conservan su snapshot.

## Superficie de API (borrador)

- `GET /menu`
- `GET /menu/:id`
- `POST /menu`
- `PATCH /menu/:id`

## Relacionados

- [[../architecture/order-flow|Flujo de pedidos]]
- [[templates/module|Template de módulo]]