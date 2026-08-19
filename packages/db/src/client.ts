import 'dotenv/config'
import { Pool, type QueryResult, type QueryResultRow } from 'pg'

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://saas:saas@localhost:5432/saas_restaurante'

export const pool = new Pool({ connectionString })

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err)
})

export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<R>> {
  return pool.query<R, unknown[]>(text, params ?? [])
}