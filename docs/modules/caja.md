# Módulo: Caja

## Responsabilidades

- Cobrar pedidos abiertos y cerrarlos de forma transaccional.
- Calcular el vuelto para pagos en efectivo.
- Emitir Boleta (`B001`) o Factura (`F001`) después del cobro.
- Abrir, consultar y cerrar turnos de caja.
- Registrar movimientos manuales de ingreso y egreso.
- Calcular el efectivo esperado para el arqueo.

## Flujo de cobro

La pantalla `apps/web/app/caja/page.tsx` obtiene los pedidos abiertos desde
`GET /orders?status=open`. Al confirmar un cobro ejecuta:

1. `POST /orders/:id/payments`.
2. `POST /invoices`.

El primer endpoint valida que el monto coincida con el total del pedido, suma
la propina, calcula el vuelto y cambia el pedido a `paid` en una transacción.
El segundo endpoint genera el correlativo por sucursal y serie. La pantalla
informa si el primer request se completó pero la emisión del comprobante falló;
la emisión no se duplica porque el backend rechaza pedidos con comprobante.

Métodos soportados: `cash`, `card`, `transfer`, `yape` y `plin`. El monto
recibido y el vuelto se solicitan únicamente para efectivo.

## Turnos

La tabla `shifts` ya existente se utiliza mediante el módulo
`apps/api/src/modules/shifts/`:

- `GET /shifts/current?branchId=...`
- `POST /shifts` con `branchId` y `openingCash`
- `POST /shifts/:id/close` con `closingCash`
- `GET /shifts/:id/movements`
- `POST /shifts/:id/movements`

Solo puede existir un turno abierto por tenant y sucursal. El cierre guarda:

- `closingCash`: efectivo contado físicamente.
- `expectedTotal`: monto esperado calculado por el sistema.

El esperado parte del monto inicial, suma pagos en efectivo (importe más
propina), suma ingresos manuales y resta egresos manuales. Los pagos se
relacionan opcionalmente con el turno abierto de su sucursal.

## Persistencia y seguridad

La migración `20_cash_movements` agrega `payments.shift_id`, la tabla
`shift_movements`, índices, restricción de tipos/importes y políticas RLS.
Todas las consultas del módulo usan `withTenant`, por lo que el contexto de
tenant se establece antes de acceder a los datos.

La migración también crea un índice único parcial para impedir dos turnos
abiertos simultáneamente en la misma sucursal.

## Pagos históricos

`GET /payments/:orderId` devuelve los pagos del pedido ordenados por fecha.
Los pagos existentes antes de la migración pueden tener `shift_id` nulo y no se
asignan retroactivamente a un turno.

## Pendientes

- Imprimir o descargar el comprobante.
- Integrar facturación electrónica real.
- Permitir reportes históricos de turnos y diferencias acumuladas.
