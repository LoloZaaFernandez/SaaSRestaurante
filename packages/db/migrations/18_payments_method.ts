import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.dropConstraint('payments', 'payments_method_check')
  pgm.addConstraint('payments', 'payments_method_check', {
    check: "method IN ('cash','card','transfer','yape','plin')",
  })

  pgm.addColumns('payments', {
    amount_received: { type: 'numeric(12,2)' },
    change: { type: 'numeric(12,2)' },
  })
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropColumns('payments', ['amount_received', 'change'])

  pgm.dropConstraint('payments', 'payments_method_check')
  pgm.addConstraint('payments', 'payments_method_check', {
    check: "method IN ('cash','card','transfer')",
  })
}