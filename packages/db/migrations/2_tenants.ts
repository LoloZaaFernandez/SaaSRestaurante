import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('tenants', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'citext', notNull: true },
    slug: { type: 'citext', notNull: true, unique: true },
    status: { type: 'text', notNull: true, default: 'active' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createConstraint('tenants', 'tenants_status_check', {
    check: "status IN ('active','suspended','cancelled')",
  })
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('tenants', 'tenants_status_check')
  pgm.dropTable('tenants')
}