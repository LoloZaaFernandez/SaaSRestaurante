import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('menu_categories', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    position: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('menu_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    category_id: {
      type: 'uuid',
      notNull: true,
      references: 'menu_categories(id)',
      onDelete: 'RESTRICT',
    },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    price: { type: 'numeric(12,2)', notNull: true },
    active: { type: 'boolean', notNull: true, default: true },
    sort_order: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('modifier_groups', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    required: { type: 'boolean', notNull: true, default: false },
    min: { type: 'integer', notNull: true, default: 0 },
    max: { type: 'integer', notNull: true, default: 1 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('modifiers', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    group_id: {
      type: 'uuid',
      notNull: true,
      references: 'modifier_groups(id)',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    price_adjustment: { type: 'numeric(12,2)', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createConstraint('modifier_groups', 'modifier_groups_min_max_check', {
    check: 'min >= 0 AND max >= min',
  })

  pgm.createTable('menu_item_modifiers', {
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    menu_item_id: {
      type: 'uuid',
      notNull: true,
      primaryKey: true,
      references: 'menu_items(id)',
      onDelete: 'CASCADE',
    },
    modifier_group_id: {
      type: 'uuid',
      notNull: true,
      primaryKey: true,
      references: 'modifier_groups(id)',
      onDelete: 'CASCADE',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createIndex('menu_categories', 'tenant_id')
  pgm.createIndex('menu_items', 'tenant_id')
  pgm.createIndex('menu_items', 'category_id')
  pgm.createIndex('modifier_groups', 'tenant_id')
  pgm.createIndex('modifiers', 'group_id')
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('modifier_groups', 'modifier_groups_min_max_check')
  pgm.dropTable('menu_item_modifiers')
  pgm.dropTable('modifiers')
  pgm.dropTable('modifier_groups')
  pgm.dropTable('menu_items')
  pgm.dropTable('menu_categories')
}