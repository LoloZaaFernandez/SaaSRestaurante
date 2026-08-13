import type { OrderKitchenStatus } from './orders.schemas.js'

export const KITCHEN_FLOW: OrderKitchenStatus[] = ['pending', 'preparing', 'ready', 'served']

export function canTransition(current: OrderKitchenStatus, next: OrderKitchenStatus): boolean {
  return KITCHEN_FLOW.indexOf(next) === KITCHEN_FLOW.indexOf(current) + 1
}