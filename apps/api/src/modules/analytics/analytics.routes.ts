import type { FastifyInstance } from 'fastify'
import type { AnalyticsRepository } from './analytics.repository.js'
import { reportQuerySchema } from './analytics.schemas.js'
import { requireTenantId } from '../tenants/tenants.module.js'

export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  analyticsRepository: AnalyticsRepository,
): Promise<void> {
  app.get('/analytics/dashboard', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    return analyticsRepository.getDashboard(tenantId)
  })

  app.get('/analytics/report', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const query = reportQuerySchema.parse(request.query)
    return analyticsRepository.getReport(tenantId, query)
  })
}