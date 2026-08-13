import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { OrdersRepository } from '../orders/orders.repository.js'
import { setKitchenStatusSchema } from '../orders/orders.schemas.js'
import { requireTenantId } from '../tenants/tenants.module.js'

const uuidSchema = z.string().uuid()

export async function registerKdsRoutes(
  app: FastifyInstance,
  ordersRepository: OrdersRepository,
): Promise<void> {
  app.get('/kds/orders', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const query = z
      .object({
        branchId: z.string().uuid().optional(),
      })
      .parse(request.query)
    const orders = await ordersRepository.listKitchenQueue(tenantId, query)
    return { orders }
  })

  app.post('/kds/orders/:id/status', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const { status } = setKitchenStatusSchema.parse(request.body)
    const order = await ordersRepository.setKitchenStatus(id, tenantId, status)
    return { order }
  })
}