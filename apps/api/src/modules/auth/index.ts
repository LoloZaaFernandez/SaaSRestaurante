import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { UsersRepository } from './users.repository.js'
import { AuthService } from './auth.service.js'
import { registerAuthRoutes } from './auth.routes.js'

export interface AuthModuleDeps {
  pool: Pool
}

export function createAuthModule({ pool }: AuthModuleDeps) {
  const usersRepository = new UsersRepository(pool)
  const authService = new AuthService(usersRepository)
  return async function register(app: FastifyInstance): Promise<void> {
    await registerAuthRoutes(app, authService)
  }
}

export type { AuthService, PublicUser } from './auth.service.js'
export type { UserRole, UserRow } from './users.repository.js'