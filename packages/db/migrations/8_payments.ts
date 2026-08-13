import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('payments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: 'orders(id)',
      onDelete: 'RESTRICT',
    },
    method: { type: 'text', notNull: true },
    amount: { type: 'numeric(12,2)', notNull: true },
    tip: { type: 'numeric(12,2)', notNull: true, default: 0 },
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createConstraint('payments', 'payments_method_check', {
    check: "method IN ('cash','card','transfer')",
  })

  pgm.createIndex('payments', 'tenant_id')
  pgm.createIndex('payments', 'order_id')
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('payments', 'payments_method_check')
  pgm.dropTable('payments')
}