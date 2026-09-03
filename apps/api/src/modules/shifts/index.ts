import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { ShiftsRepository } from './shifts.repository.js'
import { registerShiftRoutes } from './shifts.routes.js'

export function createShiftsModule({ pool }: { pool: Pool }) {
  const repository = new ShiftsRepository(pool)
  return async function register(app: FastifyInstance): Promise<void> {
    await registerShiftRoutes(app, repository)
  }
}
