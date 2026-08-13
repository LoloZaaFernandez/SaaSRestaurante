import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { MenuService } from './menu.service.js'
import { registerMenuRoutes } from './menu.routes.js'

export interface MenuModuleDeps {
  pool: Pool
}

export function createMenuModule({ pool }: MenuModuleDeps) {
  const menuService = new MenuService(pool)
  return async function register(app: FastifyInstance): Promise<void> {
    await registerMenuRoutes(app, menuService)
  }
}

export type { MenuService } from './menu.service.js'