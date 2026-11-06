import type { Pool, PoolClient } from 'pg'
import { AppError } from '../../shared/errors.js'
import { addMoney, applyTax, fromCents, multiplyByQuantity, toCents } from '../../shared/money.js'
import { queryOne, withTenant } from '../../shared/db.js'
import { canTransition } from './kitchen-status.js'
import type {
  CreateOrder,
  KitchenOrder,
  Order,
  OrderItem,
  OrderItemModifier,
  OrderItemInput,
  OrderKitchenStatus,
  OrderStatus,
  Payment,
  PaymentMethod,
} from './orders.schemas.js'

interface OrderRow {
  id: string
  tenant_id: string
  branch_id: string
  table_id: string | null
  status: OrderStatus
  kitchen_status: OrderKitchenStatus
  created_by: string
  waiter_id: string | null
  subtotal: string
  tax: string
  total: string
  tip: string
  opened_at: Date
  closed_at: Date | null
}

interface OrderItemRow {
  id: string
  order_id: string
  menu_item_id: string | null
  name: string
  unit_price: string
  quantity: number
  line_total: string
  modifiers: OrderItemModifier[]
  notes: string | null
}

interface PaymentRow {
  id: string
  tenant_id: string
  order_id: string
  method: PaymentMethod
  amount: string
  tip: string
  amount_received: string | null
  change: string | null
  received_at: Date
}

const ORDER_COLUMNS = `id, tenant_id, branch_id, table_id, status, kitchen_status, created_by, waiter_id,
  subtotal, tax, total, tip, opened_at, closed_at`

const ORDER_COLUMNS_PREFIXED = ORDER_COLUMNS.split(',')
  .map((column) => `o.${column.trim()}`)
  .join(', ')

const ORDER_ITEM_COLUMNS = `id, order_id, menu_item_id, name, unit_price, quantity, line_total, modifiers, notes`

function mapOrder(row: OrderRow): Omit<Order, 'items'> {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    tableId: row.table_id,
    status: row.status,
    kitchenStatus: row.kitchen_status,
    createdBy: row.created_by,
    waiterId: row.waiter_id,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    tip: row.tip,
    openedAt: row.opened_at.toISOString(),
    closedAt: row.closed_at ? row.closed_at.toISOString() : null,
  }
}

function mapItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    menuItemId: row.menu_item_id,
    name: row.name,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    lineTotal: row.line_total,
    modifiers: row.modifiers ?? [],
    notes: row.notes,
  }
}

function toOrder(order: ReturnType<typeof mapOrder>, items: OrderItem[]): Order {
  return { ...order, items }
}

interface ResolvedMenuItem {
  id: string
  name: string
  price: string
  active: boolean
}

interface ResolvedModifier {
  id: string
  groupId: string
  name: string
  priceAdjustment: string
}

interface ResolvedModifierGroup {
  id: string
  name: string
  required: boolean
  min: number
  max: number
}

export class OrdersRepository {
  constructor(private readonly pool: Pool) {}

  async createOrder(
    tenantId: string,
    input: CreateOrder,
    createdBy: string,
  ): Promise<Order> {
    return withTenant(this.pool, tenantId, async (client) => {
      await assertBranchAndTable(client, input.branchId, input.tableId)
      const waiterId = await resolveWaiter(client, input.waiterId, createdBy)

      const lines = []
      for (const item of input.items) {
        lines.push(await this.resolveLine(client, item))
      }

      const subtotal = addMoney(lines.map((line) => line.lineTotal))
      const tax = applyTax(subtotal)
      const total = addMoney([subtotal, tax])

      const orderResult = await client.query<OrderRow>(
        `INSERT INTO orders (tenant_id, branch_id, table_id, created_by, waiter_id, subtotal, tax, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${ORDER_COLUMNS}`,
        [tenantId, input.branchId, input.tableId ?? null, createdBy, waiterId, subtotal, tax, total],
      )
      const order = orderResult.rows[0]!

      const items: OrderItem[] = []
      for (const line of lines) {
        const itemResult = await client.query<OrderItemRow>(
          `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, unit_price, quantity, line_total, modifiers, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING ${ORDER_ITEM_COLUMNS}`,
          [
            tenantId,
            order.id,
            line.menuItemId,
            line.name,
            line.unitPrice,
            line.quantity,
            line.lineTotal,
            JSON.stringify(line.modifiers),
            line.notes,
          ],
        )
        items.push(mapItem(itemResult.rows[0]!))
      }

      return toOrder(mapOrder(order), items)
    })
  }

