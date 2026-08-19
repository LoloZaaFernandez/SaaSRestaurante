import type { FastifyServerOptions } from 'fastify'

export function buildLoggerOptions(): NonNullable<FastifyServerOptions['logger']> {
  return {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  }
}