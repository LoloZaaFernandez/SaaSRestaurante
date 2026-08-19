import type { FastifyInstance } from 'fastify'
import { menuService } from '../menu/menu.service.js'
import { InMemoryOrderRepository, OrderService } from './orders.service.js'
import { registerOrderRoutes } from './orders.routes.js'

export interface OrdersModuleDeps {
  orderService?: OrderService
}

export function createOrdersModule(deps: OrdersModuleDeps = {}) {
  const orderService =
    deps.orderService ?? new OrderService(menuService.repository, new InMemoryOrderRepository())
  return async function register(app: FastifyInstance): Promise<void> {
    await registerOrderRoutes(app, orderService)
  }
}

export const register = createOrdersModule()