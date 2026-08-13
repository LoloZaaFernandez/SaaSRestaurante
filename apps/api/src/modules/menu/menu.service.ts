import type { Pool } from 'pg'
import { queryOne, withTenant } from '../../shared/db.js'
import { AppError } from '../../shared/errors.js'
import type { CreateMenuItemInput, MenuItem } from './menu.schemas.js'

interface MenuItemRow {
  id: string
  tenant_id: string
  category_id: string
  name: string
  description: string | null
  price: string
  active: boolean
  sort_order: number
}

function mapItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: row.price,
    active: row.active,
    sortOrder: row.sort_order,
  }
}

export class MenuService {
  constructor(private readonly pool: Pool) {}

  async list(tenantId: string): Promise<MenuItem[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<MenuItemRow>(
        `SELECT id, tenant_id, category_id, name, description, price, active, sort_order
         FROM menu_items WHERE active = true
         ORDER BY sort_order, name`,
      )
      return result.rows.map(mapItem)
    })
  }

  async findById(tenantId: string, id: string): Promise<MenuItem | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const row = await queryOne<MenuItemRow>(
        client,
        `SELECT id, tenant_id, category_id, name, description, price, active, sort_order
         FROM menu_items WHERE id = $1`,
        [id],
      )
      return row ? mapItem(row) : null
    })
  }

  async create(tenantId: string, input: CreateMenuItemInput): Promise<MenuItem> {
    return withTenant(this.pool, tenantId, async (client) => {
      const category = await queryOne<{ id: string }>(
        client,
        'SELECT id FROM menu_categories WHERE id = $1',
        [input.categoryId],
      )
      if (!category) {
        throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Menu category not found')
      }
      const result = await client.query<MenuItemRow>(
        `INSERT INTO menu_items (tenant_id, category_id, name, description, price, active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, tenant_id, category_id, name, description, price, active, sort_order`,
        [tenantId, input.categoryId, input.name, input.description, input.price, input.active, input.sortOrder],
      )
      return mapItem(result.rows[0]!)
    })
  }
}