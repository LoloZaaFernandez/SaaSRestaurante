import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { InvoicesRepository } from './invoices.repository.js'
import {
  comprobanteTypeSchema,
  emitInvoiceSchema,
  invoiceStatusSchema,
  voidInvoiceSchema,
} from './invoices.schemas.js'
import { requireTenantId } from '../tenants/tenants.module.js'

const uuidSchema = z.string().uuid()

export async function registerInvoiceRoutes(
  app: FastifyInstance,
  invoicesRepository: InvoicesRepository,
): Promise<void> {
  app.post('/invoices', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const input = emitInvoiceSchema.parse(request.body)
    const invoice = await invoicesRepository.emitInvoice(tenantId, {
      ...input,
      issuedBy: request.user.sub,
    })
    return reply.code(201).send({ invoice })
  })

  app.get('/invoices', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const query = z
      .object({
        branchId: z.string().uuid().optional(),
        comprobanteType: comprobanteTypeSchema.optional(),
        status: invoiceStatusSchema.optional(),
      })
      .parse(request.query)
    const invoices = await invoicesRepository.listInvoices(tenantId, query)
    return { invoices }
  })

  app.get('/invoices/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const invoice = await invoicesRepository.getInvoice(id, tenantId)
    if (!invoice) {
      return reply.code(404).send({
        statusCode: 404,
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
      })
    }
    return { invoice }
  })

  app.post('/invoices/:id/void', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const { voidedReason } = voidInvoiceSchema.parse(request.body)
    const invoice = await invoicesRepository.voidInvoice(id, tenantId, voidedReason)
    return { invoice }
  })
}