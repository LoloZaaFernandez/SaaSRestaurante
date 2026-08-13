import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
    CREATE POLICY invoices_rls_select ON invoices FOR SELECT USING (tenant_id = get_tenant_id());
    CREATE POLICY invoices_rls_insert ON invoices FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
    CREATE POLICY invoices_rls_update ON invoices FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());
    CREATE POLICY invoices_rls_delete ON invoices FOR DELETE USING (tenant_id = get_tenant_id());
  `)
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP POLICY IF EXISTS invoices_rls_select ON invoices;
    DROP POLICY IF EXISTS invoices_rls_insert ON invoices;
    DROP POLICY IF EXISTS invoices_rls_update ON invoices;
    DROP POLICY IF EXISTS invoices_rls_delete ON invoices;
    ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
  `)
}