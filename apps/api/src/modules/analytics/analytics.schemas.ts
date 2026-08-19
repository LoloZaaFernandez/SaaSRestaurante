import { z } from 'zod'

/**
 * Schemas y tipos del módulo analytics.
 *
 * Los montos (money) se modelan como string decimal ("12.90") para evitar los
 * problemas de precisión de punto flotante y porque PostgreSQL devuelve los
 * numerics como string. Esto es consistente con `packages/contracts` (moneySchema).
 */

// Monto en string decimal con hasta 2 decimales.
const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "12.90"')

// Totales del día.
export const dashboardTotalsSchema = z.object({
  salesToday: moneySchema, // ventas del día (suma de payments.amount)
  ordersToday: z.number().int().min(0), // pedidos creados hoy (status <> cancelled)
  paidOrders: z.number().int().min(0), // pedidos pagados hoy (base del ticket promedio)
  avgTicket: moneySchema, // ventas del día / pedidos pagados
})

// Ocupación de mesas por estado.
export const dashboardOccupancySchema = z.object({
  total: z.number().int().min(0),
  free: z.number().int().min(0),
  occupied: z.number().int().min(0),
  reserved: z.number().int().min(0),
  cleaning: z.number().int().min(0),
})

// Ítem destacado del día.
export const topItemSchema = z.object({
  menuItemId: z.string().uuid().nullable(),
  name: z.string().min(1),
  quantitySold: z.number().int().min(0),
  revenue: moneySchema,
})

// Respuesta completa de GET /analytics/dashboard.
export const dashboardResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // fecha (día local) a la que responden los KPIs
  totals: dashboardTotalsSchema,
  activeOrders: z.number().int().min(0), // pedidos abiertos en este momento (status = 'open')
  occupancy: dashboardOccupancySchema,
  topItems: z.array(topItemSchema),
})

// ---------------------------------------------------------------------------
// Reporte con rango de fechas (P2): GET /analytics/report
// ---------------------------------------------------------------------------

// Rango del reporte: hoy, últimos 7 días o el mes en curso.
export const reportRangeSchema = z.enum(['today', 'week', 'month'])

// Query params de GET /analytics/report.
export const reportQuerySchema = z.object({
  range: reportRangeSchema.default('today'),
})

export type ReportRange = z.infer<typeof reportRangeSchema>

// Totales del rango (ventas, pedidos pagados y ticket promedio).
export const reportTotalsSchema = z.object({
  totalSales: moneySchema,
  totalOrders: z.number().int().min(0), // pedidos pagados en el rango
  avgTicket: moneySchema,
})

// Ventas por día calendario dentro del rango.
export const dailySalesSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalSales: moneySchema,
  orderCount: z.number().int().min(0), // pedidos pagados ese día
})

// Ventas agregadas por día de la semana (1 = lunes … 7 = domingo), ISO.
export const weekdaySalesSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  totalSales: moneySchema,
  orderCount: z.number().int().min(0),
})

// Conteo de pedidos por hora del día (0–23) para el gráfico de hora pico.
export const peakHourSchema = z.object({
  hour: z.number().int().min(0).max(23),
  orderCount: z.number().int().min(0),
})

// Respuesta completa de GET /analytics/report.
export const reportResponseSchema = z.object({
  range: reportRangeSchema,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totals: reportTotalsSchema,
  salesByDay: z.array(dailySalesSchema),
  salesByWeekday: z.array(weekdaySalesSchema),
  topItems: z.array(topItemSchema),
  peakHours: z.array(peakHourSchema),
})

export type ReportTotals = z.infer<typeof reportTotalsSchema>
export type DailySales = z.infer<typeof dailySalesSchema>
export type WeekdaySales = z.infer<typeof weekdaySalesSchema>
export type PeakHour = z.infer<typeof peakHourSchema>
export type ReportResponse = z.infer<typeof reportResponseSchema>

export type DashboardTotals = z.infer<typeof dashboardTotalsSchema>
export type DashboardOccupancy = z.infer<typeof dashboardOccupancySchema>
export type TopItem = z.infer<typeof topItemSchema>
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>
