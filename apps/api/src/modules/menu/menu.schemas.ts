import { z } from 'zod'
import { menuItemSchema, moneySchema } from '@saasrestaurante/contracts'

export { menuItemSchema, moneySchema }

export const createMenuItemSchema = menuItemSchema
  .omit({ id: true, tenantId: true })
  .extend({
    description: z.string().nullable().default(null),
    active: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })

export type MenuItem = z.infer<typeof menuItemSchema>
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>