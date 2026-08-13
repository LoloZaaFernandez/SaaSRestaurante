import type { Pool, PoolClient } from 'pg'
import { queryOne, withTenant } from '../../shared/db.js'

export type UserRole = 'owner' | 'admin' | 'waiter' | 'kitchen' | 'cashier'

export interface UserRow {
  id: string
  tenantId: string
  email: string
  passwordHash: string
  fullName: string
  role: UserRole
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateUserInput {
  tenantId: string
  email: string
  passwordHash: string
  fullName: string
  role: UserRole
}

export type NewUserInput = Omit<CreateUserInput, 'tenantId'>

interface UsersTableRow {
  id: string
  tenant_id: string
  email: string
  password_hash: string
  full_name: string
  role: string
  active: boolean
  created_at: Date
  updated_at: Date
}

function mapUser(row: UsersTableRow, includePassword = false): UserRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    ...(includePassword ? { passwordHash: row.password_hash } : { passwordHash: '' }),
    fullName: row.full_name,
    role: row.role as UserRole,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

const MAP_USER_COLUMNS = `id, tenant_id, email, password_hash, full_name, role, active, created_at, updated_at`

export class UsersRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const result = await this.pool.query<AuthLookupRow>('SELECT * FROM auth_find_user_by_email($1)', [
      email,
    ])
    const row = result.rows[0]
    if (!row) return null
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      role: row.role as UserRole,
      active: row.active,
      createdAt: '',
      updatedAt: '',
    }
  }

  async findById(id: string, tenantId: string): Promise<UserRow | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const row = await queryOne<UsersTableRow>(
        client,
        `SELECT ${MAP_USER_COLUMNS} FROM users WHERE id = $1`,
        [id],
      )
      return row ? mapUser(row) : null
    })
  }

  async createInTenant(tenantId: string, input: NewUserInput): Promise<UserRow> {
    return withTenant(this.pool, tenantId, async (client) =>
      this.insertUser(client, { ...input, tenantId }),
    )
  }

  private async insertUser(client: PoolClient, input: CreateUserInput): Promise<UserRow> {
    const result = await client.query<UsersTableRow>(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING ${MAP_USER_COLUMNS}`,
      [input.tenantId, input.email, input.passwordHash, input.fullName, input.role],
    )
    return mapUser(result.rows[0]!)
  }
}

interface AuthLookupRow {
  id: string
  tenant_id: string
  email: string
  password_hash: string
  full_name: string
  role: string
  active: boolean
}