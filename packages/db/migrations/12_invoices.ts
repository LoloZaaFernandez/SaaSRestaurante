import type { MigrationBuilder } from 'node-pg-migrate'

export function up(pgm: MigrationBuilder): void {
  pgm.createTable('invoices', {
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
      onDelete: 'CASCADE',
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'orders(id)',
      onDelete: 'RESTRICT',
    },
    comprobante_type: { type: 'text', notNull: true },
    serie: { type: 'text', notNull: true },
    numero: { type: 'integer', notNull: true },
    customer_doc: { type: 'text' },
    customer_doc_number: { type: 'text' },
    customer_name: { type: 'text' },
    subtotal: { type: 'numeric(12,2)', notNull: true, default: 0 },
    tax: { type: 'numeric(12,2)', notNull: true, default: 0 },
    tip: { type: 'numeric(12,2)', notNull: true, default: 0 },
    total: { type: 'numeric(12,2)', notNull: true },
    tax_rate: { type: 'numeric(4,2)', notNull: true, default: 18.0 },
    status: { type: 'text', notNull: true, default: 'emitted' },
    voided_reason: { type: 'text' },
    issued_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'RESTRICT',
    },
    printed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createConstraint('invoices', 'invoices_comprobante_type_check', {
    check: "comprobante_type IN ('boleta','factura')",
  })

  pgm.createConstraint('invoices', 'invoices_status_check', {
    check: "status IN ('emitted','voided')",
  })

  pgm.createConstraint('invoices', 'invoices_branch_serie_numero_unique', {
    unique: ['branch_id', 'serie', 'numero'],
  })

  pgm.createIndex('invoices', 'tenant_id')
}

export function down(pgm: MigrationBuilder): void {
  pgm.dropConstraint('invoices', 'invoices_branch_serie_numero_unique')
  pgm.dropConstraint('invoices', 'invoices_status_check')
  pgm.dropConstraint('invoices', 'invoices_comprobante_type_check')
  pgm.dropTable('invoices')
}