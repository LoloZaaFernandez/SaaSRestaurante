import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ShiftsRepository } from './shifts.repository.js'
import { closeShiftSchema, createMovementSchema, openShiftSchema } from './shifts.schemas.js'
import { requireTenantId } from '../tenants/tenants.module.js'

const uuidSchema = z.string().uuid()

export async function registerShiftRoutes(app: FastifyInstance, repository: ShiftsRepository): Promise<void> {
  app.get('/shifts/current', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const query = z.object({ branchId: uuidSchema.optional() }).parse(request.query)
    return { shift: await repository.getCurrent(tenantId, query.branchId) }
  })

  app.post('/shifts', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const input = openShiftSchema.parse(request.body)
    return reply.code(201).send({ shift: await repository.open(tenantId, input, request.user.sub) })
  })

  app.post('/shifts/:id/close', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const input = closeShiftSchema.parse(request.body)
    return { shift: await repository.close(tenantId, id, input.closingCash) }
  })

  app.get('/shifts/:id/movements', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    return { movements: await repository.listMovements(tenantId, id) }
  })

  app.post('/shifts/:id/movements', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const { id } = z.object({ id: uuidSchema }).parse(request.params)
    const input = createMovementSchema.parse(request.body)
    return reply.code(201).send({ movement: await repository.addMovement(tenantId, id, input, request.user.sub) })
  })
}
