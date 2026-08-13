import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('orders', {
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
      onDelete: 'RESTRICT',
    },
    table_id: {
      type: 'uuid',
      references: 'tables(id)',
      onDelete: 'SET NULL',
    },
    status: { type: 'text', notNull: true, default: 'open' },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'RESTRICT',
    },
    opened_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    closed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createConstraint('orders', 'orders_status_check', {
    check: "status IN ('open','paid','cancelled')",
  })

  pgm.createTable('order_items', {
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
      onDelete: 'CASCADE',
    },
    menu_item_id: {
      type: 'uuid',
      references: 'menu_items(id)',
      onDelete: 'SET NULL',
    },
    name: { type: 'varchar(255)', notNull: true },
    unit_price: { type: 'numeric(12,2)', notNull: true },
    quantity: { type: 'integer', notNull: true },
    line_total: { type: 'numeric(12,2)', notNull: true },
    modifiers: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createConstraint('order_items', 'order_items_quantity_positive', {
    check: 'quantity > 0',
  })

  pgm.createIndex('orders', 'tenant_id')
  pgm.createIndex('orders', 'branch_id')
  pgm.createIndex('orders', 'table_id')
  pgm.createIndex('orders', 'opened_at')
  pgm.createIndex('order_items', 'tenant_id')
  pgm.createIndex('order_items', 'order_id')
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('order_items', 'order_items_quantity_positive')
  pgm.dropTable('order_items')
  pgm.dropConstraint('orders', 'orders_status_check')
  pgm.dropTable('orders')
}