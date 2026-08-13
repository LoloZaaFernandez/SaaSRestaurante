import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saas_app') THEN
        CREATE ROLE saas_app LOGIN PASSWORD 'saas_app';
      END IF;
    END
    $$;

    GRANT CONNECT ON DATABASE saas_restaurante TO saas_app;
    GRANT USAGE ON SCHEMA public TO saas_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO saas_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO saas_app;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO saas_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO saas_app;
  `)
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM saas_app;
    REVOKE USAGE ON SCHEMA public FROM saas_app;
    REVOKE CONNECT ON DATABASE saas_restaurante FROM saas_app;
    DROP ROLE IF EXISTS saas_app;
  `)
}