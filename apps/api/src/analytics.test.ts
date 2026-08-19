import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

// Punto a PostgreSQL de docker-compose (host: 5433), no al servicio nativo de Windows (5432).
process.env.DATABASE_URL = 'postgres://saas:saas@localhost:5433/saas_restaurante'
process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const { buildApp } = await import('./app.js')

const TENANT_ID = '11111111-1111-1111-1111-111111111111'
const ADMIN_EMAIL = 'admin@demo-restaurante.com'
const ADMIN_PASSWORD = 'admin123'
const APP_TIMEZONE = 'America/Argentina/Buenos_Aires'
const ITEM_NAME = 'Item Analytics Test'

type App = Awaited<ReturnType<typeof buildApp>>
type Dashboard = {
  date: string
  totals: { salesToday: string; ordersToday: number; paidOrders: number; avgTicket: string }
  activeOrders: number
  occupancy: { total: number; free: number; occupied: number; reserved: number; cleaning: number }
  topItems: { menuItemId: string | null; name: string; quantitySold: number; revenue: string }[]
}

const toNumber = (money: string): number => Number(money)

let app: App
let db: Pool
let token: string
let baseline: Dashboard

// Fixtures insertados por el test (ids propios para no tocar los datos del seed/demo).
let branchId: string
let userId: string
let categoryId: string
let menuItemId: string
let tableId: string
let orderId: string

async function login(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  expect(res.statusCode).toBe(200)
  return (res.json() as { token: string }).token
}

async function getDashboard(auth?: string): Promise<Dashboard> {
  const res = await app.inject({
    method: 'GET',
    url: '/analytics/dashboard',
    headers: auth ? { authorization: `Bearer ${auth}` } : undefined,
  })
  expect(res.statusCode).toBe(200)
  return res.json() as Dashboard
}

beforeAll(async () => {
  app = await buildApp()
  token = await login()

  // Baseline real (si el tenant demo ya tenía operaciones, el test valida deltas, no absolutos).
  baseline = await getDashboard(token)

  db = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL TIME ZONE '${APP_TIMEZONE}'`)
    await client.query('SELECT set_app_tenant($1)', [TENANT_ID])

    await client.query(
      `INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $3, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_ID, 'Restaurante Demo', 'demo-restaurante'],
    )

    branchId = randomUUID()
    await client.query(
      `INSERT INTO branches (id, tenant_id, name, address, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [branchId, TENANT_ID, 'Sucursal Test', 'Av. Test 123', '5555-5555'],
    )

    userId = randomUUID()
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, active)
       VALUES ($1, $2, $3, $4, $5, 'admin', true)`,
      [userId, TENANT_ID, `analytics-${userId}@test.com`, 'test-hash', 'User Analytics Test'],
    )

    categoryId = randomUUID()
    await client.query(
      `INSERT INTO menu_categories (id, tenant_id, name, position) VALUES ($1, $2, $3, 0)`,
      [categoryId, TENANT_ID, 'Categoría Test'],
    )

    menuItemId = randomUUID()
    await client.query(
      `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, '12.50', true, 0)`,
      [menuItemId, TENANT_ID, categoryId, ITEM_NAME, null],
    )

    // Mesa ocupada para mover el KPI de ocupación.
    tableId = randomUUID()
    await client.query(
      `INSERT INTO tables (id, tenant_id, branch_id, label, seats, status)
       VALUES ($1, $2, $3, $4, 4, 'occupied')`,
      [tableId, TENANT_ID, branchId, 'T-ANA'],
    )

    // Pedido pagado: status 'paid' + un payment → alimenta v_daily_sales y v_top_items.
    orderId = randomUUID()
    await client.query(
      `INSERT INTO orders (id, tenant_id, branch_id, table_id, status, created_by, opened_at, closed_at)
       VALUES ($1, $2, $3, $4, 'paid', $5, now(), now())`,
      [orderId, TENANT_ID, branchId, tableId, userId],
    )
    await client.query(
      `INSERT INTO order_items (id, tenant_id, order_id, menu_item_id, name, unit_price, quantity, line_total, modifiers)
       VALUES ($1, $2, $3, $4, $5, '12.50', 2, '25.00', '[]'::jsonb)`,
      [randomUUID(), TENANT_ID, orderId, menuItemId, ITEM_NAME],
    )
    await client.query(
      `INSERT INTO payments (id, tenant_id, order_id, method, amount, tip, received_at)
       VALUES ($1, $2, $3, 'cash', '25.00', '0.00', now())`,
      [randomUUID(), TENANT_ID, orderId],
    )

    await client.query('COMMIT')
  } finally {
    client.release()
  }
})

afterAll(async () => {
  if (db) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT set_app_tenant($1)', [TENANT_ID])
      // Borrado inverso por FKs; no se toca el tenant 11111111 (tiene datos del seed).
      await client.query('DELETE FROM payments WHERE order_id = $1', [orderId])
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId])
      await client.query('DELETE FROM orders WHERE id = $1', [orderId])
      await client.query('DELETE FROM tables WHERE id = $1', [tableId])
      await client.query('DELETE FROM menu_items WHERE id = $1', [menuItemId])
      await client.query('DELETE FROM menu_categories WHERE id = $1', [categoryId])
      await client.query('DELETE FROM users WHERE id = $1', [userId])
      await client.query('DELETE FROM branches WHERE id = $1', [branchId])
      await client.query('COMMIT')
    } finally {
      client.release()
    }
  }
  await db?.end()
  await app?.close()
})

