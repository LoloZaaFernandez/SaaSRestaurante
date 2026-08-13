import { randomUUID } from 'node:crypto'
import { AppError } from '../../shared/errors.js'
import type { MenuItemRepository } from '../menu/menu.service.js'
import type { CreateOrderInput, OrderModifier } from './orders.schemas.js'

export type OrderStatus = 'OPEN' | 'PAID' | 'CANCELLED'

export interface OrderLineSnapshot {
  menuItemId: string
  itemName: string
  unitPrice: string
  quantity: number
  modifiers: OrderModifier[]
  lineTotal: string
}

export interface Order {
  id: string
  tenantId: string
  status: OrderStatus
  lines: OrderLineSnapshot[]
  total: string
  notes?: string
  createdAt: string
}

export interface OrderRepository {
  list(tenantId: string): Promise<Order[]>
  create(order: Order): Promise<Order>
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>()

  async list(tenantId: string): Promise<Order[]> {
    return [...this.orders.values()].filter((order) => order.tenantId === tenantId)
  }

  async create(order: Order): Promise<Order> {
    this.orders.set(order.id, order)
    return order
  }
}

function toMinorUnits(amount: string): number {
  const [whole = '0', fraction = ''] = amount.split('.')
  const wholeMinor = Number.parseInt(whole, 10) * 100
  const fractionMinor = Number.parseInt(fraction.padEnd(2, '0').slice(0, 2), 10)
  return wholeMinor + (Number.isNaN(fractionMinor) ? 0 : fractionMinor)
}

function fromMinorUnits(minor: number): string {
  const whole = Math.floor(minor / 100)
  const fraction = String(minor % 100).padStart(2, '0')
  return `${whole}.${fraction}`
}

function addMoney(a: string, b: string): string {
  return fromMinorUnits(toMinorUnits(a) + toMinorUnits(b))
}

function multiplyMoneyByQuantity(unitPrice: string, quantity: number): string {
  return fromMinorUnits(toMinorUnits(unitPrice) * quantity)
}

export class OrderService {
  constructor(
    private readonly menuRepository: MenuItemRepository,
    private readonly orderRepository: OrderRepository = new InMemoryOrderRepository(),
  ) {}

  async list(tenantId: string): Promise<Order[]> {
    return this.orderRepository.list(tenantId)
  }

  async create(tenantId: string, input: CreateOrderInput): Promise<Order> {
    const lines: OrderLineSnapshot[] = []
    let total = '0.00'

    for (const line of input.items) {
      const menuItem = await this.menuRepository.findById(line.menuItemId)
      if (!menuItem) {
        throw new AppError(404, 'MENU_ITEM_NOT_FOUND', `Menu item not found: ${line.menuItemId}`)
      }

      const modifiers = line.modifiers ?? []
      let lineTotal = multiplyMoneyByQuantity(menuItem.price, line.quantity)
      for (const modifier of modifiers) {
        if (modifier.price !== undefined) {
          lineTotal = addMoney(lineTotal, multiplyMoneyByQuantity(modifier.price, modifier.quantity))
        }
      }
      total = addMoney(total, lineTotal)

      lines.push({
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPrice: menuItem.price,
        quantity: line.quantity,
        modifiers,
        lineTotal,
      })
    }

    const order: Order = {
      id: `ord_${randomUUID()}`,
      tenantId,
      status: 'OPEN',
      lines,
      total,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    }

    return this.orderRepository.create(order)
  }
}