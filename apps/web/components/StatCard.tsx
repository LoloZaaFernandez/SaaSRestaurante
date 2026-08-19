type StatCardProps = {
  label: string;
  value?: string;
  hint?: string;
  positive?: boolean;
  /** Mientras está en true se muestra un skeleton de carga en lugar del valor. */
  loading?: boolean;
};

export default function StatCard({ label, value, hint, positive = true, loading = false }: StatCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-stone-500">{label}</p>

      {loading ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-7 w-24 animate-pulse rounded-md bg-stone-200" />
          {hint ? <div className="h-3 w-16 animate-pulse rounded bg-stone-100" /> : null}
        </div>
      ) : (
        <>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{value}</p>
          {hint ? (
            <p className={`mt-2 text-xs font-medium ${positive ? "text-emerald-600" : "text-rose-600"}`}>{hint}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
