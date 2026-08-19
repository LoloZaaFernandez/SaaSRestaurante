import type { MigrationBuilder } from 'node-pg-migrate'

/**
 * Migración 12 — Analytics.
 *
 * Provee las fuentes de agregación que alimentan el dashboard:
 *   - v_daily_sales:      ventas totales, propinas, pedidos pagados y ticket promedio por día y tenant.
 *   - v_top_items:        cantidades e ingreso por ítem del menú (usa el snapshot `order_items.name`).
 *   - v_table_occupancy:  cantidad de mesas por estado (libre/ocupada/reservada/limpieza) por tenant.
 *
 * Nota RLS:
 *   Las views son views simples (no materializadas) y se ejecutan con los privilegios de quien las
 *   consulta (el rol `saas_app`, no superusuario). Por lo tanto el filtrado por `tenant_id` lo aplica
 *   el Row Level Security de las tablas base automáticamente, siempre que la conexión establezca el
 *   contexto de tenant con `set_app_tenant(...)` en la misma transacción.
 *
 * Nota timezone:
 *   `date_trunc('day', received_at)` usa la zona horaria de la sesión. Para que el corte de "día" sea
 *   consistente entre la view y el endpoint, el repositorio de analytics debe fijar la zona horaria de
 *   la conexión (p. ej. `SET TIME ZONE 'America/Argentina/Buenos_Aires'`).
 */
const ANALYTICS_VIEWS = ['v_daily_sales', 'v_top_items', 'v_table_occupancy'] as const

export function up(pgm: MigrationBuilder): void {
  // ---------------------------------------------------------------------------
  // 1. Views de agregación
  // ---------------------------------------------------------------------------

  // Ventas del día (suma de payments) + ticket promedio por pedido pagado.
  // El ticket promedio se calcula como total / cantidad de pedidos pagados distintos,
  // evitando dividir por cero cuando no hubo pagos.
  pgm.createView(
    'v_daily_sales',
    { replace: true },
    `
    SELECT
      p.tenant_id,
      date_trunc('day', p.received_at)::date AS day,
      COALESCE(SUM(p.amount), 0)          AS total_sales,
      COALESCE(SUM(p.tip), 0)             AS total_tips,
      COUNT(DISTINCT p.order_id)          AS paid_orders,
      COUNT(p.id)                         AS payment_count,
      CASE
        WHEN COUNT(DISTINCT p.order_id) = 0 THEN 0
        ELSE ROUND(SUM(p.amount) / COUNT(DISTINCT p.order_id), 2)
      END                                 AS avg_ticket
    FROM payments p
    GROUP BY p.tenant_id, date_trunc('day', p.received_at)::date
    `,
  )

  // Top ítems por cantidad e ingreso, por día. Se agrupa por el snapshot `order_items.name`
  // (y su id) para seguir siendo correcto aunque el ítem se elimine del menú luego.
  // Se excluyen pedidos cancelados.
  pgm.createView(
    'v_top_items',
    { replace: true },
    `
    SELECT
      oi.tenant_id,
      date_trunc('day', o.opened_at)::date AS day,
      oi.menu_item_id,
      oi.name               AS item_name,
      SUM(oi.quantity)::int      AS quantity_sold,
      SUM(oi.line_total)    AS revenue,
      COUNT(DISTINCT oi.order_id)::int AS order_count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'cancelled'
    GROUP BY oi.tenant_id, date_trunc('day', o.opened_at)::date, oi.menu_item_id, oi.name
    `,
  )

  // Ocupación de mesas: cantidad de mesas por estado, por tenant.
  pgm.createView(
    'v_table_occupancy',
    { replace: true },
    `
    SELECT
      tenant_id,
      status,
      COUNT(*)::int AS table_count
    FROM tables
    GROUP BY tenant_id, status
    `,
  )

  // ---------------------------------------------------------------------------
  // 2. Índices para que las agregaciones no escaneen todas las filas
  // ---------------------------------------------------------------------------
  // payments.received_at: soporta el filtro "ventas del día/rango" (la columna es received_at,
  // no paid_at). Btree por defecto.
  pgm.createIndex('payments', 'received_at')

  // orders.created_at: soporta conteos/filtros por fecha de creación del pedido.
  pgm.createIndex('orders', 'created_at')

  // order_items.menu_item_id: soporta el GROUP BY de v_top_items.
  pgm.createIndex('order_items', 'menu_item_id')

  // ---------------------------------------------------------------------------
  // 3. Permisos explícitos sobre las views para el rol de la aplicación
  // ---------------------------------------------------------------------------
  // Aunque la migración 11 configura ALTER DEFAULT PRIVILEGES, se otorga SELECT
  // explícitamente para que el rol saas_app pueda leerlas sin ambigüedad.
  for (const view of ANALYTICS_VIEWS) {
    pgm.sql(`GRANT SELECT ON ${view} TO saas_app`)
  }
}

export function down(pgm: MigrationBuilder): void {
  for (const view of ANALYTICS_VIEWS) {
    pgm.sql(`REVOKE ALL PRIVILEGES ON ${view} FROM saas_app`)
  }

  pgm.dropIndex('order_items', 'menu_item_id')
  pgm.dropIndex('orders', 'created_at')
  pgm.dropIndex('payments', 'received_at')

  pgm.dropView('v_table_occupancy', { ifExists: true })
  pgm.dropView('v_top_items', { ifExists: true })
  pgm.dropView('v_daily_sales', { ifExists: true })
}