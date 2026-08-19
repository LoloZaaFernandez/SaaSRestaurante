import TableCard, { TABLE_LEGEND, type TableStatus } from "@/components/TableCard";

type TableSeed = { id: string; number: number; seats: number; status: TableStatus };

const tables: TableSeed[] = [
  { id: "m1", number: 1, seats: 2, status: "free" },
  { id: "m2", number: 2, seats: 2, status: "occupied" },
  { id: "m3", number: 3, seats: 4, status: "reserved" },
  { id: "m4", number: 4, seats: 4, status: "occupied" },
  { id: "m5", number: 5, seats: 6, status: "free" },
  { id: "m6", number: 6, seats: 6, status: "cleaning" },
  { id: "m7", number: 7, seats: 2, status: "occupied" },
  { id: "m8", number: 8, seats: 4, status: "free" },
  { id: "m9", number: 9, seats: 8, status: "reserved" },
  { id: "m10", number: 10, seats: 4, status: "occupied" },
];

export default function TablesPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Plano de Mesas</h1>
        <p className="mt-1 text-sm text-stone-500">Estado actual del salón, por mesa.</p>
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-stone-200 bg-white px-5 py-3 shadow-sm">
        {TABLE_LEGEND.map((entry) => (
          <div key={entry.status} className="flex items-center gap-2 text-sm text-stone-600">
            <span className={`h-2.5 w-2.5 rounded-full ${entry.dotClass}`} aria-hidden="true" />
            {entry.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tables.map((table) => (
          <TableCard key={table.id} number={table.number} seats={table.seats} status={table.status} />
        ))}
      </div>
    </section>
  );
}