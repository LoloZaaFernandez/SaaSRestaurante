import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import fastifyJwt from '@fastify/jwt'
import { randomUUID } from 'node:crypto'
import { config } from './shared/config.js'
import { buildLoggerOptions } from './shared/logger.js'
import { createPool } from './shared/db.js'
import { errorHandler, notFoundHandler } from './shared/errors.js'
import { attachTenantContext } from './modules/tenants/index.js'
import { createHealthModule } from './modules/health/index.js'
import { createAuthModule } from './modules/auth/index.js'
import { createMenuModule } from './modules/menu/index.js'
import { createOrdersModule } from './modules/orders/index.js'
import { createInvoicesModule } from './modules/invoices/index.js'
import { createKdsModule } from './modules/kds/index.js'

export interface AuthPayload {
  sub: string
  email: string
  tenantId: string
  role: string
  fullName: string
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

export interface BuildAppOptions {
  databaseUrl?: string
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: buildLoggerOptions(),
    genReqId: () => randomUUID(),
  })

  const pool = createPool(opts.databaseUrl ?? config.DATABASE_URL)

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

  // Error handlers must be set BEFORE plugin registration: Fastify captures them
  // into encapsulated plugin contexts at build time, so setting them after the
  // modules register silently leaves every module route on the default handler.
  app.setNotFoundHandler(notFoundHandler)
  app.setErrorHandler(errorHandler)

  // Root-level hook so bearer tokens resolve a tenant context for every route.
  app.addHook('onRequest', attachTenantContext)

  await app.register(async function registerRequestId(instance) {
    instance.addHook('onSend', (request, reply, payload) => {
      reply.header('x-request-id', request.id)
      return payload
    })
  })

  await app.register(createHealthModule({ pool }))
  await app.register(createAuthModule({ pool }))
  await app.register(createMenuModule({ pool }))
  await app.register(createOrdersModule({ pool }))
  await app.register(createInvoicesModule({ pool }))
  await app.register(createKdsModule({ pool }))

  app.addHook('onClose', async () => {
    await pool.end()
  })

  return app
}