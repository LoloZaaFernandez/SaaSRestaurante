import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO saas_app;
  `)
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    REVOKE ALL PRIVILEGES ON invoices FROM saas_app;
  `)
}