import type { MigrationBuilder } from 'node-pg-migrate'

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

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE FUNCTION get_tenant_id() RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
    $$;

    CREATE FUNCTION set_app_tenant(p_tenant_id uuid) RETURNS void
    LANGUAGE sql
    AS $$
      SELECT set_config('app.tenant_id', p_tenant_id::text, true)
    $$;
  `)

  const tenantTables = TENANT_TABLES.map((t) => `'${t}'`).join(', ')
  pgm.sql(`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOREACH t IN ARRAY ARRAY[${tenantTables}] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (tenant_id = get_tenant_id())', t || '_rls_select', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (tenant_id = get_tenant_id())', t || '_rls_insert', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id())', t || '_rls_update', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (tenant_id = get_tenant_id())', t || '_rls_delete', t);
      END LOOP;
    END
    $$;
  `)

  pgm.sql(`
    ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenants_rls_select ON tenants FOR SELECT USING (id = get_tenant_id());
    CREATE POLICY tenants_rls_insert ON tenants FOR INSERT WITH CHECK (get_tenant_id() IS NULL);
    CREATE POLICY tenants_rls_update ON tenants FOR UPDATE USING (id = get_tenant_id()) WITH CHECK (id = get_tenant_id());
    CREATE POLICY tenants_rls_delete ON tenants FOR DELETE USING (id = get_tenant_id());
  `)
}

export function down(pgm: MigrationBuilder): void {
  const tenantTables = [...TENANT_TABLES, 'tenants'].map((t) => `'${t}'`).join(', ')
  pgm.sql(`
    DO $$
    DECLARE
      t text;
    BEGIN
      FOREACH t IN ARRAY ARRAY[${tenantTables}] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_rls_select', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_rls_insert', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_rls_update', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_rls_delete', t);
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
      END LOOP;
    END
    $$;

    DROP FUNCTION IF EXISTS set_app_tenant(uuid);
    DROP FUNCTION IF EXISTS get_tenant_id();
  `)
}