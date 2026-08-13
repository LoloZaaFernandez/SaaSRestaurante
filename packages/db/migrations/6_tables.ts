import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('tables', {
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
    label: { type: 'text', notNull: true },
    seats: { type: 'integer', notNull: true, default: 4 },
    status: { type: 'text', notNull: true, default: 'free' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createConstraint('tables', 'tables_status_check', {
    check: "status IN ('free','occupied','reserved','cleaning')",
  })

  pgm.createIndex('tables', 'tenant_id')
  pgm.createIndex('tables', 'branch_id')
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('tables', 'tables_status_check')
  pgm.dropTable('tables')
}