import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AuthService } from './auth.service.js'
import { AppError } from '../../shared/errors.js'

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function registerAuthRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  app.post('/auth/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body)
    const user = await authService.authenticate(body.email, body.password)
    const token = app.jwt.sign({
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    })
    return reply.code(200).send({ token, user })
  })

  app.post('/auth/register', async () => {
    throw new AppError(501, 'NOT_IMPLEMENTED', 'Registration is not implemented yet')
  })

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (request) => {
    return { user: request.user }
  })
}