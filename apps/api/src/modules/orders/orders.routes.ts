import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { OrdersRepository } from './orders.repository.js'
import { createOrderSchema, createPaymentSchema, orderStatusSchema } from './orders.schemas.js'
import { requireTenantId } from '../tenants/tenants.module.js'

const uuidSchema = z.string().uuid()

export async function registerOrderRoutes(
  app: FastifyInstance,
  ordersRepository: OrdersRepository,
): Promise<void> {
  app.get('/orders', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const query = z
      .object({
        branchId: z.string().uuid().optional(),
        status: orderStatusSchema.optional(),
      })
      .parse(request.query)
    const orders = await ordersRepository.listOrders(tenantId, query)
    return { orders }
  })

  app.get('/orders/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const order = await ordersRepository.getOrder(id, tenantId)
    if (!order) {
      return reply.code(404).send({
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      })
    }
    return { order }
  })

  app.post('/orders', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const input = createOrderSchema.parse(request.body)
    const order = await ordersRepository.createOrder(tenantId, input, request.user.sub)
    return reply.code(201).send({ order })
  })

  app.patch('/orders/:id/status', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const { status } = z.object({ status: orderStatusSchema }).parse(request.body)
    const order = await ordersRepository.updateStatus(id, tenantId, status)
    return { order }
  })

  app.post('/orders/:id/payments', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const input = createPaymentSchema.parse(request.body)
    const result = await ordersRepository.recordPayment(id, tenantId, input)
    return reply.code(201).send(result)
  })

  app.post('/orders/:id/items', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const input = createOrderSchema.shape.items.element.parse(request.body)
    const order = await ordersRepository.addItem(id, tenantId, input)
    return reply.code(201).send({ order })
  })
}