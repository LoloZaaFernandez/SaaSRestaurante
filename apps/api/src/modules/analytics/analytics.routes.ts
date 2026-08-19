import type { FastifyInstance } from 'fastify'
import type { AnalyticsService } from './analytics.service.js'
import { dashboardResponseSchema, reportQuerySchema, reportResponseSchema } from './analytics.schemas.js'
import { requireTenantId } from '../tenants/tenants.module.js'

export async function registerAnalyticsRoutes(app: FastifyInstance, analyticsService: AnalyticsService): Promise<void> {
  // KPIs del dashboard. Es una ruta tenant-scoped y sensible, por eso exige autenticación.
  app.get('/analytics/dashboard', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const dashboard = await analyticsService.getDashboard(tenantId)
    // Validación defensiva: el response cumple el contrato definido en analytics.schemas.
    return dashboardResponseSchema.parse(dashboard)
  })

  // Reporte agregado con rango (hoy / semana / mes): ventas por día, top ítems y hora pico.
  app.get('/analytics/report', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { range } = reportQuerySchema.parse(request.query)
    const report = await analyticsService.getReport(tenantId, range)
    return reportResponseSchema.parse(report)
  })
}
