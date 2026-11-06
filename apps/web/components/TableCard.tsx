import type { Route } from "next";
import Link from "next/link";

export type TableStatus = "free" | "occupied" | "reserved" | "cleaning";

export type TableCardProps = {
  label: string;
  seats: number;
  status: TableStatus;
  /** Si se pasa, la tarjeta ofrece un acceso directo para tomar un pedido en esa mesa. */
  orderHref?: string;
};

const STATUS_LABEL: Record<TableStatus, string> = {
  free: "Libre",
  occupied: "Ocupada",
  reserved: "Reservada",
  cleaning: "Limpieza",
};

const STATUS_DOT: Record<TableStatus, string> = {
  free: "bg-emerald-500",
  occupied: "bg-amber-500",
  reserved: "bg-sky-500",
  cleaning: "bg-stone-400",
};

const STATUS_BADGE: Record<TableStatus, string> = {
  free: "bg-emerald-100 text-emerald-700",
  occupied: "bg-amber-100 text-amber-700",
  reserved: "bg-sky-100 text-sky-700",
  cleaning: "bg-stone-200 text-stone-600",
};

export const TABLE_LEGEND = (Object.keys(STATUS_DOT) as TableStatus[]).map((status) => ({
  status,
  label: STATUS_LABEL[status],
  dotClass: STATUS_DOT[status],
}));

export default function TableCard({ label, seats, status, orderHref }: TableCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-stone-900">{label}</p>
      <p className="text-sm text-stone-500">{seats} comensales</p>
      {orderHref && (
        <Link
          href={orderHref as Route}
          className="mt-3 inline-block rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
        >
          Tomar pedido
        </Link>
      )}
    </div>
  );
}