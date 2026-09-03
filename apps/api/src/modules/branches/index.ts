import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { requireTenantId } from '../tenants/tenants.module.js'
import { withTenant } from '../../shared/db.js'

export function createBranchesModule({ pool }: { pool: Pool }) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.get('/branches', { onRequest: [app.authenticate] }, async (request) => {
      const tenantId = requireTenantId(request)
      const result = await withTenant(pool, tenantId, (client) => client.query(
        'SELECT id, tenant_id AS "tenantId", name, address, phone, is_active AS "isActive" FROM branches WHERE tenant_id = $1 AND is_active = true ORDER BY name',
        [tenantId],
      ))
      return { branches: result.rows }
    })
  }
}
