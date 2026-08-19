import { pool } from '../../shared/db.js'
import type {
  DailySales,
  DashboardOccupancy,
  DashboardResponse,
  PeakHour,
  ReportRange,
  ReportResponse,
  TopItem,
  WeekdaySales,
} from './analytics.schemas.js'

/**
 * Repositorio de analytics: única capa que toca PostgreSQL.
 *
 * Patrón de acceso multitenant (documentado en README y migración 12):
 *   BEGIN → SET LOCAL TIME ZONE → set_app_tenant(tenantId) → queries → COMMIT
 *
 * - Se usa un cliente dedicado (pool.connect()) y TODAS las queries corren sobre ese
 *   mismo cliente: el contexto de tenant (set_app_tenant) es local de la transacción,
 *   por lo que `pool.query()` (que toma otro cliente del pool) NO funcionaría.
 * - `FORCE ROW LEVEL SECURITY` está activo, así que cada query sobre las views ya queda
 *   filtrada por tenant; la columna tenant_id explícita es redundancia defensiva.
 * - `SET LOCAL TIME ZONE` alinea el corte de "día" (CURRENT_DATE, date_trunc) con el que
 *   usan las views de la migración 12, y se revierte al cerrar la transacción.
 */

// Zona horaria de referencia para el corte de "día" de los KPIs.
const APP_TIMEZONE = 'America/Argentina/Buenos_Aires'

interface DailySalesRow {
  total_sales: string
  paid_orders: string
  avg_ticket: string
}

interface CountRow {
  count: number
}

interface OccupancyRow {
  status: string
  table_count: number
}

interface TopItemRow {
  menu_item_id: string | null
  item_name: string
  quantity_sold: number
  revenue: string
}

interface TodayRow {
  today: string
}

interface ReportTotalsRow {
  total_sales: string
  total_orders: number
  avg_ticket: string
}

// Fila de v_daily_sales para el reporte: ventas por día calendario.
interface SalesByDayRow {
  day: string
  total_sales: string
  paid_orders: string
}

interface WeekdayRow {
  weekday: number
  total_sales: string
  order_count: number
}

interface PeakHourRow {
  hour: number
  order_count: number
}

