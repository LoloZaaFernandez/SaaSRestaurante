import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'

export interface HealthModuleDeps {
  pool: Pool
}

export function createHealthModule({ pool }: HealthModuleDeps) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.get('/health', async (request, reply) => {
      try {
        const client = await pool.connect()
        try {
          await client.query('SELECT 1')
        } finally {
          client.release()
        }
        return { status: 'ok', db: 'up' }
      } catch (err) {
        request.log.warn({ err }, 'health db ping failed')
        reply.code(503)
        return { status: 'error', db: 'down' }
      }
    })
  }
}