import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createExtension('uuid-ossp', { ifNotExists: true })
  pgm.createExtension('pgcrypto', { ifNotExists: true })
  pgm.createExtension('citext', { ifNotExists: true })
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropExtension('citext', { ifExists: true, cascade: true })
  pgm.dropExtension('pgcrypto', { ifExists: true, cascade: true })
  pgm.dropExtension('uuid-ossp', { ifExists: true, cascade: true })
}