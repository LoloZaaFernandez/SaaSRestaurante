import type { Pool } from 'pg'
import { queryOne, withTenant } from '../../shared/db.js'
import { AppError } from '../../shared/errors.js'
import type {
  CreateMenuCategoryInput,
  CreateMenuItemInput,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  CreateModifierGroupInput,
  AssignModifierGroupsInput,
  UpdateMenuCategoryInput,
  UpdateMenuItemInput,
} from './menu.schemas.js'

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

interface MenuCategoryRow {
  id: string
  tenant_id: string
  name: string
  position: number
}

interface ModifierGroupRow {
  id: string
  tenant_id: string
  name: string
  required: boolean
  min: number
  max: number
}

function mapModifierGroup(row: ModifierGroupRow): ModifierGroup {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    required: row.required,
    min: row.min,
    max: row.max,
  }
}

function mapCategory(row: MenuCategoryRow): MenuCategory {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    position: row.position,
  }
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

  async listCategories(tenantId: string): Promise<MenuCategory[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<MenuCategoryRow>(
        `SELECT id, tenant_id, name, position
         FROM menu_categories
         ORDER BY position, name`,
      )
      return result.rows.map(mapCategory)
    })
  }

  async listModifierGroups(tenantId: string): Promise<ModifierGroup[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ModifierGroupRow>(
        `SELECT id, tenant_id, name, required, min, max
         FROM modifier_groups
         ORDER BY name`,
      )
      return result.rows.map(mapModifierGroup)
    })
  }

  async createModifierGroup(tenantId: string, input: CreateModifierGroupInput): Promise<ModifierGroup> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<ModifierGroupRow>(
        `INSERT INTO modifier_groups (tenant_id, name, required, min, max)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, tenant_id, name, required, min, max`,
        [tenantId, input.name, input.required, input.min, input.max],
      )
      return mapModifierGroup(result.rows[0]!)
    })
  }

  async assignModifierGroups(tenantId: string, itemId: string, input: AssignModifierGroupsInput): Promise<void> {
    return withTenant(this.pool, tenantId, async (client) => {
      const item = await queryOne<{ id: string }>(
        client,
        'SELECT id FROM menu_items WHERE id = $1',
        [itemId],
      )
      if (!item) {
        throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found')
      }
      if (input.modifierGroupIds.length > 0) {
        const groups = await client.query<{ id: string }>(
          'SELECT id FROM modifier_groups WHERE id = ANY($1::uuid[])',
          [input.modifierGroupIds],
        )
        if (groups.rowCount !== input.modifierGroupIds.length) {
          throw new AppError(404, 'MODIFIER_GROUP_NOT_FOUND', 'Modifier group not found')
        }
      }
      await client.query('DELETE FROM menu_item_modifiers WHERE menu_item_id = $1', [itemId])
      for (const groupId of input.modifierGroupIds) {
        await client.query(
          `INSERT INTO menu_item_modifiers (tenant_id, menu_item_id, modifier_group_id)
           VALUES ($1, $2, $3)`,
          [tenantId, itemId, groupId],
        )
      }
    })
  }

  async createCategory(tenantId: string, input: CreateMenuCategoryInput): Promise<MenuCategory> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<MenuCategoryRow>(
        `INSERT INTO menu_categories (tenant_id, name, position)
         VALUES ($1, $2, $3)
         RETURNING id, tenant_id, name, position`,
        [tenantId, input.name, input.position],
      )
      return mapCategory(result.rows[0]!)
    })
  }

  async updateCategory(tenantId: string, id: string, input: UpdateMenuCategoryInput): Promise<MenuCategory> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<MenuCategoryRow>(
        `UPDATE menu_categories
         SET name = COALESCE($3, name),
             position = COALESCE($4, position),
             updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, tenant_id, name, position`,
        [id, tenantId, input.name ?? null, input.position ?? null],
      )
      const row = result.rows[0]
      if (!row) {
        throw new AppError(404, 'MENU_CATEGORY_NOT_FOUND', 'Menu category not found')
      }
      return mapCategory(row)
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

  async update(tenantId: string, id: string, input: UpdateMenuItemInput): Promise<MenuItem> {
    return withTenant(this.pool, tenantId, async (client) => {
      const result = await client.query<MenuItemRow>(
        `UPDATE menu_items
         SET name = COALESCE($3, name),
             price = COALESCE($4, price),
             active = COALESCE($5, active),
             updated_at = now()
         WHERE id = $1 AND tenant_id = $2
         RETURNING id, tenant_id, category_id, name, description, price, active, sort_order`,
        [id, tenantId, input.name ?? null, input.price ?? null, input.active ?? null],
      )
      const row = result.rows[0]
      if (!row) {
        throw new AppError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found')
      }
      return mapItem(row)
    })
  }

  async deactivate(tenantId: string, id: string): Promise<MenuItem> {
    return this.update(tenantId, id, { active: false })
  }
}
