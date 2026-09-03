import type { Pool, PoolClient } from 'pg'
import { AppError } from '../../shared/errors.js'
import { queryOne, withTenant } from '../../shared/db.js'
import { fromCents, toCents } from '../../shared/money.js'
import type { Shift, ShiftMovement, ShiftMovementType } from './shifts.schemas.js'

type ShiftRow = { id: string; tenant_id: string; branch_id: string; opened_by: string; opened_at: Date; closed_at: Date | null; opening_cash: string; closing_cash: string | null; expected_total: string | null }
type MovementRow = { id: string; tenant_id: string; shift_id: string; type: ShiftMovementType; amount: string; description: string; created_by: string; created_at: Date }
const SHIFT_COLUMNS = 'id, tenant_id, branch_id, opened_by, opened_at, closed_at, opening_cash, closing_cash, expected_total'

function mapShift(row: ShiftRow): Shift {
  return { id: row.id, tenantId: row.tenant_id, branchId: row.branch_id, openedBy: row.opened_by, openedAt: row.opened_at.toISOString(), closedAt: row.closed_at?.toISOString() ?? null, openingCash: row.opening_cash, closingCash: row.closing_cash, expectedTotal: row.expected_total }
}
function mapMovement(row: MovementRow): ShiftMovement {
  return { id: row.id, tenantId: row.tenant_id, shiftId: row.shift_id, type: row.type, amount: row.amount, description: row.description, createdBy: row.created_by, createdAt: row.created_at.toISOString() }
}

async function expectedCash(client: PoolClient, shiftId: string, openingCash: string): Promise<string> {
  const payments = await queryOne<{ total: string }>(client, `SELECT COALESCE(SUM(amount + tip), 0)::numeric(12,2) AS total FROM payments WHERE shift_id = $1 AND method = 'cash'`, [shiftId])
  const movements = await client.query<{ type: ShiftMovementType; total: string }>(
    'SELECT type, COALESCE(SUM(amount), 0)::numeric(12,2) AS total FROM shift_movements WHERE shift_id = $1 GROUP BY type',
    [shiftId],
  )
  return fromCents(toCents(openingCash) + toCents(payments?.total ?? '0.00') + movements.rows.reduce((sum, row) => sum + (row.type === 'income' ? toCents(row.total) : -toCents(row.total)), 0))
}

export class ShiftsRepository {
  constructor(private readonly pool: Pool) {}

  async getCurrent(tenantId: string, branchId?: string): Promise<Shift | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ShiftRow>(`SELECT ${SHIFT_COLUMNS} FROM shifts WHERE closed_at IS NULL ${branchId ? 'AND branch_id = $1' : ''} ORDER BY opened_at DESC LIMIT 1`, branchId ? [branchId] : [])
      return result.rows[0] ? mapShift(result.rows[0]) : null
    })
  }

  async open(tenantId: string, input: { branchId: string; openingCash: string }, userId: string): Promise<Shift> {
    return withTenant(this.pool, tenantId, async (client) => {
      const branch = await queryOne<{ id: string }>(client, 'SELECT id FROM branches WHERE id = $1 AND is_active = true', [input.branchId])
      if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found')
      const existing = await queryOne<{ id: string }>(client, 'SELECT id FROM shifts WHERE branch_id = $1 AND closed_at IS NULL', [input.branchId])
      if (existing) throw new AppError(409, 'SHIFT_ALREADY_OPEN', 'A shift is already open for this branch')
      const result = await client.query<ShiftRow>(`INSERT INTO shifts (tenant_id, branch_id, opened_by, opening_cash) VALUES ($1, $2, $3, $4) RETURNING ${SHIFT_COLUMNS}`, [tenantId, input.branchId, userId, input.openingCash])
      return mapShift(result.rows[0]!)
    })
  }

  async close(tenantId: string, shiftId: string, closingCash: string): Promise<Shift> {
    return withTenant(this.pool, tenantId, async (client) => {
      const shift = await queryOne<ShiftRow>(client, `SELECT ${SHIFT_COLUMNS} FROM shifts WHERE id = $1 FOR UPDATE`, [shiftId])
      if (!shift) throw new AppError(404, 'SHIFT_NOT_FOUND', 'Shift not found')
      if (shift.closed_at) throw new AppError(409, 'SHIFT_ALREADY_CLOSED', 'Shift is already closed')
      const expected = await expectedCash(client, shiftId, shift.opening_cash)
      const result = await client.query<ShiftRow>(`UPDATE shifts SET closed_at = now(), closing_cash = $1, expected_total = $2 WHERE id = $3 RETURNING ${SHIFT_COLUMNS}`, [closingCash, expected, shiftId])
      return mapShift(result.rows[0]!)
    })
  }

  async listMovements(tenantId: string, shiftId: string): Promise<ShiftMovement[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<MovementRow>('SELECT id, tenant_id, shift_id, type, amount, description, created_by, created_at FROM shift_movements WHERE shift_id = $1 ORDER BY created_at DESC', [shiftId])
      return result.rows.map(mapMovement)
    })
  }

  async addMovement(tenantId: string, shiftId: string, input: { type: ShiftMovementType; amount: string; description: string }, userId: string): Promise<ShiftMovement> {
    return withTenant(this.pool, tenantId, async (client) => {
      const shift = await queryOne<{ id: string }>(client, 'SELECT id FROM shifts WHERE id = $1 AND closed_at IS NULL', [shiftId])
      if (!shift) throw new AppError(409, 'SHIFT_NOT_OPEN', 'Shift is not open')
      const result = await client.query<MovementRow>('INSERT INTO shift_movements (tenant_id, shift_id, type, amount, description, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, tenant_id, shift_id, type, amount, description, created_by, created_at', [tenantId, shiftId, input.type, input.amount, input.description, userId])
      return mapMovement(result.rows[0]!)
    })
  }
}
