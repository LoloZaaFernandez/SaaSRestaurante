import { z } from 'zod'
import { moneySchema } from '../menu/menu.schemas.js'

export const orderModifierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: moneySchema.optional(),
  quantity: z.number().int().positive().default(1),
})

export const orderLineSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  modifiers: z.array(orderModifierSchema).optional(),
})

export const createOrderSchema = z.object({
  items: z.array(orderLineSchema).min(1),
  notes: z.string().optional(),
})

export type OrderModifier = z.infer<typeof orderModifierSchema>
export type OrderLineInput = z.infer<typeof orderLineSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>