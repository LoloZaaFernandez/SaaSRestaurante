import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.addColumns('order_items', {
    notes: { type: 'text' },
  })
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumns('order_items', ['notes'])
}