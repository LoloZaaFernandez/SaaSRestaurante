import type { FastifyInstance } from 'fastify'
import { AuthService } from './auth.service.js'
import { registerAuthRoutes } from './auth.routes.js'

export interface AuthModuleDeps {
  authService?: AuthService
}

export function createAuthModule(deps: AuthModuleDeps = {}) {
  const authService = deps.authService ?? new AuthService()
  return async function register(app: FastifyInstance): Promise<void> {
    await registerAuthRoutes(app, authService)
  }
}

export const register = createAuthModule()

export type { AuthService, AuthUser, PublicUser } from './auth.service.js'