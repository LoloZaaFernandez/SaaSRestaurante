import { randomUUID } from 'node:crypto'
import type { CreateMenuItemInput, MenuItem } from './menu.schemas.js'

export interface MenuItemRepository {
  list(tenantId: string): Promise<MenuItem[]>
  findById(id: string): Promise<MenuItem | null>
  create(item: MenuItem): Promise<MenuItem>
}

export class InMemoryMenuItemRepository implements MenuItemRepository {
  private readonly items = new Map<string, MenuItem>()

  async list(tenantId: string): Promise<MenuItem[]> {
    return [...this.items.values()].filter((item) => item.tenantId === tenantId)
  }

  async findById(id: string): Promise<MenuItem | null> {
    return this.items.get(id) ?? null
  }

  async create(item: MenuItem): Promise<MenuItem> {
    this.items.set(item.id, item)
    return item
  }
}

export class MenuService {
  constructor(public readonly repository: MenuItemRepository) {}

  async list(tenantId: string): Promise<MenuItem[]> {
    return this.repository.list(tenantId)
  }

  async create(tenantId: string, input: CreateMenuItemInput): Promise<MenuItem> {
    const item: MenuItem = { ...input, id: `mi_${randomUUID()}`, tenantId }
    return this.repository.create(item)
  }

  async findById(id: string): Promise<MenuItem | null> {
    return this.repository.findById(id)
  }
}

export const menuService = new MenuService(new InMemoryMenuItemRepository())