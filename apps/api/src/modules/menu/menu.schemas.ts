import { z } from 'zod'

export const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "12.90"')

export const menuItemSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  price: moneySchema,
  category: z.string().min(1),
})

export const createMenuItemSchema = menuItemSchema.omit({ id: true, tenantId: true })

export type MenuItem = z.infer<typeof menuItemSchema>
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>