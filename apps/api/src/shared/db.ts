import 'dotenv/config'
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

export type Queryable = Pick<PoolClient, 'query'>

export function createPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30_000,
    max: 10,
  })

  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err)
  })

  return pool
}

export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

export async function withTenant<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(pool, async (client) => {
    await client.query('SELECT set_app_tenant($1)', [tenantId])
    return fn(client)
  })
}

export async function queryOne<R extends QueryResultRow>(
  client: Queryable,
  text: string,
  params?: unknown[],
): Promise<R | null> {
  const result: QueryResult<R> = await client.query(text, params ?? [])
  return result.rows[0] ?? null
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  )
}

export function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23503'
  )
}