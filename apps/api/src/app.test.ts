import { describe, expect, it } from 'vitest'

process.env.DATABASE_URL = 'postgres://saas_app:saas_app@localhost:5432/saas_restaurante'
process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const { buildApp } = await import('./app.js')

describe('api smoke', () => {
  it('GET /health returns ok when database is reachable', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', db: 'up' })
    await app.close()
  })

  it('GET /health is degraded when database is unreachable', async () => {
    const app = await buildApp({ databaseUrl: 'postgres://saas_app:saas_app@127.0.0.1:59995/nope' })
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

  it('rejects protected routes with an invalid token', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: 'Bearer not-a-real-token' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
    await app.close()
  })

  it('returns 401 for unknown credentials on login', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@test.com', password: 'whatever' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await app.close()
  })
})