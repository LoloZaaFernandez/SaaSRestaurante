import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export interface ErrorResponse {
  statusCode: number
  code: string
  message: string
  details?: unknown
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const response: ErrorResponse = {
    statusCode: 404,
    code: 'ROUTE_NOT_FOUND',
    message: `Route ${request.method} ${request.url} not found`,
  }
  return reply.code(404).send(response)
}

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  let response: ErrorResponse

  if (error instanceof AppError) {
    response = {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }
  } else if (error instanceof ZodError) {
    response = {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  } else {
    request.log.error({ err: error }, 'unhandled error')
    response = {
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    }
  }

  reply.code(response.statusCode).send(response)
}