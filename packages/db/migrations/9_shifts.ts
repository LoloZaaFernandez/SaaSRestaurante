import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('shifts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    branch_id: {
      type: 'uuid',
      notNull: true,
      references: 'branches(id)',
      onDelete: 'CASCADE',
    },
    opened_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'RESTRICT',
    },
    opened_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    closed_at: { type: 'timestamptz' },
    opening_cash: { type: 'numeric(12,2)', notNull: true, default: 0 },
    closing_cash: { type: 'numeric(12,2)' },
    expected_total: { type: 'numeric(12,2)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createIndex('shifts', 'tenant_id')
  pgm.createIndex('shifts', 'branch_id')
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropTable('shifts')
}