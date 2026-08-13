import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { OrdersRepository } from '../orders/orders.repository.js'
import { registerKdsRoutes } from './kds.routes.js'

export interface KdsModuleDeps {
  pool: Pool
}

export function createKdsModule({ pool }: KdsModuleDeps) {
  const ordersRepository = new OrdersRepository(pool)
  return async function register(app: FastifyInstance): Promise<void> {
    await registerKdsRoutes(app, ordersRepository)
  }
}