describe('GET /analytics/dashboard', () => {
  it('devuelve 401 sin token', async () => {
    const res = await app.inject({ method: 'GET', url: '/analytics/dashboard' })
    expect(res.statusCode).toBe(401)
  })

  it('refleja las ventas, pedidos y ocupación del día (fixtures)', async () => {
    const dash = await getDashboard(token)

    expect(dash.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(toNumber(dash.totals.salesToday)).toBeCloseTo(toNumber(baseline.totals.salesToday) + 25, 2)
    expect(dash.totals.paidOrders).toBe(baseline.totals.paidOrders + 1)
    expect(dash.totals.ordersToday).toBe(baseline.totals.ordersToday + 1)
    expect(toNumber(dash.totals.avgTicket)).toBeCloseTo(
      (toNumber(baseline.totals.salesToday) + 25) / (baseline.totals.paidOrders + 1),
      2,
    )
    // El pedido insertado es 'paid', no 'open': los pedidos activos no cambian.
    expect(dash.activeOrders).toBe(baseline.activeOrders)
    // Una mesa nueva en estado 'occupied'.
    expect(dash.occupancy.total).toBe(baseline.occupancy.total + 1)
    expect(dash.occupancy.occupied).toBe(baseline.occupancy.occupied + 1)
    // El ítem del fixture debe aparecer en el top 5 del día con su ingreso.
    const item = dash.topItems.find((top) => top.name === ITEM_NAME)
    expect(item).toBeDefined()
    expect(item?.revenue).toBe('25.00')
    expect(item?.quantitySold).toBe(2)
  })
})

describe('GET /analytics/report', () => {
  it('devuelve 401 sin token', async () => {
    const res = await app.inject({ method: 'GET', url: '/analytics/report' })
    expect(res.statusCode).toBe(401)
  })

  it('rechaza un rango inválido con 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/report?range=anio',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('range=today devuelve el día actual con el fixture', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/report?range=today',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const report = res.json()

    expect(report.range).toBe('today')
    expect(report.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(report.to).toBe(report.from)
    expect(toNumber(report.totals.totalSales)).toBeGreaterThanOrEqual(25)
    expect(report.totals.totalOrders).toBeGreaterThanOrEqual(1)
    // El reporte rellena series completas: 1 día, 7 días de semana, 24 horas.
    expect(report.salesByDay).toHaveLength(1)
    expect(report.salesByWeekday).toHaveLength(7)
    expect(report.peakHours).toHaveLength(24)
    expect(report.topItems.some((i: { name: string }) => i.name === ITEM_NAME)).toBe(true)
  })

  it('range=week y range=month mantienen la forma de la respuesta', async () => {
    for (const range of ['week', 'month'] as const) {
      const res = await app.inject({
        method: 'GET',
        url: `/analytics/report?range=${range}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const report = res.json()
      expect(report.range).toBe(range)
      expect(report.salesByWeekday).toHaveLength(7)
      expect(report.peakHours).toHaveLength(24)
      expect(report.salesByDay.length).toBeGreaterThanOrEqual(1)
      expect(report.salesByDay.length).toBeLessThanOrEqual(31)
      expect(toNumber(report.totals.totalSales)).toBeGreaterThanOrEqual(25)
    }
  })
})

describe('Views de agregación (migración 12)', () => {
  it('v_daily_sales y v_top_items reflejan el payment del fixture', async () => {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL TIME ZONE '${APP_TIMEZONE}'`)
      await client.query('SELECT set_app_tenant($1)', [TENANT_ID])

      const daily = await client.query<{ total_sales: string; paid_orders: string }>(
        `SELECT total_sales, paid_orders FROM v_daily_sales
         WHERE tenant_id = $1 AND day = CURRENT_DATE`,
        [TENANT_ID],
      )
      expect(daily.rows.length).toBeGreaterThanOrEqual(1)
      expect(Number(daily.rows[0]!.total_sales)).toBeGreaterThanOrEqual(25)
      expect(Number(daily.rows[0]!.paid_orders)).toBeGreaterThanOrEqual(1)

      const top = await client.query<{ item_name: string; revenue: string; quantity_sold: number }>(
        `SELECT item_name, revenue, quantity_sold FROM v_top_items
         WHERE tenant_id = $1 AND day = CURRENT_DATE AND item_name = $2`,
        [TENANT_ID, ITEM_NAME],
      )
      expect(top.rows[0]?.revenue).toBe('25.00')
      expect(top.rows[0]?.quantity_sold).toBe(2)

      const occupancy = await client.query<{ status: string; table_count: number }>(
        `SELECT status, table_count FROM v_table_occupancy
         WHERE tenant_id = $1`,
        [TENANT_ID],
      )
      const occupied = occupancy.rows.find((row) => row.status === 'occupied')
      expect(occupied).toBeDefined()
      expect(occupied!.table_count).toBeGreaterThanOrEqual(1)

      await client.query('COMMIT')
    } finally {
      client.release()
    }
  })
})