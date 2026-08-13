type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
};

export default function StatCard({ label, value, hint, positive = true }: StatCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{value}</p>
      {hint ? (
        <p className={`mt-2 text-xs font-medium ${positive ? "text-emerald-600" : "text-rose-600"}`}>{hint}</p>
      ) : null}
    </div>
  );
}