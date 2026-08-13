import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { loginSchema } from '@saasrestaurante/contracts'
import type { AuthService } from './auth.service.js'
import { AppError } from '../../shared/errors.js'
import { config } from '../../shared/config.js'
import { requireTenantId } from '../tenants/tenants.module.js'

const staffRoleSchema = z.enum(['waiter', 'kitchen', 'cashier'])

const registerStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  role: staffRoleSchema,
})

const USER_CREATOR_ROLES = new Set(['owner', 'admin'])

export async function registerAuthRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const user = await authService.authenticate(body.email, body.password)
    const token = app.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        fullName: user.fullName,
      },
      { expiresIn: config.JWT_EXPIRES_IN },
    )
    return reply.code(200).send({ token, user })
  })

  app.post('/auth/register', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tenantId = requireTenantId(request)
    if (!USER_CREATOR_ROLES.has(request.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Only the owner or an admin can create users')
    }
    const body = registerStaffSchema.parse(request.body)
    const user = await authService.registerInTenant(tenantId, body)
    return reply.code(201).send({ user })
  })

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = await authService.findById(request.user.sub, request.user.tenantId)
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists')
    }
    return { user: authService.toPublic(user) }
  })
}