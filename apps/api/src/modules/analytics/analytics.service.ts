import type { AnalyticsRepository } from './analytics.repository.js'
import type { DashboardResponse, ReportRange, ReportResponse } from './analytics.schemas.js'

/**
 * Caso de uso de analytics. El service delega toda la persistencia en el repositorio
 * (patrón Screaming Architecture: routes → service → repository).
 */
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  /** KPIs del dashboard para el día actual del tenant dado. */
  async getDashboard(tenantId: string): Promise<DashboardResponse> {
    return this.repository.dashboard(tenantId)
  }

  /** Reporte agregado (ventas por día, top ítems, hora pico) para un rango. */
  async getReport(tenantId: string, range: ReportRange): Promise<ReportResponse> {
    return this.repository.report(tenantId, range)
  }
}