  async addItem(
    orderId: string,
    tenantId: string,
    input: OrderItemInput,
  ): Promise<Order> {
    return withTenant(this.pool, tenantId, async (client) => {
      const order = await this.lockOrder(client, orderId)
      assertOpen(order)

      const line = await this.resolveLine(client, input)

      const existing = await queryOne<{ id: string; quantity: number }>(
        client,
        `SELECT id, quantity FROM order_items
         WHERE order_id = $1 AND menu_item_id = $2 AND modifiers = $3::jsonb
           AND notes IS NOT DISTINCT FROM $4::text`,
        [orderId, line.menuItemId, JSON.stringify(line.modifiers), line.notes],
      )

      if (existing) {
        const quantity = existing.quantity + line.quantity
        const lineTotal = multiplyByQuantity(line.unitPrice, quantity)
        await client.query(
          `UPDATE order_items SET quantity = $1, line_total = $2 WHERE id = $3`,
          [quantity, lineTotal, existing.id],
        )
      } else {
        await client.query(
          `INSERT INTO order_items (tenant_id, order_id, menu_item_id, name, unit_price, quantity, line_total, modifiers, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tenantId,
            orderId,
            line.menuItemId,
            line.name,
            line.unitPrice,
            line.quantity,
            line.lineTotal,
            JSON.stringify(line.modifiers),
            line.notes,
          ],
        )
      }

      return this.reloadWithOrder(client, order)
    })
  }

  async listOrders(
    tenantId: string,
    filters: { branchId?: string; status?: OrderStatus; limit?: number } = {},
  ): Promise<Order[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      // Cancelled orders are hidden by default; they are only returned when asked for explicitly.
      const conditions: string[] = []
      const params: unknown[] = []
      if (!filters.status) {
        conditions.push(`status <> 'cancelled'`)
      }
      if (filters.branchId) {
        params.push(filters.branchId)
        conditions.push(`branch_id = $${params.length}`)
      }
      if (filters.status) {
        params.push(filters.status)
        conditions.push(`status = $${params.length}`)
      }
      const result = await client.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM orders
         ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY opened_at DESC${filters.limit ? ` LIMIT ${Math.trunc(filters.limit)}` : ''}`,
        params,
      )
      const orders = result.rows.map((row) => mapOrder(row))
      const items = await this.fetchItemsForOrders(client, orders.map((o) => o.id))
      const itemsByOrder = new Map<string, OrderItem[]>()
      for (const item of items) {
        const list = itemsByOrder.get(item.orderId) ?? []
        list.push(item)
        itemsByOrder.set(item.orderId, list)
      }
      return orders.map((order) => toOrder(order, itemsByOrder.get(order.id) ?? []))
    })
  }

  async getOrder(orderId: string, tenantId: string): Promise<Order | null> {
    return withTenant(this.pool, tenantId, async (client) => {
      const row = await queryOne<OrderRow>(
        client,
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`,
        [orderId],
      )
      if (!row) return null
      const items = await this.fetchItems(client, orderId)
      return toOrder(mapOrder(row), items)
    })
  }

  async updateStatus(
    orderId: string,
    tenantId: string,
    status: OrderStatus,
  ): Promise<Order> {
    return withTenant(this.pool, tenantId, async (client) => {
      const order = await this.lockOrder(client, orderId)

      if (order.status === status) {
        return this.reloadWithOrder(client, order)
      }

      if (order.status === 'paid') {
        throw new AppError(409, 'ORDER_ALREADY_PAID', 'Order has already been paid')
      }
      if (order.status === 'cancelled') {
        throw new AppError(409, 'ORDER_CANCELLED', 'Order has already been cancelled')
      }
      if (status === 'open') {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Order is already open')
      }
      if (status === 'paid' || status === 'cancelled') {
        const closedAt = new Date().toISOString()
        const updated = await client.query<OrderRow>(
          `UPDATE orders SET status = $1, closed_at = $2
           WHERE id = $3
           RETURNING ${ORDER_COLUMNS}`,
          [status, closedAt, orderId],
        )
        return this.reloadWithOrder(client, mapOrder(updated.rows[0]!))
      }
      throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Invalid status transition')
    })
  }

  async setKitchenStatus(
    orderId: string,
    tenantId: string,
    status: OrderKitchenStatus,
  ): Promise<Order> {
    return withTenant(this.pool, tenantId, async (client) => {
      const order = await this.lockOrder(client, orderId)
      assertOpen(order)

      if (!canTransition(order.kitchenStatus, status)) {
        throw new AppError(
          409,
          'INVALID_KITCHEN_TRANSITION',
          `Cannot move order from kitchen status '${order.kitchenStatus}' to '${status}'`,
        )
      }

      const updated = await client.query<OrderRow>(
        `UPDATE orders SET kitchen_status = $1 WHERE id = $2 RETURNING ${ORDER_COLUMNS}`,
        [status, orderId],
      )
      return this.reloadWithOrder(client, mapOrder(updated.rows[0]!))
    })
  }

  async recordPayment(
    orderId: string,
    tenantId: string,
    input: { method: PaymentMethod; amount: string; tip: string; amountReceived?: string | null },
  ): Promise<{ payment: Payment; order: Order }> {
    return withTenant(this.pool, tenantId, async (client) => {
      const order = await this.lockOrder(client, orderId)
      assertOpen(order)

      const amountReceived = input.amountReceived ?? null
      const change =
        amountReceived !== null
          ? fromCents(Math.max(toCents(amountReceived) - toCents(input.amount), 0))
          : null

      const paymentResult = await client.query<PaymentRow>(
        `INSERT INTO payments (tenant_id, order_id, method, amount, tip, amount_received, change)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, tenant_id, order_id, method, amount, tip, amount_received, change, received_at`,
        [tenantId, orderId, input.method, input.amount, input.tip, amountReceived, change],
      )
      const payment = mapPayment(paymentResult.rows[0]!)

      const closedAt = new Date().toISOString()
      const updated = await client.query<OrderRow>(
        `UPDATE orders SET status = 'paid', closed_at = $1, tip = $2, total = subtotal + tax + $2
         WHERE id = $3
         RETURNING ${ORDER_COLUMNS}`,
        [closedAt, input.tip, orderId],
      )

      return { payment, order: await this.reloadWithOrder(client, mapOrder(updated.rows[0]!)) }
    })
  }

  async listKitchenQueue(
    tenantId: string,
    filters: { branchId?: string } = {},
  ): Promise<KitchenOrder[]> {
    return withTenant(this.pool, tenantId, async (client) => {
      const conditions = [
        `o.status = 'open'`,
        `o.kitchen_status IN ('pending', 'preparing', 'ready')`,
      ]
      const params: unknown[] = []
      if (filters.branchId) {
        params.push(filters.branchId)
        conditions.push(`branch_id = $${params.length}`)
      }
      const result = await client.query<
        OrderRow & { table_label: string | null; elapsed_seconds: number }
      >(
        `SELECT ${ORDER_COLUMNS_PREFIXED}, t.label AS table_label,
                EXTRACT(EPOCH FROM (now() - o.opened_at))::int AS elapsed_seconds
         FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY o.opened_at ASC`,
        params,
      )
      const orders = result.rows.map((row) => mapOrder(row))
      const itemsByOrder = new Map<string, OrderItem[]>()
      if (orders.length > 0) {
        for (const item of await this.fetchItemsForOrders(
          client,
          orders.map((o) => o.id),
        )) {
          const list = itemsByOrder.get(item.orderId) ?? []
          list.push(item)
          itemsByOrder.set(item.orderId, list)
        }
      }
      return result.rows.map((row, index) => {
        const order = orders[index]!
        return {
          ...order,
          items: itemsByOrder.get(order.id) ?? [],
          tableLabel: row.table_label,
          elapsedSeconds: row.elapsed_seconds,
        }
      })
    })
  }

  private async resolveLine(
    client: PoolClient,
    item: OrderItemInput,
  ): Promise<{
    menuItemId: string
    name: string
    unitPrice: string
    quantity: number
    lineTotal: string
    modifiers: OrderItemModifier[]
    notes: string | null
  }> {
    const menuItem = await queryOne<ResolvedMenuItem>(
      client,
      `SELECT id, name, price, active FROM menu_items WHERE id = $1`,
      [item.menuItemId],
    )
    if (!menuItem) {
      throw new AppError(404, 'MENU_ITEM_NOT_FOUND', `Menu item not found: ${item.menuItemId}`)
    }
    if (!menuItem.active) {
      throw new AppError(409, 'MENU_ITEM_UNAVAILABLE', `Menu item is not available: ${menuItem.name}`)
    }

    const modifiers = await this.resolveModifiers(client, menuItem, item.modifiers)
    const adjustmentCents = modifiers.reduce((acc, modifier) => acc + toCents(modifier.priceAdjustment), 0)
    const unitPrice = fromCents(toCents(menuItem.price) + adjustmentCents)
    const lineTotal = multiplyByQuantity(unitPrice, item.quantity)

    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal,
      modifiers,
      notes: item.notes ?? null,
    }
  }

  /**
   * Validates the chosen modifier ids against the groups assigned to the menu item
   * (menu_item_modifiers) and each group's required/min/max limits, and returns the
   * snapshots (name + price adjustment at order time) in the order requested.
   */
  private async resolveModifiers(
    client: PoolClient,
    menuItem: ResolvedMenuItem,
    modifierIds: string[],
  ): Promise<OrderItemModifier[]> {
    if (new Set(modifierIds).size !== modifierIds.length) {
      throw new AppError(400, 'DUPLICATE_MODIFIER', `A modifier was selected more than once for ${menuItem.name}`)
    }

    const groupsResult = await client.query<ResolvedModifierGroup>(
      `SELECT g.id, g.name, g.required, g.min, g.max
       FROM menu_item_modifiers mim
       JOIN modifier_groups g ON g.id = mim.modifier_group_id
       WHERE mim.menu_item_id = $1`,
      [menuItem.id],
    )
    const groups = new Map(groupsResult.rows.map((group) => [group.id, group]))

    const selected = new Map<string, ResolvedModifier>()
    if (modifierIds.length > 0) {
      const result = await client.query<ResolvedModifier>(
        `SELECT id, group_id AS "groupId", name, price_adjustment AS "priceAdjustment"
         FROM modifiers WHERE id = ANY($1::uuid[])`,
        [modifierIds],
      )
      for (const row of result.rows) selected.set(row.id, row)
    }

    const countByGroup = new Map<string, number>()
    const snapshots: OrderItemModifier[] = []
    for (const id of modifierIds) {
      const modifier = selected.get(id)
      if (!modifier) {
        throw new AppError(404, 'MODIFIER_NOT_FOUND', `Modifier not found: ${id}`)
      }
      if (!groups.has(modifier.groupId)) {
        throw new AppError(
          400,
          'MODIFIER_NOT_ALLOWED',
          `Modifier "${modifier.name}" is not available for ${menuItem.name}`,
        )
      }
      countByGroup.set(modifier.groupId, (countByGroup.get(modifier.groupId) ?? 0) + 1)
      snapshots.push({ modifierId: modifier.id, name: modifier.name, priceAdjustment: modifier.priceAdjustment })
    }

    for (const group of groups.values()) {
      const count = countByGroup.get(group.id) ?? 0
      const minimum = group.required ? Math.max(group.min, 1) : group.min
      if (count < minimum) {
        throw new AppError(
          400,
          'MODIFIER_GROUP_MIN',
          `${menuItem.name}: choose at least ${minimum} option(s) from "${group.name}"`,
        )
      }
      if (count > group.max) {
        throw new AppError(
          400,
          'MODIFIER_GROUP_MAX',
          `${menuItem.name}: choose at most ${group.max} option(s) from "${group.name}"`,
        )
      }
    }

    return snapshots
  }

  private async lockOrder(client: PoolClient, orderId: string): Promise<Omit<Order, 'items'>> {
    const row = await queryOne<OrderRow>(
      client,
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    )
    if (!row) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
    }
    return mapOrder(row)
  }

  private async reloadWithOrder(
    client: PoolClient,
    order: Omit<Order, 'items'>,
  ): Promise<Order> {
    const items = await this.fetchItems(client, order.id)
    // re-read financials in case a payment updated them
    const fresh = await queryOne<OrderRow>(
      client,
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`,
      [order.id],
    )
    return toOrder(fresh ? mapOrder(fresh) : order, items)
  }

  private async fetchItems(client: PoolClient, orderId: string): Promise<OrderItem[]> {
    const result = await client.query<OrderItemRow>(
      `SELECT ${ORDER_ITEM_COLUMNS} FROM order_items WHERE order_id = $1 ORDER BY created_at`,
      [orderId],
    )
    return result.rows.map(mapItem)
  }

  private async fetchItemsForOrders(
    client: PoolClient,
    orderIds: string[],
  ): Promise<OrderItem[]> {
    if (orderIds.length === 0) return []
    const result = await client.query<OrderItemRow>(
      `SELECT ${ORDER_ITEM_COLUMNS} FROM order_items WHERE order_id = ANY($1::uuid[])`,
      [orderIds],
    )
    return result.rows.map(mapItem)
  }
}

function assertOpen(order: Omit<Order, 'items'>): void {
  if (order.status !== 'open') {
    throw new AppError(409, 'ORDER_CLOSED', `Order is already ${order.status}`)
  }
}

async function assertBranchAndTable(
  client: PoolClient,
  branchId: string,
  tableId: string | null | undefined,
): Promise<void> {
  const branch = await queryOne<{ id: string; is_active: boolean }>(
    client,
    'SELECT id, is_active FROM branches WHERE id = $1',
    [branchId],
  )
  if (!branch) {
    throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found')
  }
  if (!branch.is_active) {
    throw new AppError(409, 'BRANCH_INACTIVE', 'Branch is not active')
  }
  if (tableId) {
    const table = await queryOne<{ id: string; branch_id: string }>(
      client,
      'SELECT id, branch_id FROM tables WHERE id = $1',
      [tableId],
    )
    if (!table) {
      throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found')
    }
    if (table.branch_id !== branchId) {
      throw new AppError(400, 'TABLE_BRANCH_MISMATCH', 'Table does not belong to the selected branch')
    }
  }
}

/**
 * The waiter defaults to the user creating the order (previous behaviour). An explicit
 * waiterId must be an active user of the same tenant (RLS scopes the lookup) with role 'waiter'.
 * Users are not tied to a branch in the schema, so no branch check is possible.
 */
async function resolveWaiter(
  client: PoolClient,
  waiterId: string | null | undefined,
  createdBy: string,
): Promise<string> {
  if (!waiterId || waiterId === createdBy) return createdBy
  const waiter = await queryOne<{ id: string; role: string; active: boolean }>(
    client,
    'SELECT id, role, active FROM users WHERE id = $1',
    [waiterId],
  )
  if (!waiter) {
    throw new AppError(404, 'WAITER_NOT_FOUND', 'Waiter not found')
  }
  if (!waiter.active || waiter.role !== 'waiter') {
    throw new AppError(400, 'INVALID_WAITER', 'The selected user is not an active waiter')
  }
  return waiter.id
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    method: row.method,
    amount: row.amount,
    tip: row.tip,
    amountReceived: row.amount_received,
    change: row.change,
    receivedAt: row.received_at.toISOString(),
  }
}