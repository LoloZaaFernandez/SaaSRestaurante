import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { OrdersRepository } from './orders.repository.js'
import { registerOrderRoutes } from './orders.routes.js'

export interface OrdersModuleDeps {
  pool: Pool
}

export function createOrdersModule({ pool }: OrdersModuleDeps) {
  const ordersRepository = new OrdersRepository(pool)
  return async function register(app: FastifyInstance): Promise<void> {
    await registerOrderRoutes(app, ordersRepository)
  }
}

export type { OrdersRepository } from './orders.repository.js'