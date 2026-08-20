import { z } from 'zod'
import { moneySchema } from '@saasrestaurante/contracts'

// Los shapes de analytics son view-models de este módulo (no entidades de
// dominio), por eso viven acá y no en packages/contracts. Ver docs/modules/analytics.md.

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

export const analyticsPeriodSchema = z.object({
  from: dateSchema,
  to: dateSchema,
})

export const dailySalesSchema = z.object({
  date: dateSchema,
  sales: moneySchema,
  orders: z.number().int().nonnegative(),
  payments: z.number().int().nonnegative(),
})

export const topItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  revenue: moneySchema,
})

export const tableOccupancySchema = z.object({
  total: z.number().int().nonnegative(),
  occupied: z.number().int().nonnegative(),
  free: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  cleaning: z.number().int().nonnegative(),
})

export const dashboardMetricsSchema = z.object({
  salesToday: moneySchema,
  ordersToday: z.number().int().nonnegative(),
  averageTicket: moneySchema,
  openOrders: z.number().int().nonnegative(),
  tables: tableOccupancySchema,
})

export const analyticsDashboardSchema = z.object({
  period: analyticsPeriodSchema,
  metrics: dashboardMetricsSchema,
  topItems: z.array(topItemSchema),
})

export const salesByHourSchema = z.object({
  hour: z.number().int().min(0).max(23),
  sales: moneySchema,
  orders: z.number().int().nonnegative(),
})

export const analyticsReportSchema = z.object({
  period: analyticsPeriodSchema,
  dailySales: z.array(dailySalesSchema),
  topItems: z.array(topItemSchema),
  salesByHour: z.array(salesByHourSchema),
  totals: z.object({
    sales: moneySchema,
    orders: z.number().int().nonnegative(),
    averageTicket: moneySchema,
  }),
})

export const reportQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

export type AnalyticsPeriod = z.infer<typeof analyticsPeriodSchema>
export type DailySales = z.infer<typeof dailySalesSchema>
export type TopItem = z.infer<typeof topItemSchema>
export type TableOccupancy = z.infer<typeof tableOccupancySchema>
export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>
export type AnalyticsDashboard = z.infer<typeof analyticsDashboardSchema>
export type SalesByHour = z.infer<typeof salesByHourSchema>
export type AnalyticsReport = z.infer<typeof analyticsReportSchema>
export type ReportQuery = z.infer<typeof reportQuerySchema>