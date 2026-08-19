export type Bar = {
  label: string;
  value: number;
  display: string;
};

type BarChartProps = {
  bars: Bar[];
  /** Orientación horizontal (barras apiladas en filas); por defecto vertical. */
  horizontal?: boolean;
  /** Escala máxima manual; por defecto el máximo de los valores (mínimo 1). */
  max?: number;
  /** Mensaje cuando no hay datos que graficar. */
  empty?: string;
};

/**
 * Gráfico de barras liviano (divs + Tailwind, sin librerías).
 * Vertical para series largas (hora pico, día de la semana) y horizontal
 * para listas cortas con etiquetas largas (top ítems).
 */
export default function BarChart({ bars, horizontal = false, max, empty = "Sin datos para el período." }: BarChartProps) {
  if (bars.length === 0) {
    return <p className="py-8 text-center text-sm text-stone-400">{empty}</p>;
  }

  const peak = max ?? Math.max(1, ...bars.map((b) => b.value));

  if (horizontal) {
    return (
      <ul className="space-y-3">
        {bars.map((bar) => (
          <li key={bar.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm font-medium text-stone-700" title={bar.label}>
              {bar.label}
            </span>
            <div className="h-5 flex-1 overflow-hidden rounded-md bg-stone-100">
              <div
                className="flex h-full items-center justify-end rounded-md bg-amber-400 px-2"
                style={{ width: `${Math.min(100, Math.max(bar.value > 0 ? 4 : 0, (bar.value / peak) * 100))}%` }}
              >
                <span className="text-xs font-semibold text-stone-900">{bar.display}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex h-48 items-end gap-1 sm:gap-2">
      {bars.map((bar) => (
        <div key={bar.label} className="group flex h-full min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-stone-400 opacity-0 transition group-hover:opacity-100">
            {bar.display}
          </span>
          <div className="flex w-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-9 rounded-t-md bg-amber-400 transition group-hover:bg-amber-500"
              style={{ height: `${(bar.value / peak) * 100}%` }}
              title={`${bar.label}: ${bar.display}`}
            />
          </div>
          <span className="truncate text-[10px] text-stone-500">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}