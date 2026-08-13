import type { MenuItem } from "@/lib/api";

export default function MenuItemRow({ item }: Readonly<{ item: MenuItem }>) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <div className="min-w-0">
        <p className="font-medium text-stone-900">{item.name}</p>
        <p className="truncate text-sm text-stone-500">{item.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`h-2 w-2 rounded-full ${item.available ? "bg-emerald-500" : "bg-stone-300"}`}
          title={item.available ? "Disponible" : "No disponible"}
          aria-hidden="true"
        />
        <span className="text-sm font-semibold text-stone-900">${item.price.toLocaleString("es-AR")}</span>
      </div>
    </li>
  );
}