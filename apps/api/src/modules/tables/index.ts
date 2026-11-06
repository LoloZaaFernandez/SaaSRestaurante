import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { z } from 'zod'
import { tableKindSchema, tableStatusSchema } from '@saasrestaurante/contracts'
import { requireTenantId } from '../tenants/tenants.module.js'
import { withTenant } from '../../shared/db.js'

const listTablesQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  status: tableStatusSchema.optional(),
  kind: tableKindSchema.optional(),
})

interface TableRow {
  id: string
  tenantId: string
  branchId: string
  label: string
  seats: number
  status: string
  kind: string
}

export function createTablesModule({ pool }: { pool: Pool }) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.get('/tables', { onRequest: [app.authenticate] }, async (request) => {
      const tenantId = requireTenantId(request)
      const query = listTablesQuerySchema.parse(request.query)
      const conditions: string[] = []
      const params: unknown[] = []
      if (query.branchId) {
        params.push(query.branchId)
        conditions.push(`branch_id = $${params.length}`)
      }
      if (query.status) {
        params.push(query.status)
        conditions.push(`status = $${params.length}`)
      }
      if (query.kind) {
        params.push(query.kind)
        conditions.push(`kind = $${params.length}`)
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const result = await withTenant(pool, tenantId, (client) =>
        client.query<TableRow>(
          `SELECT id, tenant_id AS "tenantId", branch_id AS "branchId", label, seats, status, kind
           FROM tables ${where}`,
          params,
        ),
      )
      const tables = [...result.rows].sort((a, b) =>
        a.label.localeCompare(b.label, 'es', { numeric: true }),
      )
      return { tables }
    })
  }
}
