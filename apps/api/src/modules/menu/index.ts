import type { FastifyInstance } from 'fastify'
import type { MenuService } from './menu.service.js'
import { menuService as defaultMenuService } from './menu.service.js'
import { registerMenuRoutes } from './menu.routes.js'

export interface MenuModuleDeps {
  menuService?: MenuService
}

export function createMenuModule(deps: MenuModuleDeps = {}) {
  const menuService = deps.menuService ?? defaultMenuService
  return async function register(app: FastifyInstance): Promise<void> {
    await registerMenuRoutes(app, menuService)
  }
}

export const register = createMenuModule()