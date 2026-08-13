import { describe, expect, it } from 'vitest'

process.env.DATABASE_URL = 'postgres://saas:saas@localhost:5432/saas_restaurante'
process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const { buildApp } = await import('./app.js')

describe('api smoke', () => {
  it('GET /health returns degraded when database is unreachable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ status: 'error', db: 'down' })
    await app.close()
  })

  it('rejects protected routes without a token', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('login → create menu item → create order against price snapshot', async () => {
    const app = await buildApp()

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@saas.local', password: 'admin123' },
    })
    expect(login.statusCode).toBe(200)
    const token = login.json().token as string
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

    const createItem = await app.inject({
      method: 'POST',
      url: '/menu/items',
      headers,
      payload: { name: 'Milanesa a caballo', description: 'Con huevos fritos', price: '12.50', category: 'platos' },
    })
    expect(createItem.statusCode).toBe(201)
    const item = createItem.json().item

    const createOrder = await app.inject({
      method: 'POST',
      url: '/orders',
      headers,
      payload: { items: [{ menuItemId: item.id, quantity: 2 }] },
    })
    expect(createOrder.statusCode).toBe(201)
    const order = createOrder.json().order
    expect(order.total).toBe('25.00')
    expect(order.lines[0]).toMatchObject({ unitPrice: '12.50', quantity: 2 })
    await app.close()
  })
})