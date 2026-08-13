import Link from "next/link";
import StatCard from "@/components/StatCard";

const stats = [
  { label: "Ventas hoy", value: "$1.284.500", hint: "+12% vs. ayer", positive: true },
  { label: "Pedidos abiertos", value: "23", hint: "8 mesas en servicio", positive: true },
  { label: "Ocupación", value: "68%", hint: "Pico esperado 21:00", positive: true },
  { label: "Ticket promedio", value: "$18.400", hint: "Últ. 7 días: $16.900", positive: true },
];

const quickLinks = [
  { href: "/menu", title: "Gestión de Menú", description: "Categorías, ítems y precios del catálogo." },
  { href: "/tables", title: "Plano de Mesas", description: "Estado y distribución actual del salón." },
  { href: "/orders", title: "Toma de Pedido", description: "Armá y cobrá pedidos en tiempo real." },
] as const;

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Dashboard Administrativo</h1>
        <p className="mt-1 text-sm text-stone-500">Resumen operativo del día de hoy.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} positive={stat.positive} />
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-stone-900">Accesos rápidos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow"
            >
              <p className="font-semibold text-stone-900">{link.title}</p>
              <p className="mt-1 text-sm text-stone-500">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}