import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import fastifyJwt from '@fastify/jwt'
import { randomUUID } from 'node:crypto'
import { config } from './shared/config.js'
import { buildLoggerOptions } from './shared/logger.js'
import { errorHandler, notFoundHandler } from './shared/errors.js'
import { register as registerTenants } from './modules/tenants/index.js'
import { register as registerHealth } from './modules/health/index.js'
import { register as registerAuth } from './modules/auth/index.js'
import { register as registerMenu } from './modules/menu/index.js'
import { register as registerOrders } from './modules/orders/index.js'

export interface AuthPayload {
  sub: string
  email: string
  tenantId: string
  role: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthPayload
    user: AuthPayload
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: buildLoggerOptions(),
    genReqId: () => randomUUID(),
  })

  await app.register(cors, { origin: true })
  await app.register(sensible)
  await app.register(fastifyJwt, { secret: config.JWT_SECRET })

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      request.log.warn({ err }, 'jwt verification failed')
      await reply.code(401).send({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired token',
      })
    }
  })

  await app.register(async function registerRequestId(instance) {
    instance.addHook('onSend', (request, reply, payload) => {
      reply.header('x-request-id', request.id)
      return payload
    })
  })

  await app.register(registerTenants)
  await app.register(registerHealth)
  await app.register(registerAuth)
  await app.register(registerMenu)
  await app.register(registerOrders)

  app.setNotFoundHandler(notFoundHandler)
  app.setErrorHandler(errorHandler)

  return app
}