import type { FastifyInstance } from 'fastify'
import { Pool } from 'pg'
import { config } from '../../shared/config.js'

export async function register(app: FastifyInstance): Promise<void> {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: 1000,
  })

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

  app.addHook('onClose', async () => {
    await pool.end()
  })
}