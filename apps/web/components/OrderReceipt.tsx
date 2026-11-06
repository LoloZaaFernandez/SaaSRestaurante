import type { OrderDto } from "@/lib/api";
import { formatAdjustment, formatMoney } from "@/lib/money";

type OrderReceiptProps = {
  order: OrderDto;
  tableLabel: string;
  waiterName: string;
};

export function shortOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** Detalle de un pedido tal como lo devolvió el servidor (ítems, snapshots de modificadores, notas y totales). */
export default function OrderReceipt({ order, tableLabel, waiterName }: OrderReceiptProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        {tableLabel} · Mesero: {waiterName}
      </p>
      <ul className="divide-y divide-stone-100">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900">
                {item.quantity} × {item.name}
              </p>
              {item.modifiers.map((modifier) => (
                <p key={modifier.modifierId} className="text-xs text-stone-500">
                  + {modifier.name}
                  {formatAdjustment(modifier.priceAdjustment) && ` (${formatAdjustment(modifier.priceAdjustment)})`}
                </p>
              ))}
              {item.notes && <p className="text-xs italic text-stone-500">Nota: {item.notes}</p>}
            </div>
            <span className="shrink-0 text-sm font-semibold text-stone-900">{formatMoney(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-stone-100 pt-3 text-sm">
        <div className="flex justify-between text-stone-500">
          <dt>Subtotal</dt>
          <dd>{formatMoney(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-stone-500">
          <dt>IGV (18 %)</dt>
          <dd>{formatMoney(order.tax)}</dd>
        </div>
        <div className="flex justify-between text-stone-900">
          <dt className="font-medium">Total</dt>
          <dd className="font-semibold">{formatMoney(order.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
