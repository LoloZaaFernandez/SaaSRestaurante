import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { withTenant, type Queryable } from './shared/db.js'

const DATABASE_URL = 'postgres://saas_app:saas_app@localhost:5433/saas_restaurante'
process.env.DATABASE_URL = DATABASE_URL
process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const { buildApp } = await import('./app.js')

const TENANT_ID = '11111111-1111-1111-1111-111111111111'
const ADMIN_EMAIL = 'admin@demo-restaurante.com'
const ADMIN_PASSWORD = 'demo1234'

type App = Awaited<ReturnType<typeof buildApp>>

interface ApiOrder {
  id: string
  branchId: string
  tableId: string | null
  waiterId: string | null
  createdBy: string
  status: string
  subtotal: string
  tax: string
  total: string
  items: Array<{
    menuItemId: string | null
    name: string
    unitPrice: string
    quantity: number
    lineTotal: string
    notes: string | null
    modifiers: Array<{ modifierId: string; name: string; priceAdjustment: string }>
  }>
}

async function probeDb(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 1500, max: 1 })
  try {
    const client = await pool.connect()
    client.release()
    return true
  } catch {
    return false
  } finally {
    await pool.end()
  }
}

const dbReachable = await probeDb()

describe.runIf(dbReachable)('order taking: modifiers, notes, waiter, tables', () => {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 })
  let app: App
  let headers: Record<string, string>
  let adminId = ''
  let waiterId = ''
  let branchId = ''
  let otherBranchId = ''
  let tableId = ''
  let otherBranchTableId = ''
  let burgerId = '' // Extras (optional, max 3) assigned
  let steakId = '' // "Punto de la carne" (required, 1..1) assigned
  let plainId = '' // no modifier groups
  let inactiveId = ''
  let extras: Array<{ id: string; name: string; priceAdjustment: string }> = []
  let doneness: Array<{ id: string; name: string }> = []
  const createdBranchIds: string[] = []
  const createdItemIds: string[] = []
  const createdUserIds: string[] = []

  function fixture<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
    return withTenant(pool, TENANT_ID, fn)
  }

  async function postOrder(payload: unknown) {
    return app.inject({ method: 'POST', url: '/orders', headers, payload })
  }

  beforeAll(async () => {
    app = await buildApp()
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    })
    const body = login.json() as { token: string; user: { id: string } }
    adminId = body.user.id
    headers = { authorization: `Bearer ${body.token}`, 'content-type': 'application/json' }

    const waiterEmail = `waiter-${randomUUID().slice(0, 8)}@test.local`
    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: { email: waiterEmail, password: 'supersecret1', fullName: 'Mesero de prueba', role: 'waiter' },
    })
    waiterId = (registered.json() as { user: { id: string } }).user.id
    createdUserIds.push(waiterId)

    const branches = await app.inject({ method: 'GET', url: '/branches', headers })
    branchId = (branches.json() as { branches: Array<{ id: string }> }).branches[0]!.id

    await fixture(async (client) => {
      const table = await client.query<{ id: string }>(
        'SELECT id FROM tables WHERE branch_id = $1 ORDER BY label LIMIT 1',
        [branchId],
      )
      tableId = table.rows[0]!.id

      const branch = await client.query<{ id: string }>(
        `INSERT INTO branches (tenant_id, name) VALUES ($1, $2) RETURNING id`,
        [TENANT_ID, `Sucursal test ${randomUUID().slice(0, 6)}`],
      )
      otherBranchId = branch.rows[0]!.id
      createdBranchIds.push(otherBranchId)
      const otherTable = await client.query<{ id: string }>(
        `INSERT INTO tables (tenant_id, branch_id, label, seats) VALUES ($1, $2, 'Mesa X', 2) RETURNING id`,
        [TENANT_ID, otherBranchId],
      )
      otherBranchTableId = otherTable.rows[0]!.id

      const byGroup = async (groupName: string) => {
        const r = await client.query<{ id: string }>(
          `SELECT mi.id FROM menu_items mi
           JOIN menu_item_modifiers mim ON mim.menu_item_id = mi.id
           JOIN modifier_groups g ON g.id = mim.modifier_group_id
           WHERE g.name = $1 AND mi.active = true LIMIT 1`,
          [groupName],
        )
        return r.rows[0]!.id
      }
      burgerId = await byGroup('Extras')
      steakId = await byGroup('Punto de la carne')

      const plain = await client.query<{ id: string }>(
        `SELECT id FROM menu_items WHERE active = true
           AND id NOT IN (SELECT menu_item_id FROM menu_item_modifiers) LIMIT 1`,
      )
      plainId = plain.rows[0]!.id

      const category = await client.query<{ id: string }>('SELECT id FROM menu_categories LIMIT 1')
      const inactive = await client.query<{ id: string }>(
        `INSERT INTO menu_items (tenant_id, category_id, name, price, active)
         VALUES ($1, $2, 'Plato inactivo test', '5.00', false) RETURNING id`,
        [TENANT_ID, category.rows[0]!.id],
      )
      inactiveId = inactive.rows[0]!.id
      createdItemIds.push(inactiveId)
    })

    const catalog = await app.inject({ method: 'GET', url: '/menu/modifier-catalog', headers })
    const groups = (
      catalog.json() as {
        groups: Array<{
          name: string
          modifiers: Array<{ id: string; name: string; priceAdjustment: string }>
        }>
      }
    ).groups
    extras = groups.find((g) => g.name === 'Extras')!.modifiers
    doneness = groups.find((g) => g.name === 'Punto de la carne')!.modifiers
  })

  afterAll(async () => {
    await fixture(async (client) => {
      // users referenced by orders cannot be deleted; deactivate them so they stay out of staff lists
      await client.query('UPDATE users SET active = false WHERE id = ANY($1::uuid[])', [createdUserIds])
      for (const id of createdItemIds) {
        await client.query('DELETE FROM order_items WHERE menu_item_id = $1', [id])
        await client.query('DELETE FROM menu_items WHERE id = $1', [id])
      }
      for (const id of createdBranchIds) {
        await client.query('DELETE FROM tables WHERE branch_id = $1', [id])
        await client.query('DELETE FROM branches WHERE id = $1', [id])
      }
    })
    await pool.end()
    await app.close()
  })

  it('lists active branches and tables of a branch', async () => {
    const branches = await app.inject({ method: 'GET', url: '/branches', headers })
    expect(branches.statusCode).toBe(200)
    expect((branches.json() as { branches: unknown[] }).branches.length).toBeGreaterThan(0)

    const tables = await app.inject({ method: 'GET', url: `/tables?branchId=${branchId}`, headers })
    expect(tables.statusCode).toBe(200)
    const list = (tables.json() as { tables: Array<{ branchId: string; label: string }> }).tables
    expect(list.length).toBeGreaterThanOrEqual(8)
    expect(list.every((t) => t.branchId === branchId)).toBe(true)
    // natural ordering: Mesa 2 before Mesa 10
    const labels = list.map((t) => t.label)
    expect(labels.indexOf('Mesa 2')).toBeLessThan(labels.indexOf('Mesa 10') === -1 ? 999 : labels.indexOf('Mesa 10'))
  })

  it('tables, branches, users and the modifier catalog require authentication', async () => {
    for (const url of ['/branches', '/tables', '/users', '/menu/modifier-catalog']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).toBe(401)
    }
  })

  it('exposes the modifier catalog with options, limits and item assignments', async () => {
    const res = await app.inject({ method: 'GET', url: '/menu/modifier-catalog', headers })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      groups: Array<{ id: string; name: string; required: boolean; min: number; max: number; modifiers: unknown[] }>
      itemGroups: Record<string, string[]>
    }
    const punto = body.groups.find((g) => g.name === 'Punto de la carne')!
    expect(punto).toMatchObject({ required: true, min: 1, max: 1 })
    expect(punto.modifiers).toHaveLength(3)
    expect(body.itemGroups[steakId]).toContain(punto.id)
    expect(body.itemGroups[plainId]).toBeUndefined()
  })

  it('lists active waiters without exposing emails or hashes', async () => {
    const res = await app.inject({ method: 'GET', url: '/users?role=waiter', headers })
    expect(res.statusCode).toBe(200)
    const users = (res.json() as { users: Array<Record<string, unknown>> }).users
    expect(users.some((u) => u.id === waiterId)).toBe(true)
    expect(users.every((u) => u.role === 'waiter')).toBe(true)
    expect(users.every((u) => !('email' in u) && !('passwordHash' in u))).toBe(true)
  })

  it('creates an order with modifiers, notes and a chosen waiter; totals include 18% IGV', async () => {
    const [queso, bacon] = extras
    const res = await postOrder({
      branchId,
      tableId,
      waiterId,
      items: [
        { menuItemId: burgerId, quantity: 2, modifiers: [queso!.id, bacon!.id], notes: '  sin cebolla  ' },
        { menuItemId: plainId, quantity: 1, modifiers: [] },
      ],
    })
    expect(res.statusCode).toBe(201)
    const { order } = res.json() as { order: ApiOrder }

    expect(order.waiterId).toBe(waiterId)
    expect(order.createdBy).toBe(adminId)
    expect(order.tableId).toBe(tableId)

    const burger = order.items.find((i) => i.menuItemId === burgerId)!
    expect(burger.notes).toBe('sin cebolla')
    expect(burger.modifiers.map((m) => m.name)).toEqual([queso!.name, bacon!.name])
    const adjustment = Number(queso!.priceAdjustment) + Number(bacon!.priceAdjustment)
    const base = await fixture((c) =>
      c.query<{ price: string }>('SELECT price FROM menu_items WHERE id = $1', [burgerId]),
    )
    const expectedUnit = Math.round((Number(base.rows[0]!.price) + adjustment) * 100) / 100
    expect(Number(burger.unitPrice)).toBeCloseTo(expectedUnit, 2)
    expect(Number(burger.lineTotal)).toBeCloseTo(expectedUnit * 2, 2)

    const plain = order.items.find((i) => i.menuItemId === plainId)!
    expect(plain.notes).toBeNull()

    const subtotalCents = order.items.reduce((acc, i) => acc + Math.round(Number(i.lineTotal) * 100), 0)
    expect(Math.round(Number(order.subtotal) * 100)).toBe(subtotalCents)
    expect(Math.round(Number(order.tax) * 100)).toBe(Math.round(subtotalCents * 0.18))
    expect(Math.round(Number(order.total) * 100)).toBe(subtotalCents + Math.round(subtotalCents * 0.18))

    // persisted: reading it back returns the same snapshots and notes
    const again = await app.inject({ method: 'GET', url: `/orders/${order.id}`, headers })
    const stored = (again.json() as { order: ApiOrder }).order
    expect(stored.items.find((i) => i.menuItemId === burgerId)).toMatchObject({
      notes: 'sin cebolla',
      unitPrice: burger.unitPrice,
    })
    expect(stored.total).toBe(order.total)
  })

  it('defaults the waiter to the user creating the order', async () => {
    const res = await postOrder({ branchId, items: [{ menuItemId: plainId, quantity: 1 }] })
    expect(res.statusCode).toBe(201)
    expect((res.json() as { order: ApiOrder }).order.waiterId).toBe(adminId)
  })

  it('enforces required groups and min/max limits', async () => {
    const missing = await postOrder({ branchId, items: [{ menuItemId: steakId, quantity: 1, modifiers: [] }] })
    expect(missing.statusCode).toBe(400)
    expect((missing.json() as { code: string }).code).toBe('MODIFIER_GROUP_MIN')

    const tooMany = await postOrder({
      branchId,
      items: [{ menuItemId: steakId, quantity: 1, modifiers: [doneness[0]!.id, doneness[1]!.id] }],
    })
    expect(tooMany.statusCode).toBe(400)
    expect((tooMany.json() as { code: string }).code).toBe('MODIFIER_GROUP_MAX')

    const ok = await postOrder({
      branchId,
      items: [{ menuItemId: steakId, quantity: 1, modifiers: [doneness[1]!.id] }],
    })
    expect(ok.statusCode).toBe(201)
  })

  it('rejects modifiers that do not belong to the item and duplicates', async () => {
    const foreign = await postOrder({
      branchId,
      items: [{ menuItemId: plainId, quantity: 1, modifiers: [extras[0]!.id] }],
    })
    expect(foreign.statusCode).toBe(400)
    expect((foreign.json() as { code: string }).code).toBe('MODIFIER_NOT_ALLOWED')

    const duplicated = await postOrder({
      branchId,
      items: [{ menuItemId: burgerId, quantity: 1, modifiers: [extras[0]!.id, extras[0]!.id] }],
    })
    expect(duplicated.statusCode).toBe(400)
    expect((duplicated.json() as { code: string }).code).toBe('DUPLICATE_MODIFIER')

    const unknown = await postOrder({
      branchId,
      items: [{ menuItemId: burgerId, quantity: 1, modifiers: [randomUUID()] }],
    })
    expect(unknown.statusCode).toBe(404)
  })

  it('rejects inactive menu items, over-long notes and invalid quantities', async () => {
    const inactive = await postOrder({ branchId, items: [{ menuItemId: inactiveId, quantity: 1 }] })
    expect(inactive.statusCode).toBe(409)
    expect((inactive.json() as { code: string }).code).toBe('MENU_ITEM_UNAVAILABLE')

    const longNote = await postOrder({
      branchId,
      items: [{ menuItemId: plainId, quantity: 1, notes: 'x'.repeat(201) }],
    })
    expect(longNote.statusCode).toBe(400)

    const zero = await postOrder({ branchId, items: [{ menuItemId: plainId, quantity: 0 }] })
    expect(zero.statusCode).toBe(400)
  })

  it('treats blank notes as no notes', async () => {
    const res = await postOrder({ branchId, items: [{ menuItemId: plainId, quantity: 1, notes: '   ' }] })
    expect(res.statusCode).toBe(201)
    expect((res.json() as { order: ApiOrder }).order.items[0]!.notes).toBeNull()
  })

  it('validates the waiter: must exist in the tenant, be active and have the waiter role', async () => {
    const unknown = await postOrder({
      branchId,
      waiterId: randomUUID(),
      items: [{ menuItemId: plainId, quantity: 1 }],
    })
    expect(unknown.statusCode).toBe(404)
    expect((unknown.json() as { code: string }).code).toBe('WAITER_NOT_FOUND')

    // a user that exists in the tenant but is not a waiter is rejected
    const kitchen = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: {
        email: `kitchen-${randomUUID().slice(0, 8)}@test.local`,
        password: 'supersecret1',
        fullName: 'Cocina prueba',
        role: 'kitchen',
      },
    })
    const kitchenId = (kitchen.json() as { user: { id: string } }).user.id
    createdUserIds.push(kitchenId)
    const notWaiter = await postOrder({
      branchId,
      waiterId: kitchenId,
      items: [{ menuItemId: plainId, quantity: 1 }],
    })
    expect(notWaiter.statusCode).toBe(400)
    expect((notWaiter.json() as { code: string }).code).toBe('INVALID_WAITER')

    await fixture((c) => c.query('UPDATE users SET active = false WHERE id = $1', [waiterId]))
    try {
      const inactive = await postOrder({
        branchId,
        waiterId,
        items: [{ menuItemId: plainId, quantity: 1 }],
      })
      expect(inactive.statusCode).toBe(400)
      expect((inactive.json() as { code: string }).code).toBe('INVALID_WAITER')
    } finally {
      await fixture((c) => c.query('UPDATE users SET active = true WHERE id = $1', [waiterId]))
    }
  })

  it('validates branch and table consistency', async () => {
    const mismatch = await postOrder({
      branchId,
      tableId: otherBranchTableId,
      items: [{ menuItemId: plainId, quantity: 1 }],
    })
    expect(mismatch.statusCode).toBe(400)
    expect((mismatch.json() as { code: string }).code).toBe('TABLE_BRANCH_MISMATCH')

    const noBranch = await postOrder({ branchId: randomUUID(), items: [{ menuItemId: plainId, quantity: 1 }] })
    expect(noBranch.statusCode).toBe(404)

    await fixture((c) => c.query('UPDATE branches SET is_active = false WHERE id = $1', [otherBranchId]))
    const inactiveBranch = await postOrder({
      branchId: otherBranchId,
      items: [{ menuItemId: plainId, quantity: 1 }],
    })
    expect(inactiveBranch.statusCode).toBe(409)
    expect((inactiveBranch.json() as { code: string }).code).toBe('BRANCH_INACTIVE')
  })

  it('filters order history by status; cancelled orders only appear when requested', async () => {
    const created = await postOrder({ branchId, items: [{ menuItemId: plainId, quantity: 1 }] })
    const id = (created.json() as { order: ApiOrder }).order.id

    const open = await app.inject({ method: 'GET', url: `/orders?status=open&branchId=${branchId}`, headers })
    expect((open.json() as { orders: ApiOrder[] }).orders.some((o) => o.id === id)).toBe(true)

    const cancel = await app.inject({
      method: 'PATCH',
      url: `/orders/${id}/status`,
      headers,
      payload: { status: 'cancelled' },
    })
    expect(cancel.statusCode).toBe(200)

    const defaultList = await app.inject({ method: 'GET', url: '/orders', headers })
    expect((defaultList.json() as { orders: ApiOrder[] }).orders.some((o) => o.id === id)).toBe(false)

    const cancelled = await app.inject({ method: 'GET', url: '/orders?status=cancelled&limit=200', headers })
    const cancelledOrders = (cancelled.json() as { orders: ApiOrder[] }).orders
    expect(cancelledOrders.some((o) => o.id === id)).toBe(true)
    expect(cancelledOrders.every((o) => o.status === 'cancelled')).toBe(true)

    const limited = await app.inject({ method: 'GET', url: '/orders?limit=2', headers })
    expect((limited.json() as { orders: ApiOrder[] }).orders.length).toBeLessThanOrEqual(2)
  })

  it('merges identical lines added later only when modifiers and notes match', async () => {
    const created = await postOrder({ branchId, items: [{ menuItemId: plainId, quantity: 1, notes: 'poco sal' }] })
    const id = (created.json() as { order: ApiOrder }).order.id

    const same = await app.inject({
      method: 'POST',
      url: `/orders/${id}/items`,
      headers,
      payload: { menuItemId: plainId, quantity: 1, notes: 'poco sal' },
    })
    expect((same.json() as { order: ApiOrder }).order.items).toHaveLength(1)

    const different = await app.inject({
      method: 'POST',
      url: `/orders/${id}/items`,
      headers,
      payload: { menuItemId: plainId, quantity: 1 },
    })
    expect(different.statusCode).toBe(201)
    expect((different.json() as { order: ApiOrder }).order.items).toHaveLength(2)
  })
})
