# Módulo: Analytics (Dashboard)

## Responsabilidades

- Proveer los KPIs del Dashboard: ventas del día, ticket promedio, pedidos activos y ocupación de mesas.
- Proveer reportes agregados para el período seleccionado (hoy / semana / mes): ventas por día, top ítems y hora pico.
- Exponer las métricas como **vistas de agregación** en la base para no escanear las tablas transaccionales en cada request.

## Datos clave

| Entidad | Fuente | Descripción |
| --- | --- | --- |
| `payments` | tabla | Suma de `amount` = ventas; `received_at` = momento del cobro |
| `orders` | tabla | `opened_at` (pedidos del día), `status` (pedidos activos) |
| `tables` | tabla | `status` → ocupación actual del salón |
| `order_items` | tabla | `quantity`, `line_total`, `name` → top ítems |
| `v_ventas_diarias` | vista | Ventas y pedidos cobrados por tenant y día (UTC) |
| `v_top_items` | vista | Cantidad e ingresos por ítem y día (UTC), sin pedidos cancelados |
| `v_ocupacion_mesas` | vista | Cantidad de mesas por estado y sucursal |

### Índices de soporte (migración `19_analytics`)

- `payments(received_at)` → agregaciones por día/hora.
- `orders(created_at)` → ordenamiento y filtros temporales.
- Nota: `orders(branch_id)` y `orders(opened_at)` ya existían desde la migración `7_orders`.

## Reglas de negocio y decisiones

- **Ventas del día** = `SUM(payments.amount)` del día. No se incluye propina en la cifra de ventas.
- **Ticket promedio** = ventas del período / cantidad de pedidos **cobrados** (con pago) del período. Si no hay pedidos cobrados → `0.00`.
- **Pedidos del día** (`ordersToday`) = pedidos abiertos ese día (`opened_at` en el rango) sin estado `cancelled`.
- **Pedidos activos** (`openOrders`) = pedidos con `status = 'open'`, sin importar el día.
- **Ocupación** = conteo de mesas por `status`; el % se calcula en el frontend (`occupied / total`).
- **Días en UTC**: las vistas agrupan por `(timestamp AT TIME ZONE 'UTC')::date`. Es deliberado: el bucketing es determinístico e independiente de la zona horaria del server. Pendiente futuro: días en la zona horaria del restaurante.
- **RLS**: las vistas se crean con `WITH (security_invoker = true)` para que la consulta corra con los permisos del rol invocador (`saas_app`) y NO con los del owner (`saas`). Así el `FORCE ROW LEVEL SECURITY` de las tablas base sigue filtrando por `get_tenant_id()`. Sin contexto de tenant, las vistas devuelven 0 filas.
- **Schemas fuera de `packages/contracts`**: los shapes de analytics son view-models de este módulo (no entidades de dominio), por eso viven en `analytics.schemas.ts`, siguiendo el patrón de schemas de input de `invoices.schemas.ts`. La web mantiene sus tipos en `lib/api.ts`, como ya hace con el resto de los módulos.

## Superficie de API

### `GET /analytics/dashboard`

Requiere auth (`Bearer`). Devuelve los KPIs del día actual (UTC) y el top de ítems.

```jsonc
{
  "period": { "from": "2026-08-20", "to": "2026-08-20" },
  "metrics": {
    "salesToday": "1284.50",
    "ordersToday": 23,
    "averageTicket": "55.85",
    "openOrders": 4,
    "tables": { "total": 8, "occupied": 3, "free": 4, "reserved": 1, "cleaning": 0 }
  },
  "topItems": [
    { "name": "Milanesa napolitana", "quantity": 12, "revenue": "150.00" }
  ]
}
```

### `GET /analytics/report?from=YYYY-MM-DD&to=YYYY-MM-DD`

Requiere auth (`Bearer`). `from`/`to` son opcionales: por defecto, últimos 7 días (inclusive hoy). `from` debe ser `<= to`, si no → `400 INVALID_RANGE`. Devuelve la serie diaria (con los días sin datos completados en `0.00`), top 5 ítems del rango, ventas por hora (24 filas) y totales.

```jsonc
{
  "period": { "from": "2026-08-14", "to": "2026-08-20" },
  "dailySales": [{ "date": "2026-08-20", "sales": "1284.50", "orders": 23, "payments": 24 }],
  "topItems": [{ "name": "Milanesa napolitana", "quantity": 42, "revenue": "525.00" }],
  "salesByHour": [{ "hour": 13, "sales": "310.00", "orders": 5 }],
  "totals": { "sales": "8420.00", "orders": 151, "averageTicket": "55.76" }
}
```

## Frontend (`apps/web/app/dashboard`)

- Página cliente que consulta `/analytics/dashboard` (KPIs) y `/analytics/report` (gráficos) según el rango seleccionado (Hoy / Semana / Mes).
- Estados: skeletons de carga (`StatSkeleton`), error con botón **Reintentar** por sección.
- Gráficos sin librería externa: barras verticales (ventas por día de la semana y por hora) y barras horizontales (top 5 ítems) con Tailwind.
- **Sesión vencida**: el JWT vence a las 8 h (`JWT_EXPIRES_IN`, ver `apps/api/src/shared/env.ts`). `AuthProvider` solo valida que exista la cookie, no su vigencia. Por eso `apiFetch` (`apps/web/lib/api.ts`) detecta cualquier `401`, borra la cookie (`clearSession`) y redirige a `/login`. Sin esto, un token vencido deja el dashboard en estado de error permanente con "Reintentar" inútil.

## Tests

- `apps/api/src/analytics.test.ts` (integración, requiere DB): auth obligatoria, rango invertido → 400, el dashboard refleja pagos/pedidos/mesas, el reporte completa huecos por día y hora.

## Relacionados

- [[../architecture/multi-tenancy|Multi-tenancy y RLS]]
- [[../modules/payments|Módulo pagos]]
- [[../modules/orders|Módulo pedidos]]
- [[../architecture/overview|Vista de arquitectura]]
- [[templates/module|Template de módulo]]

## Pendientes

- Días en la zona horaria del restaurante (hoy: UTC).
- Filtro por sucursal (`branchId`) en dashboard y report.
- Comparativa con ayer / período anterior en los KPI.
- Exportar reporte (CSV).