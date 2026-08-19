import { z } from 'zod'

export const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a decimal with up to 2 places')

export const tenantStatusSchema = z.enum(['active', 'suspended', 'cancelled'])

export const userRoleSchema = z.enum(['owner', 'admin', 'waiter', 'kitchen', 'cashier'])

export const tableStatusSchema = z.enum(['free', 'occupied', 'reserved', 'cleaning'])

export const orderStatusSchema = z.enum(['open', 'paid', 'cancelled'])

export const paymentMethodSchema = z.enum(['cash', 'card', 'transfer'])

export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: tenantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const createTenantSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case'),
  adminEmail: z.string().email().min(1),
  adminFullName: z.string().min(1),
})

export const loginSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
})

export const userSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  fullName: z.string().min(1),
  role: userRoleSchema,
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const branchSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  isActive: z.boolean(),
})

export const menuCategorySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  position: z.number().int().min(0),
})

export const menuItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  price: moneySchema,
  active: z.boolean(),
  sortOrder: z.number().int().min(0),
})

export const modifierGroupSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  required: z.boolean(),
  min: z.number().int().min(0),
  max: z.number().int().min(1),
})

export const modifierSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  groupId: z.string().uuid(),
  name: z.string().min(1),
  priceAdjustment: moneySchema,
})

export const tableSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  label: z.string().min(1),
  seats: z.number().int().min(1),
  status: tableStatusSchema,
})

export const orderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  modifiers: z.array(z.string().uuid()).default([]),
})

export const createOrderSchema = z.object({
  branchId: z.string().uuid(),
  tableId: z.string().uuid().nullish(),
  items: z.array(orderItemInputSchema).min(1),
})

export const orderItemModifierSnapshotSchema = z.object({
  modifierId: z.string().uuid(),
  name: z.string().min(1),
  priceAdjustment: moneySchema,
})

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  menuItemId: z.string().uuid().nullable(),
  name: z.string().min(1),
  unitPrice: moneySchema,
  quantity: z.number().int().positive(),
  lineTotal: moneySchema,
  modifiers: z.array(orderItemModifierSnapshotSchema).default([]),
})

export const orderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  tableId: z.string().uuid().nullable(),
  status: orderStatusSchema,
  createdBy: z.string().uuid(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  items: z.array(orderItemSchema).default([]),
})

export const paymentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  method: paymentMethodSchema,
  amount: moneySchema,
  tip: moneySchema.default('0.00'),
  receivedAt: z.string().datetime(),
})

export const shiftSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  openedBy: z.string().uuid(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  openingCash: moneySchema,
  closingCash: moneySchema.nullable(),
  expectedTotal: moneySchema.nullable(),
})

export type Money = z.infer<typeof moneySchema>
export type Tenant = z.infer<typeof tenantSchema>
export type CreateTenant = z.infer<typeof createTenantSchema>
export type Login = z.infer<typeof loginSchema>
export type TenantStatus = z.infer<typeof tenantStatusSchema>
export type User = z.infer<typeof userSchema>
export type UserRole = z.infer<typeof userRoleSchema>
export type Branch = z.infer<typeof branchSchema>
export type MenuCategory = z.infer<typeof menuCategorySchema>
export type MenuItem = z.infer<typeof menuItemSchema>
export type ModifierGroup = z.infer<typeof modifierGroupSchema>
export type Modifier = z.infer<typeof modifierSchema>
export type Table = z.infer<typeof tableSchema>
export type TableStatus = z.infer<typeof tableStatusSchema>
export type Order = z.infer<typeof orderSchema>
export type OrderItem = z.infer<typeof orderItemSchema>
export type OrderItemModifier = z.infer<typeof orderItemModifierSnapshotSchema>
export type OrderItemInput = z.infer<typeof orderItemInputSchema>
export type CreateOrder = z.infer<typeof createOrderSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
export type Payment = z.infer<typeof paymentSchema>
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type Shift = z.infer<typeof shiftSchema>