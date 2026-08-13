import type { FastifyRequest } from 'fastify'
import { AppError } from '../../shared/errors.js'

interface TenantPayload {
  tenantId?: string
}

export function readTenantId(request: FastifyRequest): string | null {
  const user = request.user as TenantPayload | undefined
  if (!user || typeof user.tenantId !== 'string' || user.tenantId.length === 0) {
    return null
  }
  return user.tenantId
}

export function requireTenantId(request: FastifyRequest): string {
  const tenantId = readTenantId(request)
  if (!tenantId) {
    throw new AppError(403, 'FORBIDDEN', 'Missing or invalid tenant context')
  }
  return tenantId
}

// Root-level onRequest hook: populates request.user from a valid Bearer token so
// routes that rely on readTenantId work. Registered on the root instance in app.ts
// because Fastify scopes hooks inside plugins to that plugin's routes only.
export async function attachTenantContext(request: FastifyRequest): Promise<void> {
  const authorization = request.headers.authorization
  if (!authorization) {
    return
  }
  try {
    await request.jwtVerify()
  } catch {
    // invalid or expired token: public routes continue unauthenticated
  }
}