import { afterAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { withTenant, type Queryable } from './shared/db.js'

const DATABASE_URL = 'postgres://saas_app:saas_app@localhost:5433/saas_restaurante'
process.env.DATABASE_URL = DATABASE_URL
process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const { buildApp } = await import('./app.js')

const SEED_TENANT_ID = '11111111-1111-1111-1111-111111111111'
const ADMIN_EMAIL = 'admin@demo-restaurante.com'
const ADMIN_PASSWORD = 'demo1234'

type App = Awaited<ReturnType<typeof buildApp>>

async function login(app: App, email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  })
  expect(res.statusCode).toBe(200)
  return (res.json() as { token: string }).token
}

function authedHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

async function probeDb(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 1500, max: 1 })
  try {
    const client = await pool.connect()
    try {
      await client.query('SELECT 1')
    } finally {
      client.release()
    }
    return true
  } catch {
    return false
  } finally {
    await pool.end()
  }
}

const dbReachable = await probeDb()

describe.runIf(dbReachable)('analytics module', () => {
  const fixturePool = new Pool({ connectionString: DATABASE_URL, max: 2 })

  async function fixture<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
    return withTenant(fixturePool, SEED_TENANT_ID, fn)
  }

  afterAll(async () => {
    await fixturePool.end()
  })

  async function seedOrderAndPayment(app: App, token: string): Promise<{ total: string; itemName: string }> {
    const headers = authedHeaders(token)
    const [branchId, tableId] = await fixture(async (client) => {
      const branch = await client.query<{ id: string }>(
        'SELECT id FROM branches WHERE tenant_id = $1 AND is_active = true ORDER BY name LIMIT 1',
        [SEED_TENANT_ID],
      )
      const table = await client.query<{ id: string }>(
        'SELECT id FROM tables WHERE tenant_id = $1 AND status = $2 ORDER BY label LIMIT 1',
        [SEED_TENANT_ID, 'free'],
      )
      return [branch.rows[0]!.id, table.rows[0]!.id]
    })

    const menu = await app.inject({ method: 'GET', url: '/menu/items', headers })
    const items = (menu.json() as { items: Array<{ id: string; name: string; price: string }> }).items
    const item = items[0]!

    const created = await app.inject({
      method: 'POST',
      url: '/orders',
      headers,
      payload: { branchId, tableId, items: [{ menuItemId: item.id, quantity: 1, modifiers: [] }] },
    })
    const order = (created.json() as { order: { id: string; total: string } }).order

    const paid = await app.inject({
      method: 'POST',
      url: `/orders/${order.id}/payments`,
      headers,
      payload: { method: 'cash', amount: order.total, amountReceived: order.total },
    })
    expect(paid.statusCode).toBe(201)

    return { total: order.total, itemName: item.name }
  }

  it('requires authentication', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/analytics/dashboard' })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('rejects an inverted date range on report', async () => {
    const app = await buildApp()
    try {
      const token = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD)
      const res = await app.inject({
        method: 'GET',
        url: '/analytics/report?from=2026-08-20&to=2026-08-01',
        headers: authedHeaders(token),
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ code: 'INVALID_RANGE' })
    } finally {
      await app.close()
    }
  })

  it('dashboard reflects payments, open orders and table occupancy', async () => {
    const app = await buildApp()
    try {
      const token = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD)
      const headers = authedHeaders(token)

      const before = (await app.inject({ method: 'GET', url: '/analytics/dashboard', headers })).json() as {
        metrics: { salesToday: string; averageTicket: string; openOrders: number; ordersToday: number }
        tables: never
        topItems: Array<{ name: string; quantity: number; revenue: string }>
      }

      const { total, itemName } = await seedOrderAndPayment(app, token)

      const res = await app.inject({ method: 'GET', url: '/analytics/dashboard', headers })
      expect(res.statusCode).toBe(200)
      const dash = res.json() as {
        period: { from: string; to: string }
        metrics: {
          salesToday: string
          ordersToday: number
          averageTicket: string
          openOrders: number
          tables: { total: number; occupied: number; free: number; reserved: number; cleaning: number }
        }
        topItems: Array<{ name: string; quantity: number; revenue: string }>
      }

      expect(dash.period.from).toBe(dash.period.to)
      expect(dash.metrics.salesToday).toMatch(/^\d+(\.\d{1,2})?$/)
      expect(Number(dash.metrics.salesToday)).toBeGreaterThanOrEqual(Number(before.metrics.salesToday) + Number(total))
      expect(dash.metrics.ordersToday).toBeGreaterThanOrEqual(before.metrics.ordersToday)
      expect(dash.metrics.tables.total).toBeGreaterThanOrEqual(8)
      expect(dash.metrics.tables.free).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(dash.topItems)).toBe(true)
      expect(dash.topItems.some((item) => item.name === itemName)).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('report fills gaps for every day and hour in the range', async () => {
    const app = await buildApp()
    try {
      const token = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD)
      const headers = authedHeaders(token)

      const today = new Date().toISOString().slice(0, 10)
      const res = await app.inject({
        method: 'GET',
        url: '/analytics/report',
        headers,
      })
      expect(res.statusCode).toBe(200)
      const report = res.json() as {
        period: { from: string; to: string }
        dailySales: Array<{ date: string; sales: string; orders: number; payments: number }>
        topItems: Array<{ name: string; quantity: number; revenue: string }>
        salesByHour: Array<{ hour: number; sales: string; orders: number }>
        totals: { sales: string; orders: number; averageTicket: string }
      }

      expect(report.period.to).toBe(today)
      expect(report.dailySales).toHaveLength(7)
      expect(report.dailySales.at(-1)?.date).toBe(today)
      expect(report.salesByHour).toHaveLength(24)
      expect(report.salesByHour[0]).toEqual({ hour: 0, sales: '0.00', orders: 0 })
      expect(Number(report.totals.averageTicket)).toBeGreaterThanOrEqual(0)
      expect(report.totals.sales).toMatch(/^\d+(\.\d{1,2})?$/)

      const scoped = await app.inject({
        method: 'GET',
        url: `/analytics/report?from=${today}&to=${today}`,
        headers,
      })
      const scopedBody = scoped.json() as { dailySales: Array<{ date: string }> }
      expect(scoped.statusCode).toBe(200)
      expect(scopedBody.dailySales).toHaveLength(1)
      expect(scopedBody.dailySales[0]!.date).toBe(today)
    } finally {
      await app.close()
    }
  })
})