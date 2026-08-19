import type { FastifyInstance } from 'fastify'
import type { AnalyticsService } from './analytics.service.js'
import { AnalyticsRepository } from './analytics.repository.js'
import { AnalyticsService as AnalyticsServiceImpl } from './analytics.service.js'
import { registerAnalyticsRoutes } from './analytics.routes.js'

export interface AnalyticsModuleDeps {
  analyticsService?: AnalyticsService
}

export function createAnalyticsModule(deps: AnalyticsModuleDeps = {}) {
  const analyticsService = deps.analyticsService ?? new AnalyticsServiceImpl(new AnalyticsRepository())
  return async function register(app: FastifyInstance): Promise<void> {
    await registerAnalyticsRoutes(app, analyticsService)
  }
}

export const register = createAnalyticsModule()
