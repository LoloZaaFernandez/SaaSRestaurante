import { afterAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { withTenant, type Queryable } from './shared/db.js'

const DATABASE_URL = 'postgres://saas_app:saas_app@localhost:5432/saas_restaurante'
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
  const body = res.json() as { token: string }
  expect(typeof body.token).toBe('string')
  return body.token
}

function authedHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
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

describe.runIf(dbReachable)('real db integration', () => {
  const fixturePool = new Pool({ connectionString: DATABASE_URL, max: 2 })
  let waiterEmail = ''
  const waiterPassword = 'demo123456'

  async function fixture<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
    return withTenant(fixturePool, SEED_TENANT_ID, fn)
  }

  afterAll(async () => {
    await fixturePool.end()
  })

  it('seeded admin can log in with tenant context', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { token: string; user: { email: string; role: string; tenantId: string } }
      expect(typeof body.token).toBe('string')
      expect(body.user).toMatchObject({ email: ADMIN_EMAIL, role: 'admin', tenantId: SEED_TENANT_ID })
    } finally {
      await app.close()
    }
  })

  it('login rejects unknown credentials with 401', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: ADMIN_EMAIL, password: 'wrong-password' },
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('register requires authentication', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: `anon-${randomUUID().slice(0, 8)}@test.local`,
          password: 'supersecret1',
          fullName: 'Anonymous',
          role: 'waiter',
        },
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('admin can create waiter/kitchen/cashier users in the tenant', async () => {
    const app = await buildApp()
    try {
      const token = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD)
      waiterEmail = `waiter-${randomUUID().slice(0, 8)}@test.local`

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: authedHeaders(token),
        payload: { email: waiterEmail, password: waiterPassword, fullName: 'Test Waiter', role: 'waiter' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json() as { user: { email: string; role: string; tenantId: string } }
      expect(body.user).toMatchObject({ email: waiterEmail, role: 'waiter', tenantId: SEED_TENANT_ID })
      expect(body.user.tenantId).toBe(SEED_TENANT_ID)
    } finally {
      await app.close()
    }
  })

  it('register rejects owner/admin roles', async () => {
    const app = await buildApp()
    try {
      const token = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD)
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: authedHeaders(token),
        payload: {
          email: `owner-${randomUUID().slice(0, 8)}@test.local`,
          password: 'supersecret1',
          fullName: 'Not Allowed',
          role: 'owner',
        },
      })
      expect(res.statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })

  it('non-owner/admin users cannot register other users', async () => {
    const app = await buildApp()
    try {
      const waiterToken = await login(app, waiterEmail, waiterPassword)
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: authedHeaders(waiterToken),
        payload: {
          email: `cashier-${randomUUID().slice(0, 8)}@test.local`,
          password: 'supersecret1',
          fullName: 'Cashier Try',
          role: 'cashier',
        },
      })
      expect(res.statusCode).toBe(403)
    } finally {
      await app.close()
    }
  })

  it('register with a duplicated email returns 409', async () => {
    const app = await buildApp()
    try {
      const token = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD)
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: authedHeaders(token),
        payload: { email: waiterEmail, password: 'supersecret1', fullName: 'Duplicate', role: 'kitchen' },
      })
      expect(res.statusCode).toBe(409)
    } finally {
      await app.close()
    }
  })

  it('menu → order → payment → invoice → void → kitchen full flow', async () => {
    const app = await buildApp()
    try {
      const token = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD)
      const headers = authedHeaders(token)

      const [branchId, tableId] = await fixture(async (client) => {
        const branch = await client.query<{ id: string }>(
          'SELECT id FROM branches WHERE tenant_id = $1 AND is_active = true ORDER BY name LIMIT 1',
          [SEED_TENANT_ID],
        )
        expect(branch.rows[0]).toBeDefined()
        const table = await client.query<{ id: string }>(
          'SELECT id FROM tables WHERE tenant_id = $1 AND status = $2 ORDER BY label LIMIT 1',
          [SEED_TENANT_ID, 'free'],
        )
        expect(table.rows[0]).toBeDefined()
        return [branch.rows[0]!.id, table.rows[0]!.id]
      })

      const menu = await app.inject({ method: 'GET', url: '/menu/items', headers })
      expect(menu.statusCode).toBe(200)
      const items = (menu.json() as { items: Array<{ id: string; name: string; price: string }> }).items
      expect(items.length).toBeGreaterThanOrEqual(10)
      const [itemA, itemB] = [items[0]!, items[1]!]

      const createOrder = await app.inject({
        method: 'POST',
        url: '/orders',
        headers,
        payload: { branchId, tableId, items: [{ menuItemId: itemA.id, quantity: 1, modifiers: [] }] },
      })
      expect(createOrder.statusCode).toBe(201)
      const order = (createOrder.json() as { order: { id: string; status: string; kitchenStatus: string; subtotal: string; total: string } })
        .order
      expect(order.status).toBe('open')
      expect(order.kitchenStatus).toBe('pending')
      expect(order.subtotal).toBe(itemA.price)

      const addItem = await app.inject({
        method: 'POST',
        url: `/orders/${order.id}/items`,
        headers,
        payload: { menuItemId: itemB.id, quantity: 1, modifiers: [] },
      })
      expect(addItem.statusCode).toBe(201)
      const orderAfterAdd = (addItem.json() as { order: { total: string; items: unknown[] } }).order
      expect(orderAfterAdd.items).toHaveLength(2)

      const pay = await app.inject({
        method: 'POST',
        url: `/orders/${order.id}/payments`,
        headers,
        payload: { method: 'yape', amount: orderAfterAdd.total, amountReceived: orderAfterAdd.total },
      })
      expect(pay.statusCode).toBe(201)
      const { payment, order: paidOrder } = pay.json() as {
        payment: { method: string; amount: string; change: string }
        order: { status: string }
      }
      expect(payment).toMatchObject({ method: 'yape', amount: orderAfterAdd.total, change: '0.00' })
      expect(paidOrder.status).toBe('paid')

      const invoiceRes = await app.inject({
        method: 'POST',
        url: '/invoices',
        headers,
        payload: {
          orderId: order.id,
          comprobanteType: 'boleta',
          customerDoc: 'dni',
          customerDocNumber: '20304050607',
          customerName: 'Cliente Prueba',
        },
      })
      expect(invoiceRes.statusCode).toBe(201)
      const invoice = invoiceRes.json().invoice as {
        id: string
        serie: string
        numero: number
        status: string
        total: string
      }
      expect(invoice.serie).toBe('B001')
      expect(invoice.numero).toBeGreaterThanOrEqual(1)
      expect(invoice.status).toBe('emitted')
      expect(invoice.total).toBe(orderAfterAdd.total)

      const voidRes = await app.inject({
        method: 'POST',
        url: `/invoices/${invoice.id}/void`,
        headers,
        payload: { voidedReason: 'test' },
      })
      expect(voidRes.statusCode).toBe(200)
      expect((voidRes.json() as { invoice: { status: string } }).invoice.status).toBe('voided')

      // paid orders reject kitchen transitions, so use a fresh open order
      const kdsOrderRes = await app.inject({
        method: 'POST',
        url: '/orders',
        headers,
        payload: { branchId, items: [{ menuItemId: itemA.id, quantity: 1, modifiers: [] }] },
      })
      expect(kdsOrderRes.statusCode).toBe(201)
      const kdsOrderId = (kdsOrderRes.json() as { order: { id: string } }).order.id

      const kdsList = await app.inject({ method: 'GET', url: '/kds/orders', headers })
      expect(kdsList.statusCode).toBe(200)
      const queue = (kdsList.json() as { orders: Array<{ id: string }> }).orders
      expect(queue.map((o) => o.id)).toContain(kdsOrderId)
      expect(queue.map((o) => o.id)).not.toContain(order.id)

      for (const status of ['preparing', 'ready', 'served']) {
        const transition = await app.inject({
          method: 'POST',
          url: `/kds/orders/${kdsOrderId}/status`,
          headers,
          payload: { status },
        })
        expect(transition.statusCode).toBe(200)
        expect((transition.json() as { order: { kitchenStatus: string } }).order.kitchenStatus).toBe(status)
      }

      const invalidJump = await app.inject({
        method: 'POST',
        url: `/kds/orders/${kdsOrderId}/status`,
        headers,
        payload: { status: 'preparing' },
      })
      expect(invalidJump.statusCode).toBe(409)
    } finally {
      await app.close()
    }
  })
})