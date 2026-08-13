import type { FastifyInstance } from 'fastify'
import type { MenuService } from './menu.service.js'
import { createMenuItemSchema } from './menu.schemas.js'
import { readTenantId, requireTenantId } from '../tenants/tenants.module.js'

export async function registerMenuRoutes(app: FastifyInstance, menuService: MenuService): Promise<void> {
  app.get('/menu/items', async (request, reply) => {
    const tenantId = readTenantId(request)
    if (!tenantId) {
      return reply.code(401).send({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Tenant context required',
      })
    }
    const items = await menuService.list(tenantId)
    return { items }
  })

  app.post('/menu/items', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const input = createMenuItemSchema.parse(request.body)
    const item = await menuService.create(tenantId, input)
    return reply.code(201).send({ item })
  })
}