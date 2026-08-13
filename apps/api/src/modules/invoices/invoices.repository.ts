import type { Pool } from 'pg'
import { AppError } from '../../shared/errors.js'
import { isUniqueViolation, queryOne, withTenant } from '../../shared/db.js'
import { nextCorrelativo } from './correlativo.js'
import type {
  ComprobanteType,
  Invoice,
  InvoiceStatus,
} from './invoices.schemas.js'

interface InvoiceRow {
  id: string
  tenant_id: string
  branch_id: string
  order_id: string
  comprobante_type: ComprobanteType
  serie: string
  numero: number
  customer_doc: 'dni' | 'ruc' | null
  customer_doc_number: string | null
  customer_name: string | null
  subtotal: string
  tax: string
  tip: string
  total: string
  tax_rate: string
  status: InvoiceStatus
  voided_reason: string | null
  issued_by: string
  printed_at: Date | null
  created_at: Date
}

const INVOICE_COLUMNS = `id, tenant_id, branch_id, order_id, comprobante_type, serie, numero,
  customer_doc, customer_doc_number, customer_name, subtotal, tax, tip, total, tax_rate,
  status, voided_reason, issued_by, printed_at, created_at`

export interface EmitInvoiceInput {
  orderId: string
  comprobanteType: ComprobanteType
  customerDoc?: 'dni' | 'ruc' | null
  customerDocNumber?: string | null
  customerName?: string | null
  issuedBy: string
}

export interface InvoiceFilters {
  branchId?: string
  comprobanteType?: ComprobanteType
  status?: InvoiceStatus
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    orderId: row.order_id,
    comprobanteType: row.comprobante_type,
    serie: row.serie,
    numero: row.numero,
    customerDoc: row.customer_doc,
    customerDocNumber: row.customer_doc_number,
    customerName: row.customer_name,
    subtotal: row.subtotal,
    tax: row.tax,
    tip: row.tip,
    total: row.total,
    taxRate: row.tax_rate,
    status: row.status,
    voidedReason: row.voided_reason,
    issuedBy: row.issued_by,
    printedAt: row.printed_at ? row.printed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  }
}

export class InvoicesRepository {
  constructor(private readonly pool: Pool) {}

  async emitInvoice(tenantId: string, input: EmitInvoiceInput): Promise<Invoice> {
    const serie = input.comprobanteType === 'boleta' ? 'B001' : 'F001'

    return withTenant(this.pool, tenantId, async (client) => {
      const order = await queryOne<{
        id: string
        branch_id: string
        subtotal: string
        tax: string
        tip: string
        total: string
        status: string
      }>(client, `SELECT id, branch_id, subtotal, tax, tip, total, status FROM orders WHERE id = $1 FOR UPDATE`, [
        input.orderId,
      ])
      if (!order) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
      }
      if (order.status === 'cancelled') {
        throw new AppError(409, 'ORDER_CANCELLED', 'Cannot emit a comprobante for a cancelled order')
      }

      const existing = await queryOne<{ id: string }>(
        client,
        'SELECT id FROM invoices WHERE order_id = $1',
        [input.orderId],
      )
      if (existing) {
        throw new AppError(409, 'INVOICE_ALREADY_EXISTS', 'Order already has a comprobante')
      }

      // Serialize per (branch, serie): lock existing rows so concurrent emissions queue up.
      await client.query('SELECT id FROM invoices WHERE branch_id = $1 AND serie = $2 FOR UPDATE', [
        order.branch_id,
        serie,
      ])

      let attempt = 0
      for (;;) {
        try {
          if (attempt > 0) {
            await client.query('ROLLBACK TO SAVEPOINT correlativo')
          }
          await client.query('SAVEPOINT correlativo')

          const numbers = await client.query<{ numero: number }>(
            `SELECT numero FROM invoices WHERE branch_id = $1 AND serie = $2`,
            [order.branch_id, serie],
          )
          const numero = nextCorrelativo(numbers.rows.map((row) => row.numero))

          const result = await client.query<InvoiceRow>(
            `INSERT INTO invoices (tenant_id, branch_id, order_id, comprobante_type, serie, numero,
               customer_doc, customer_doc_number, customer_name, subtotal, tax, tip, total, tax_rate, issued_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 18, $14)
             RETURNING ${INVOICE_COLUMNS}`,
            [
              tenantId,
              order.branch_id,
              input.orderId,
              input.comprobanteType,
              serie,
              numero,
              input.customerDoc ?? null,
              input.customerDocNumber ?? null,
              input.customerName ?? null,
              order.subtotal,
              order.tax,
              order.tip,
              order.total,
              input.issuedBy,
            ],
          )
          await client.query('RELEASE SAVEPOINT correlativo')
          return mapInvoice(result.rows[0]!)
        } catch (err) {
          if (isUniqueViolation(err) && attempt === 0) {
            attempt += 1
            continue
          }
          throw err
        }
      }
    })
  }

  async listInvoices(tenantId: string, filters: InvoiceFilters = {}): Promise<Invoice[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions: string[] = []
      const params: unknown[] = []
      if (filters.branchId) {
        params.push(filters.branchId)
        conditions.push(`branch_id = $${params.length}`)
      }
      if (filters.comprobanteType) {
        params.push(filters.comprobanteType)
        conditions.push(`comprobante_type = $${params.length}`)
      }
      if (filters.status) {
        params.push(filters.status)
        conditions.push(`status = $${params.length}`)
      }
      const result = await client.query<InvoiceRow>(
        `SELECT ${INVOICE_COLUMNS} FROM invoices
         ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY created_at DESC`,
        params,
      )
      return result.rows.map(mapInvoice)
    })
  }

  async getInvoice(invoiceId: string, tenantId: string): Promise<Invoice | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const row = await queryOne<InvoiceRow>(
        client,
        `SELECT ${INVOICE_COLUMNS} FROM invoices WHERE id = $1`,
        [invoiceId],
      )
      return row ? mapInvoice(row) : null
    })
  }

  async voidInvoice(
    invoiceId: string,
    tenantId: string,
    voidedReason: string,
  ): Promise<Invoice> {
    return withTenant(this.pool, tenantId, async (client) => {
      const current = await queryOne<{ status: InvoiceStatus }>(
        client,
        'SELECT status FROM invoices WHERE id = $1',
        [invoiceId],
      )
      if (!current) {
        throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found')
      }
      if (current.status === 'voided') {
        throw new AppError(409, 'INVOICE_ALREADY_VOIDED', 'Invoice is already voided')
      }
      const result = await client.query<InvoiceRow>(
        `UPDATE invoices SET status = 'voided', voided_reason = $1
         WHERE id = $2
         RETURNING ${INVOICE_COLUMNS}`,
        [voidedReason, invoiceId],
      )
      return mapInvoice(result.rows[0]!)
    })
  }
}