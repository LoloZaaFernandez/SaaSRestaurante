import type { FastifyInstance } from 'fastify'
import type { MenuService } from './menu.service.js'
import {
  createMenuCategorySchema,
  createMenuItemSchema,
  updateMenuCategorySchema,
  updateMenuItemSchema,
} from './menu.schemas.js'
import { readTenantId, requireTenantId } from '../tenants/tenants.module.js'

export async function registerMenuRoutes(app: FastifyInstance, menuService: MenuService): Promise<void> {
  app.get('/menu/categories', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const categories = await menuService.listCategories(tenantId)
    return { categories }
  })

  app.post('/menu/categories', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    const input = createMenuCategorySchema.parse(request.body)
    const category = await menuService.createCategory(tenantId, input)
    return reply.code(201).send({ category })
  })

  app.patch('/menu/categories/:id', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { id } = request.params as { id: string }
    const input = updateMenuCategorySchema.parse(request.body)
    const category = await menuService.updateCategory(tenantId, id, input)
    return { category }
  })

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

  app.patch('/menu/items/:id', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { id } = request.params as { id: string }
    const input = updateMenuItemSchema.parse(request.body)
    const item = await menuService.update(tenantId, id, input)
    return { item }
  })

  app.delete('/menu/items/:id', { onRequest: [app.authenticate] }, async (request) => {
    const tenantId = requireTenantId(request)
    const { id } = request.params as { id: string }
    const item = await menuService.deactivate(tenantId, id)
    return { item }
  })
}