// Convierte "YYYY-MM-DD" a Date UTC y suma días.
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Devuelve [desde, hasta] (inclusive) según el rango pedido, anclado a "today".
function rangeBounds(range: ReportRange, today: string): { from: string; to: string } {
  if (range === 'today') return { from: today, to: today }
  if (range === 'week') return { from: addDays(today, -6), to: today }
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

export class AnalyticsRepository {
  /** Agrega los KPIs del dashboard de un tenant para el día actual. */
  async dashboard(tenantId: string): Promise<DashboardResponse> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // SET LOCAL: el timezone solo dura esta transacción (el cliente vuelve limpio al pool).
      await client.query(`SET LOCAL TIME ZONE '${APP_TIMEZONE}'`)
      await client.query('SELECT set_app_tenant($1)', [tenantId])

      const todayResult = await client.query<TodayRow>('SELECT CURRENT_DATE::text AS today')
      const today = todayResult.rows[0]?.today ?? new Date().toISOString().slice(0, 10)

      // 1) Ventas del día, pedidos pagados y ticket promedio (view de la migración 12).
      const sales = await client.query<DailySalesRow>(
        `SELECT total_sales, paid_orders, avg_ticket
         FROM v_daily_sales
         WHERE tenant_id = $1 AND day = CURRENT_DATE`,
        [tenantId],
      )

      // 2) Pedidos creados hoy (sin cancelados).
      const ordersToday = await client.query<CountRow>(
        `SELECT COUNT(*)::int AS count
         FROM orders
         WHERE tenant_id = $1 AND status <> 'cancelled' AND opened_at >= date_trunc('day', now())`,
        [tenantId],
      )

      // 3) Pedidos abiertos en este momento (KPI "pedidos activos" del frontend).
      const activeOrders = await client.query<CountRow>(
        `SELECT COUNT(*)::int AS count
         FROM orders
         WHERE tenant_id = $1 AND status = 'open'`,
        [tenantId],
      )

      // 4) Ocupación de mesas por estado (view de la migración 12).
      const occupancy = await client.query<OccupancyRow>(
        `SELECT status, table_count
         FROM v_table_occupancy
         WHERE tenant_id = $1`,
        [tenantId],
      )

      // 5) Top 5 ítems del día por ingreso (view de la migración 12).
      const topItems = await client.query<TopItemRow>(
        `SELECT menu_item_id, item_name, quantity_sold, revenue
         FROM v_top_items
         WHERE tenant_id = $1 AND day = CURRENT_DATE
         ORDER BY revenue DESC
         LIMIT 5`,
        [tenantId],
      )

      await client.query('COMMIT')

      return this.toDashboardResponse(
        today,
        sales.rows[0],
        ordersToday.rows[0]?.count,
        activeOrders.rows[0]?.count,
        occupancy.rows,
        topItems.rows,
      )
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /** Reporte agregado para un rango: ventas por día, por día de semana, top ítems y hora pico. */
  async report(tenantId: string, range: ReportRange): Promise<ReportResponse> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL TIME ZONE '${APP_TIMEZONE}'`)
      await client.query('SELECT set_app_tenant($1)', [tenantId])

      const todayResult = await client.query<TodayRow>('SELECT CURRENT_DATE::text AS today')
      const today = todayResult.rows[0]?.today ?? new Date().toISOString().slice(0, 10)
      const { from, to } = rangeBounds(range, today)

      // 1) Totales del rango (suma sobre v_daily_sales, que ya agrega por tenant y día).
      const totals = await client.query<ReportTotalsRow>(
        `SELECT
           COALESCE(SUM(total_sales), 0)        AS total_sales,
           COALESCE(SUM(paid_orders), 0)::int    AS total_orders,
           CASE
             WHEN COALESCE(SUM(paid_orders), 0) = 0 THEN 0
             ELSE ROUND(SUM(total_sales) / SUM(paid_orders), 2)
           END                                   AS avg_ticket
         FROM v_daily_sales
         WHERE tenant_id = $1 AND day BETWEEN $2 AND $3`,
        [tenantId, from, to],
      )

      // 2) Ventas por día calendario.
      const salesByDay = await client.query<SalesByDayRow>(
        `SELECT day, total_sales, paid_orders
         FROM v_daily_sales
         WHERE tenant_id = $1 AND day BETWEEN $2 AND $3
         ORDER BY day`,
        [tenantId, from, to],
      )

      // 3) Ventas agregadas por día de la semana (ISODOW: 1=lunes … 7=domingo).
      const salesByWeekday = await client.query<WeekdayRow>(
        `SELECT EXTRACT(ISODOW FROM day)::int AS weekday,
                SUM(total_sales)              AS total_sales,
                SUM(paid_orders)::int         AS order_count
         FROM v_daily_sales
         WHERE tenant_id = $1 AND day BETWEEN $2 AND $3
         GROUP BY weekday
         ORDER BY weekday`,
        [tenantId, from, to],
      )

      // 4) Top 5 ítems por ingreso en el rango.
      const topItems = await client.query<TopItemRow>(
        `SELECT menu_item_id, item_name, quantity_sold, revenue
         FROM v_top_items
         WHERE tenant_id = $1 AND day BETWEEN $2 AND $3
         ORDER BY revenue DESC
         LIMIT 5`,
        [tenantId, from, to],
      )

      // 5) Hora pico: pedidos (no cancelados) por hora del día en el rango.
      //    El límite superior es exclusivo: (< to + 1 día) incluye todo el "to".
      const peakHours = await client.query<PeakHourRow>(
        `SELECT EXTRACT(HOUR FROM opened_at)::int AS hour,
                COUNT(*)::int                     AS order_count
         FROM orders
         WHERE tenant_id = $1 AND status <> 'cancelled'
           AND opened_at >= $2::date
           AND opened_at < $3::date + 1
         GROUP BY hour
         ORDER BY hour`,
        [tenantId, from, to],
      )

      await client.query('COMMIT')

      return this.toReportResponse(range, from, to, totals.rows[0], salesByDay.rows, salesByWeekday.rows, topItems.rows, peakHours.rows)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  /** Compone la respuesta del reporte rellenando con ceros los días/horas sin datos. */
  private toReportResponse(
    range: ReportRange,
    from: string,
    to: string,
    totals: ReportTotalsRow | undefined,
    salesByDayRows: SalesByDayRow[],
    weekdayRows: WeekdayRow[],
    topItemRows: TopItemRow[],
    peakHourRows: PeakHourRow[],
  ): ReportResponse {
    const paidOrders = totals?.total_orders ?? 0

    const byDay = new Map(salesByDayRows.map((row) => [row.day, row]))
    const salesByDay: DailySales[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const row = byDay.get(d)
      salesByDay.push({
        day: d,
        totalSales: row?.total_sales ?? '0.00',
        orderCount: row ? Number(row.paid_orders) : 0,
      })
    }

    // Rellena los 7 días de la semana (1=lunes…7=domingo) con ceros.
    const byWeekday = new Map(weekdayRows.map((row) => [row.weekday, row]))
    const salesByWeekday: WeekdaySales[] = []
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const row = byWeekday.get(weekday)
      salesByWeekday.push({
        weekday,
        totalSales: row?.total_sales ?? '0.00',
        orderCount: row?.order_count ?? 0,
      })
    }

    // Rellena las 24 horas con ceros para un perfil continuo de hora pico.
    const byHour = new Map(peakHourRows.map((row) => [row.hour, row]))
    const peakHours: PeakHour[] = []
    for (let hour = 0; hour < 24; hour += 1) {
      const row = byHour.get(hour)
      peakHours.push({ hour, orderCount: row?.order_count ?? 0 })
    }

    const topItems: TopItem[] = topItemRows.map((row) => ({
      menuItemId: row.menu_item_id,
      name: row.item_name,
      quantitySold: row.quantity_sold,
      revenue: row.revenue,
    }))

    return {
      range,
      from,
      to,
      totals: {
        totalSales: totals?.total_sales ?? '0.00',
        totalOrders: paidOrders,
        avgTicket: totals?.avg_ticket ?? '0.00',
      },
      salesByDay,
      salesByWeekday,
      topItems,
      peakHours,
    }
  }

  /** Compone la respuesta del dashboard aplicando defaults cuando no hay datos. */
  private toDashboardResponse(
    date: string,
    sales: DailySalesRow | undefined,
    ordersToday: number | undefined,
    activeOrders: number | undefined,
    occupancyRows: OccupancyRow[],
    topItemRows: TopItemRow[],
  ): DashboardResponse {
    // Defaults: sin datos el dashboard debe responder con ceros, no con error.
    const totals = {
      salesToday: sales?.total_sales ?? '0.00',
      paidOrders: sales ? Number(sales.paid_orders) : 0,
      avgTicket: sales?.avg_ticket ?? '0.00',
      ordersToday: ordersToday ?? 0,
    }

    const occupancy = this.toOccupancy(occupancyRows)
    const topItems: TopItem[] = topItemRows.map((row) => ({
      menuItemId: row.menu_item_id,
      name: row.item_name,
      quantitySold: row.quantity_sold,
      revenue: row.revenue,
    }))

    return { date, totals, activeOrders: activeOrders ?? 0, occupancy, topItems }
  }

  /** Convierte filas de v_table_occupancy al objeto de ocupación con todos los estados. */
  private toOccupancy(rows: OccupancyRow[]): DashboardOccupancy {
    const byStatus = new Map(rows.map((row) => [row.status, row.table_count]))
    const occupancy: DashboardOccupancy = {
      total: 0,
      free: byStatus.get('free') ?? 0,
      occupied: byStatus.get('occupied') ?? 0,
      reserved: byStatus.get('reserved') ?? 0,
      cleaning: byStatus.get('cleaning') ?? 0,
    }
    occupancy.total = occupancy.free + occupancy.occupied + occupancy.reserved + occupancy.cleaning
    return occupancy
  }
}
