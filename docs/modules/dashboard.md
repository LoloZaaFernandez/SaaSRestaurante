# Módulo: Dashboard

Panel operativo y de análisis del tenant. Muestra los KPIs del día (StatCards) y un reporte
agregado con selector de rango (Hoy / Semana / Mes) y tres gráficos.

## Responsabilidades

- KPIs del día: ventas, ticket promedio, pedidos activos y ocupación de mesas.
- Reporte por rango: ventas por día de la semana, top 5 ítems y hora pico.
- Aislar por tenant todo dato agregado (RLS) y responder con ceros cuando no hay datos.

## KPIs

| KPI | Fuente | Definición |
| --- | --- | --- |
| Ventas hoy | `v_daily_sales` | `SUM(payments.amount)` del día (día local, `America/Argentina/Buenos_Aires`). |
| Ticket promedio | `v_daily_sales` | ventas del día / pedidos pagados distintos (sin dividir por cero). |
| Pedidos activos | `orders` | conteo con `status = 'open'` en este momento. |
| Pedidos del día | `orders` | conteo creado hoy (`status <> 'cancelled'`). |
| Ocupación | `v_table_occupancy` | mesas por estado: libre / ocupada / reservada / limpieza. |
| Top ítems | `v_top_items` | cantidad e ingreso por ítem (snapshot `order_items.name`), top 5 por ingreso. |

## Fuente de datos

Views de agregación de la migración `12_analytics` ([[../runbooks/database-migrations|migraciones]]):

- `v_daily_sales` — ventas, propinas, pedidos pagados y ticket promedio por día y tenant.
- `v_top_items` — cantidad e ingreso por ítem y día.
- `v_table_occupancy` — cantidad de mesas por estado y tenant.

Índices de soporte: `payments(received_at)`, `orders(created_at)`, `order_items(menu_item_id)`.
El de `orders(branch_id)` ya existía en la migración 7.

## Superficie de API

- `GET /analytics/dashboard` — KPIs del día actual del tenant (autenticado).
- `GET /analytics/report?range=today|week|month` — reporte agregado del rango (autenticado).

Montos como string decimal (`"12.90"`), consistente con `moneySchema` de `packages/contracts`.
Sin datos el backend responde con ceros, nunca con error.

## Acceso a datos (RLS transaccional)

Cada consulta corre en una transacción propia:

```
BEGIN → SET LOCAL TIME ZONE 'America/Argentina/Buenos_Aires' → set_app_tenant(tenantId) → queries → COMMIT
```

El `SET LOCAL` alinea el corte de "día" con el de las views y se revierte al cerrar la
transacción. `set_app_tenant` deja el contexto de tenant activo para que el Row Level Security
filtre (ver [[../architecture/multi-tenancy|multi-tenancy]]). Todas las queries usan el mismo
cliente del pool; `pool.query()` no serviría porque tomaría otro cliente sin el contexto.

## Frontend

- `apps/web/app/dashboard/page.tsx` — componente cliente con estados de carga (skeleton), error
  (mensaje + Reintentar) y selector de rango.
- Proxies same-origin que agregan el JWT de la cookie de sesión: `app/api/dashboard/route.ts` y
  `app/api/report/route.ts`. El navegador nunca expone el token ni habla con la API directo.
- `components/BarChart.tsx` — barras con Tailwind, sin librerías de gráficos.
- `lib/api.ts` — tipos y clientes `getDashboard()` / `getReport(range)`.

## Relacionados

- [[../architecture/multi-tenancy|Multi-tenancy]]
- [[../modules/payments|Módulo pagos]]
- [[../modules/orders|Módulo pedidos]]
- [[../runbooks/database-migrations|Runbook de migraciones]]
- [[templates/module|Template de módulo]]