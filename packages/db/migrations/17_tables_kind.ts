import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('tables', {
    kind: { type: 'text', notNull: true, default: 'mesa' },
  })

  pgm.createConstraint('tables', 'tables_kind_check', {
    check: "kind IN ('mesa','barra')",
  })
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('tables', 'tables_kind_check')
  pgm.dropColumns('tables', ['kind'])
}