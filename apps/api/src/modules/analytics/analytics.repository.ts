import type { Pool, QueryResultRow } from 'pg'
import { AppError } from '../../shared/errors.js'
import { queryOne, withTenant } from '../../shared/db.js'
import { addMoney, fromCents, toCents } from '../../shared/money.js'
import type {
  AnalyticsDashboard,
  AnalyticsReport,
  DailySales,
  SalesByHour,
  TableOccupancy,
  TopItem,
} from './analytics.schemas.js'

// Los días se agrupan en UTC: ver docs/modules/analytics.md.
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dayStart(day: string): string {
  return `${day}T00:00:00.000Z`
}

function dayEnd(day: string): string {
  const cursor = new Date(`${day}T00:00:00.000Z`)
  cursor.setUTCDate(cursor.getUTCDate() + 1)
  return cursor.toISOString()
}

function addDays(day: string, delta: number): string {
  const cursor = new Date(`${day}T00:00:00.000Z`)
  cursor.setUTCDate(cursor.getUTCDate() + delta)
  return utcDay(cursor)
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  const cursor = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T00:00:00.000Z`)
  while (cursor <= end) {
    days.push(utcDay(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function dayToString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

interface DailySalesRow extends QueryResultRow {
  dia: Date | string
  total_ventas: string
  total_propinas: string
  cantidad_pedidos: string
  cantidad_pagos: string
}

interface TopItemRow extends QueryResultRow {
  name: string
  cantidad: string
  ingresos: string
}

interface HourRow extends QueryResultRow {
  hour: number
  sales: string
  orders: string
}

const DAILY_SALES_SQL = `
  SELECT dia, total_ventas, total_propinas, cantidad_pedidos, cantidad_pagos
  FROM v_ventas_diarias
  WHERE dia >= $1 AND dia <= $2
  ORDER BY dia
`

const TOP_ITEMS_SQL = `
  SELECT name, SUM(cantidad) AS cantidad, SUM(ingresos) AS ingresos
  FROM v_top_items
  WHERE dia >= $1 AND dia <= $2
  GROUP BY name
  ORDER BY cantidad DESC, ingresos DESC
  LIMIT 5
`

const SALES_BY_HOUR_SQL = `
  SELECT EXTRACT(HOUR FROM received_at)::int AS hour,
         SUM(amount) AS sales,
         COUNT(DISTINCT order_id) AS orders
  FROM payments
  WHERE received_at >= $1 AND received_at < $2
  GROUP BY 1
  ORDER BY 1
`

function mapTopItem(row: TopItemRow): TopItem {
  return {
    name: row.name,
    quantity: Number(row.cantidad),
    revenue: row.ingresos,
  }
}

function buildOccupancy(rows: Array<{ status: string; cantidad_mesas: string }>): TableOccupancy {
  const byStatus = new Map<string, number>()
  for (const row of rows) {
    byStatus.set(row.status, Number(row.cantidad_mesas))
  }
  const occupied = byStatus.get('occupied') ?? 0
  const free = byStatus.get('free') ?? 0
  const reserved = byStatus.get('reserved') ?? 0
  const cleaning = byStatus.get('cleaning') ?? 0
  return { total: occupied + free + reserved + cleaning, occupied, free, reserved, cleaning }
}

function fillDailySales(rows: DailySalesRow[], from: string, to: string): DailySales[] {
  const byDay = new Map<string, DailySales>()
  for (const row of rows) {
    const date = dayToString(row.dia)
    byDay.set(date, {
      date,
      sales: row.total_ventas,
      orders: Number(row.cantidad_pedidos),
      payments: Number(row.cantidad_pagos),
    })
  }
  return eachDay(from, to).map((date) => {
    const entry = byDay.get(date)
    if (entry) return entry
    return { date, sales: '0.00', orders: 0, payments: 0 }
  })
}

function fillSalesByHour(rows: HourRow[]): SalesByHour[] {
  const byHour = new Map<number, SalesByHour>()
  for (const row of rows) {
    byHour.set(row.hour, { hour: row.hour, sales: row.sales, orders: Number(row.orders) })
  }
  return Array.from({ length: 24 }, (_, hour) => {
    const entry = byHour.get(hour)
    if (entry) return entry
    return { hour, sales: '0.00', orders: 0 }
  })
}

export class AnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  async getDashboard(tenantId: string): Promise<AnalyticsDashboard> {
    const today = utcDay(new Date())
    return withTenant(this.pool, tenantId, async (client) => {
      const daily = await queryOne<DailySalesRow>(client, DAILY_SALES_SQL, [today, today])
      const ordersTodayRow = await queryOne<{ count: string }>(
        client,
        `SELECT COUNT(*) FROM orders WHERE opened_at >= $1 AND opened_at < $2 AND status <> 'cancelled'`,
        [dayStart(today), dayEnd(today)],
      )
      const openOrdersRow = await queryOne<{ count: string }>(
        client,
        `SELECT COUNT(*) FROM orders WHERE status = 'open'`,
      )
      const tables = await client.query<{ status: string; cantidad_mesas: string }>(
        `SELECT status, cantidad_mesas FROM v_ocupacion_mesas`,
      )
      const topItems = await client.query<TopItemRow>(TOP_ITEMS_SQL, [today, today])

      const salesToday = daily?.total_ventas ?? '0.00'
      const paidOrders = Number(daily?.cantidad_pedidos ?? 0)
      const averageTicket =
        paidOrders > 0 ? fromCents(Math.round(toCents(salesToday) / paidOrders)) : '0.00'

      return {
        period: { from: today, to: today },
        metrics: {
          salesToday,
          ordersToday: Number(ordersTodayRow?.count ?? 0),
          averageTicket,
          openOrders: Number(openOrdersRow?.count ?? 0),
          tables: buildOccupancy(tables.rows),
        },
        topItems: topItems.rows.map(mapTopItem),
      }
    })
  }

  async getReport(
    tenantId: string,
    filters: { from?: string; to?: string } = {},
  ): Promise<AnalyticsReport> {
    const to = filters.to ?? utcDay(new Date())
    const from = filters.from ?? addDays(to, -6)

    if (from > to) {
      throw new AppError(400, 'INVALID_RANGE', 'from must be on or before to')
    }

    return withTenant(this.pool, tenantId, async (client) => {
      const dailyRows = await client.query<DailySalesRow>(DAILY_SALES_SQL, [from, to])
      const hourlyRows = await client.query<HourRow>(SALES_BY_HOUR_SQL, [dayStart(from), dayEnd(to)])
      const topItemRows = await client.query<TopItemRow>(TOP_ITEMS_SQL, [from, to])

      const dailySales = fillDailySales(dailyRows.rows, from, to)
      const sales = addMoney(dailySales.map((day) => day.sales))
      const orders = dailySales.reduce((sum, day) => sum + day.orders, 0)
      const averageTicket = orders > 0 ? fromCents(Math.round(toCents(sales) / orders)) : '0.00'

      return {
        period: { from, to },
        dailySales,
        topItems: topItemRows.rows.map(mapTopItem),
        salesByHour: fillSalesByHour(hourlyRows.rows),
        totals: { sales, orders, averageTicket },
      }
    })
  }
}