import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { AnalyticsRepository } from './analytics.repository.js'
import { registerAnalyticsRoutes } from './analytics.routes.js'

export interface AnalyticsModuleDeps {
  pool: Pool
}

export function createAnalyticsModule({ pool }: AnalyticsModuleDeps) {
  const analyticsRepository = new AnalyticsRepository(pool)
  return async function register(app: FastifyInstance): Promise<void> {
    await registerAnalyticsRoutes(app, analyticsRepository)
  }
}

export type { AnalyticsRepository } from './analytics.repository.js'