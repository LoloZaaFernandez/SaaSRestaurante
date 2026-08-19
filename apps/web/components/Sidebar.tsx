"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Menú", href: "/menu" },
  { label: "Mesas", href: "/tables" },
  { label: "Pedidos", href: "/orders" },
  { label: "Caja", href: "/caja" },
  { label: "Ajustes", href: "/ajustes" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-stone-100 px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-white">
          L
        </div>
        <div>
          <p className="text-base font-semibold leading-tight text-stone-900">Lunaris</p>
          <p className="text-xs text-stone-400">Gestión de restaurante</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-amber-50 text-amber-900"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-100 px-5 py-4 text-xs text-stone-400">Lunaris · v0.1.0</div>
    </aside>
  );
}