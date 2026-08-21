import type { MigrationBuilder } from 'node-pg-migrate'

// Analytics module: aggregation views + supporting indexes.
//
// Las vistas se crean con `security_invoker = true` para que la consulta se
// ejecute con los permisos del rol que la invoca (saas_app) y NO con los del
// owner (saas). De ese modo el RLS (FORCE ROW LEVEL SECURITY) de las tablas
// base sigue filtrando por `get_tenant_id()` y el aislamiento entre tenants
// se mantiene, igual que con las tablas.
//
// Los días se agregan en UTC: `(ts AT TIME ZONE 'UTC')::date`. Es una decisión
// deliberada (ver docs/modules/analytics.md) para que el bucketing sea
// determinístico e independiente de la zona horaria del server.

const VIEWS = {
  v_ventas_diarias: `
    CREATE VIEW v_ventas_diarias WITH (security_invoker = true) AS
    SELECT
      tenant_id,
      (received_at AT TIME ZONE 'UTC')::date AS dia,
      SUM(amount) AS total_ventas,
      SUM(tip) AS total_propinas,
      COUNT(DISTINCT order_id) AS cantidad_pedidos,
      COUNT(*) AS cantidad_pagos
    FROM payments
    GROUP BY tenant_id, (received_at AT TIME ZONE 'UTC')::date
  `,
  v_top_items: `
    CREATE VIEW v_top_items WITH (security_invoker = true) AS
    SELECT
      o.tenant_id,
      (o.opened_at AT TIME ZONE 'UTC')::date AS dia,
      oi.name,
      SUM(oi.quantity) AS cantidad,
      SUM(oi.line_total) AS ingresos
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
    WHERE o.status <> 'cancelled'
    GROUP BY o.tenant_id, (o.opened_at AT TIME ZONE 'UTC')::date, oi.name
  `,
  v_ocupacion_mesas: `
    CREATE VIEW v_ocupacion_mesas WITH (security_invoker = true) AS
    SELECT
      tenant_id,
      branch_id,
      status,
      COUNT(*) AS cantidad_mesas
    FROM tables
    GROUP BY tenant_id, branch_id, status
  `,
}

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS payments_received_at_idx ON payments (received_at);
    CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);
  `)

  for (const [name, sql] of Object.entries(VIEWS)) {
    pgm.sql(sql)
    pgm.sql(`GRANT SELECT ON ${name} TO saas_app;`)
  }
}

export function down(pgm: MigrationBuilder): void {
  for (const name of Object.keys(VIEWS)) {
    pgm.sql(`DROP VIEW IF EXISTS ${name};`)
  }

  pgm.sql(`
    DROP INDEX IF EXISTS payments_received_at_idx;
    DROP INDEX IF EXISTS orders_created_at_idx;
  `)
}