import { Pool } from 'pg'
import { config } from './config.js'

/**
 * Pool de conexiones a PostgreSQL compartido por todos los módulos de la API.
 *
 * La API se conecta con el rol `saas_app` (no superusuario) de forma intencional:
 * así queda sujeta a Row Level Security. El aislamiento por tenant se establece por
 * transacción con `set_app_tenant(tenant_id)` (ver `modules/analytics/analytics.repository.ts`).
 */
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  // Errores en clientes ociosos: sin conexiones activas no hay forma de manejarlos
  // por request, así que se loguean. No debe romper el proceso.
  console.error('Unexpected error on idle database client', err)
})
