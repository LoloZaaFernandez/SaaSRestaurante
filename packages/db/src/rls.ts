import 'dotenv/config'
import { pool, query } from './client.js'

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

const TENANT_TABLES = [
  'users',
  'branches',
  'menu_categories',
  'menu_items',
  'modifier_groups',
  'modifiers',
  'menu_item_modifiers',
  'tables',
  'orders',
  'order_items',
  'payments',
  'shifts',
]

async function applyRls(): Promise<void> {
  await query(`
    CREATE OR REPLACE FUNCTION get_tenant_id() RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
    $$;

    CREATE OR REPLACE FUNCTION set_app_tenant(p_tenant_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
      SELECT set_config('app.tenant_id', p_tenant_id::text, true)
    $$;
  `)

  for (const table of TENANT_TABLES) {
    await query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
    for (const policy of [
      `${table}_rls_select`,
      `${table}_rls_insert`,
      `${table}_rls_update`,
      `${table}_rls_delete`,
    ]) {
      await query(`DROP POLICY IF EXISTS ${policy} ON ${table}`)
    }
    await query(
      `CREATE POLICY ${table}_rls_select ON ${table} FOR SELECT USING (tenant_id = get_tenant_id())`,
    )
    await query(
      `CREATE POLICY ${table}_rls_insert ON ${table} FOR INSERT WITH CHECK (tenant_id = get_tenant_id())`,
    )
    await query(
      `CREATE POLICY ${table}_rls_update ON ${table} FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id())`,
    )
    await query(
      `CREATE POLICY ${table}_rls_delete ON ${table} FOR DELETE USING (tenant_id = get_tenant_id())`,
    )
  }

  await query('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY')
  await query('DROP POLICY IF EXISTS tenants_rls_select ON tenants')
  await query('DROP POLICY IF EXISTS tenants_rls_insert ON tenants')
  await query('DROP POLICY IF EXISTS tenants_rls_update ON tenants')
  await query('DROP POLICY IF EXISTS tenants_rls_delete ON tenants')
  await query(
    'CREATE POLICY tenants_rls_select ON tenants FOR SELECT USING (id = get_tenant_id())',
  )
  await query(
    'CREATE POLICY tenants_rls_insert ON tenants FOR INSERT WITH CHECK (get_tenant_id() IS NULL)',
  )
  await query(
    'CREATE POLICY tenants_rls_update ON tenants FOR UPDATE USING (id = get_tenant_id()) WITH CHECK (id = get_tenant_id())',
  )
  await query(
    'CREATE POLICY tenants_rls_delete ON tenants FOR DELETE USING (id = get_tenant_id())',
  )
}

async function verify(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_app_tenant($1)`, [TENANT_ID])
    const result = await client.query<{ tenant_ok: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM tenants WHERE id = $1) AS tenant_ok`,
      [TENANT_ID],
    )
    await client.query('COMMIT')
    console.log(`RLS policies applied and tenant context verified for ${TENANT_ID}`)
    console.log(`  tenant visible with context: ${result.rows[0]?.tenant_ok ?? false}`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

applyRls()
  .then(() => verify())
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })