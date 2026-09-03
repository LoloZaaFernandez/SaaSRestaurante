import { z } from 'zod'
import { moneySchema, shiftMovementTypeSchema, shiftSchema, shiftMovementSchema } from '@saasrestaurante/contracts'

export { moneySchema, shiftSchema, shiftMovementSchema, shiftMovementTypeSchema }
export type { Shift, ShiftMovement, ShiftMovementType } from '@saasrestaurante/contracts'

export const openShiftSchema = z.object({
  branchId: z.string().uuid(),
  openingCash: moneySchema,
})

export const closeShiftSchema = z.object({ closingCash: moneySchema })
export const createMovementSchema = z.object({
  type: shiftMovementTypeSchema,
  amount: moneySchema,
  description: z.string().min(1).max(200),
})

export type OpenShift = z.infer<typeof openShiftSchema>
export type CloseShift = z.infer<typeof closeShiftSchema>
export type CreateMovement = z.infer<typeof createMovementSchema>
