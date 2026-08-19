import { z } from 'zod'
import { menuCategorySchema, menuItemSchema, modifierGroupSchema, moneySchema } from '@saasrestaurante/contracts'

export { menuCategorySchema, menuItemSchema, modifierGroupSchema, moneySchema }

export const createMenuCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  position: z.number().int().min(0).default(0),
})

export const updateMenuCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided')

export const createModifierGroupSchema = modifierGroupSchema
  .omit({ id: true, tenantId: true })
  .extend({
    name: z.string().trim().min(1).max(80),
  })

export const assignModifierGroupsSchema = z.object({
  modifierGroupIds: z.array(z.string().uuid()),
})

export const createMenuItemSchema = menuItemSchema
  .omit({ id: true, tenantId: true })
  .extend({
    description: z.string().nullable().default(null),
    active: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })

export const updateMenuItemSchema = z
  .object({
    name: z.string().min(1).optional(),
    price: moneySchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided')

export type MenuItem = z.infer<typeof menuItemSchema>
export type MenuCategory = z.infer<typeof menuCategorySchema>
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>
export type ModifierGroup = z.infer<typeof modifierGroupSchema>
export type CreateModifierGroupInput = z.infer<typeof createModifierGroupSchema>
export type AssignModifierGroupsInput = z.infer<typeof assignModifierGroupsSchema>
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>
