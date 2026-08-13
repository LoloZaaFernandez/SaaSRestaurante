import type { FastifyInstance } from 'fastify'
import type { OrderService } from './orders.service.js'
import { createOrderSchema } from './orders.schemas.js'
import { requireTenantId } from '../tenants/tenants.module.js'

export async function registerOrderRoutes(app: FastifyInstance, orderService: OrderService): Promise<void> {
  app.get('/orders', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const orders = await orderService.list(tenantId)
    return { orders }
  })

  app.post('/orders', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const input = createOrderSchema.parse(request.body)
    const order = await orderService.create(tenantId, input)
    return reply.code(201).send({ order })
  })
}