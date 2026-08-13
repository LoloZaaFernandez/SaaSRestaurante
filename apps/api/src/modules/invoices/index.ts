import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { InvoicesRepository } from './invoices.repository.js'
import { registerInvoiceRoutes } from './invoices.routes.js'

export interface InvoicesModuleDeps {
  pool: Pool
}

export function createInvoicesModule({ pool }: InvoicesModuleDeps) {
  const invoicesRepository = new InvoicesRepository(pool)
  return async function register(app: FastifyInstance): Promise<void> {
    await registerInvoiceRoutes(app, invoicesRepository)
  }
}

export type { InvoicesRepository } from './invoices.repository.js'