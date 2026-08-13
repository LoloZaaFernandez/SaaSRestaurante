import { z } from 'zod'
import {
  createOrderSchema,
  orderItemSchema,
  orderKitchenStatusSchema,
  orderSchema,
  orderStatusSchema,
  paymentMethodSchema,
  paymentSchema,
  moneySchema,
  type CreateOrder,
  type Order,
  type OrderItem,
  type OrderItemModifier,
  type OrderItemInput,
  type OrderKitchenStatus,
  type OrderStatus,
  type Payment,
  type PaymentMethod,
} from '@saasrestaurante/contracts'

export {
  createOrderSchema,
  orderItemSchema,
  orderKitchenStatusSchema,
  orderSchema,
  orderStatusSchema,
  paymentMethodSchema,
  paymentSchema,
}
export type {
  CreateOrder,
  Order,
  OrderItem,
  OrderItemModifier,
  OrderItemInput,
  OrderKitchenStatus,
  OrderStatus,
  Payment,
  PaymentMethod,
}

export const createPaymentSchema = z.object({
  method: paymentMethodSchema,
  amount: moneySchema,
  tip: moneySchema.default('0.00'),
  amountReceived: moneySchema.nullable().optional(),
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

export const setKitchenStatusSchema = z.object({
  status: orderKitchenStatusSchema,
})

export type SetKitchenStatusInput = z.infer<typeof setKitchenStatusSchema>

export interface KitchenOrder extends Order {
  tableLabel: string | null
  elapsedSeconds: number
}