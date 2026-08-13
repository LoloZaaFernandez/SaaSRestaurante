import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('orders', {
    subtotal: { type: 'numeric(12,2)', notNull: true, default: 0 },
    tax: { type: 'numeric(12,2)', notNull: true, default: 0 },
    total: { type: 'numeric(12,2)', notNull: true, default: 0 },
    tip: { type: 'numeric(12,2)', notNull: true, default: 0 },
    kitchen_status: { type: 'text', notNull: true, default: 'pending' },
    waiter_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
  })

  pgm.createConstraint('orders', 'orders_kitchen_status_check', {
    check: "kitchen_status IN ('pending','preparing','ready','served')",
  })
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('orders', 'orders_kitchen_status_check')
  pgm.dropColumns('orders', ['subtotal', 'tax', 'total', 'tip', 'kitchen_status', 'waiter_id'])
}