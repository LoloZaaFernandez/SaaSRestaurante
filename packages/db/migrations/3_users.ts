import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: 'tenants(id)',
      onDelete: 'CASCADE',
    },
    email: { type: 'citext', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    full_name: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true, default: 'waiter' },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createConstraint('users', 'users_role_check', {
    check: "role IN ('owner','admin','waiter','kitchen','cashier')",
  })

  pgm.createIndex('users', 'tenant_id')
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('users', 'users_role_check')
  pgm.dropTable('users')
}