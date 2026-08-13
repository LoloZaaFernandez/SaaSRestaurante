import { z } from 'zod'
import {
  comprobanteTypeSchema,
  invoiceSchema,
  invoiceStatusSchema,
  type ComprobanteType,
  type Invoice,
  type InvoiceStatus,
} from '@saasrestaurante/contracts'

export { comprobanteTypeSchema, invoiceSchema, invoiceStatusSchema }
export type { ComprobanteType, Invoice, InvoiceStatus }

export const emitInvoiceSchema = z.object({
  orderId: z.string().uuid(),
  comprobanteType: comprobanteTypeSchema,
  customerDoc: z.enum(['dni', 'ruc']).nullable().optional(),
  customerDocNumber: z.string().min(1).max(20).nullable().optional(),
  customerName: z.string().min(1).max(120).nullable().optional(),
})

export type EmitInvoiceInput = z.infer<typeof emitInvoiceSchema>

export const voidInvoiceSchema = z.object({
  voidedReason: z.string().min(3).max(500),
})

export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>