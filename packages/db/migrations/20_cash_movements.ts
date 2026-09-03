import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('payments', {
    shift_id: { type: 'uuid', references: 'shifts(id)', onDelete: 'SET NULL' },
  })
  pgm.createTable('shift_movements', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants(id)', onDelete: 'CASCADE' },
    shift_id: { type: 'uuid', notNull: true, references: 'shifts(id)', onDelete: 'CASCADE' },
    type: { type: 'text', notNull: true },
    amount: { type: 'numeric(12,2)', notNull: true },
    description: { type: 'text', notNull: true },
    created_by: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'RESTRICT' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
  pgm.addConstraint('shift_movements', 'shift_movements_type_check', { check: "type IN ('income','expense')" })
  pgm.addConstraint('shift_movements', 'shift_movements_amount_check', { check: 'amount > 0' })
  pgm.createIndex('shift_movements', 'tenant_id')
  pgm.createIndex('shift_movements', 'shift_id')
  pgm.sql(`
    CREATE UNIQUE INDEX shifts_one_open_per_branch_idx ON shifts (tenant_id, branch_id) WHERE closed_at IS NULL;
    ALTER TABLE shift_movements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shift_movements FORCE ROW LEVEL SECURITY;
    CREATE POLICY shift_movements_rls_select ON shift_movements FOR SELECT USING (tenant_id = get_tenant_id());
    CREATE POLICY shift_movements_rls_insert ON shift_movements FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
    CREATE POLICY shift_movements_rls_update ON shift_movements FOR UPDATE USING (tenant_id = get_tenant_id()) WITH CHECK (tenant_id = get_tenant_id());
    CREATE POLICY shift_movements_rls_delete ON shift_movements FOR DELETE USING (tenant_id = get_tenant_id());
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_movements TO saas_app;
  `)
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP POLICY IF EXISTS shift_movements_rls_select ON shift_movements;
    DROP POLICY IF EXISTS shift_movements_rls_insert ON shift_movements;
    DROP POLICY IF EXISTS shift_movements_rls_update ON shift_movements;
    DROP POLICY IF EXISTS shift_movements_rls_delete ON shift_movements;
    DROP INDEX IF EXISTS shifts_one_open_per_branch_idx;
  `)
  pgm.dropConstraint('shift_movements', 'shift_movements_amount_check')
  pgm.dropConstraint('shift_movements', 'shift_movements_type_check')
  pgm.dropTable('shift_movements')
  pgm.dropColumns('payments', ['shift_id'])
}
