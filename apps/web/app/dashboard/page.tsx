"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import { apiFetch, type AnalyticsDashboard, type AnalyticsReport, type AnalyticsTableOccupancy } from "@/lib/api";

type Range = "hoy" | "semana" | "mes";

const RANGES: Record<Range, { label: string; from: number; to: number }> = {
  hoy: { label: "Hoy", from: 0, to: 0 },
  semana: { label: "Semana", from: -6, to: 0 },
  mes: { label: "Mes", from: -29, to: 0 },
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(date: string, delta: number) {
  const cursor = new Date(`${date}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() + delta);
  return cursor.toISOString().slice(0, 10);
}

function formatMoney(value: string) {
  return `$${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function occupancyPercent(tables: AnalyticsTableOccupancy) {
  if (tables.total === 0) return 0;
  return Math.round((tables.occupied / tables.total) * 100);
}

function VerticalBars({ items }: { items: Array<{ label: string; value: number; title: string }> }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="flex h-44 flex-col">
      <div className="flex flex-1 items-end gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex flex-1 items-end justify-center">
            <div
              className={`w-full max-w-8 rounded-t ${item.value > 0 ? "bg-amber-400" : "bg-stone-200"}`}
              style={{ height: `${Math.max((item.value / max) * 100, item.value > 0 ? 6 : 2)}%` }}
              title={item.title}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {items.map((item) => (
          <span key={item.label} className="flex-1 text-center text-[11px] text-stone-500">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-24 rounded bg-stone-200" />
      <div className="mt-3 h-7 w-28 rounded bg-stone-200" />
      <div className="mt-2 h-3 w-32 rounded bg-stone-200" />
    </div>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);
  const [range, setRange] = useState<Range>("hoy");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState(false);

  function loadDashboard() {
    setDashboardLoading(true);
    setDashboardError(false);
    apiFetch<AnalyticsDashboard>("/analytics/dashboard")
      .then(setDashboard)
      .catch(() => setDashboardError(true))
      .finally(() => setDashboardLoading(false));
  }

  function loadReport() {
    const today = todayUTC();
    const config = RANGES[range];
    const from = shiftDate(today, config.from);
    const to = shiftDate(today, config.to);
    setReportLoading(true);
    setReportError(false);
    apiFetch<AnalyticsReport>(`/analytics/report?from=${from}&to=${to}`)
      .then(setReport)
      .catch(() => setReportError(true))
      .finally(() => setReportLoading(false));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    loadReport();
  }, [range]);

  const weekdaySales = Array.from({ length: 7 }, (_, index) => {
    const label = WEEKDAYS[index] ?? String(index);
    const sales = (report?.dailySales ?? [])
      .filter((day) => weekdayOf(day.date) === index)
      .reduce((sum, day) => sum + Number(day.sales), 0);
    return {
      label,
      value: sales,
      title: `${label}: ${formatMoney(String(sales))}`,
    };
  });

  const peakHour = (report?.salesByHour ?? []).reduce<{ hour: number; sales: string } | null>(
    (peak, entry) => (peak === null || Number(entry.sales) > Number(peak.sales) ? { hour: entry.hour, sales: entry.sales } : peak),
    null,
  );

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const entry = report?.salesByHour.find((item) => item.hour === hour);
    const sales = Number(entry?.sales ?? 0);
    return {
      label: `${hour}`,
      value: sales,
      title: `${hour}:00 — ${formatMoney(entry?.sales ?? "0.00")}`,
    };
  });

  const metrics = dashboard?.metrics;
  const stats = metrics
    ? [
        {
          label: "Ventas del día",
          value: formatMoney(metrics.salesToday),
          hint: `${metrics.ordersToday} ${metrics.ordersToday === 1 ? "pedido" : "pedidos"} cobrados`,
          positive: true,
        },
        {
          label: "Ticket promedio",
          value: formatMoney(metrics.averageTicket),
          hint: "Por pedido cobrado",
          positive: true,
        },
        {
          label: "Pedidos activos",
          value: String(metrics.openOrders),
          hint: "En curso ahora mismo",
          positive: metrics.openOrders > 0,
        },
        {
          label: "Ocupación de mesas",
          value: `${metrics.tables.occupied}/${metrics.tables.total}`,
          hint: `${occupancyPercent(metrics.tables)}% del salón`,
          positive: metrics.tables.occupied > 0,
        },
      ]
    : [];

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Dashboard Administrativo</h1>
          <p className="mt-1 text-sm text-stone-500">Resumen operativo del día y del período seleccionado.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1" role="tablist" aria-label="Período del reporte">
          {(Object.keys(RANGES) as Range[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={range === key}
              onClick={() => setRange(key)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                range === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {RANGES[key].label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardLoading
          ? Array.from({ length: 4 }, (_, index) => <StatSkeleton key={index} />)
          : stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} positive={stat.positive} />
            ))}
      </div>

      {dashboardError ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
          <p role="alert" className="text-sm text-rose-700">
            No se pudieron cargar las métricas del día.
          </p>
          <button
            type="button"
            onClick={loadDashboard}
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Reporte del período</h2>
            <p className="text-sm text-stone-500">
              {report ? `${report.period.from} → ${report.period.to}` : "Cargando rango…"}
            </p>
          </div>
          {report ? (
            <div className="text-right text-sm text-stone-600">
              <p className="font-semibold text-stone-900">{formatMoney(report.totals.sales)}</p>
              <p className="text-xs text-stone-500">
                {report.totals.orders} {report.totals.orders === 1 ? "pedido" : "pedidos"} · ticket {formatMoney(report.totals.averageTicket)}
              </p>
            </div>
          ) : null}
        </div>

        {reportError ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
            <p role="alert" className="text-sm text-rose-700">
              No se pudo generar el reporte del período.
            </p>
            <button
              type="button"
              onClick={loadReport}
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-stone-900">Ventas por día de la semana</h3>
            <p className="mt-1 text-xs text-stone-500">Total del período, agrupado por día.</p>
            <div className="mt-4">
              {reportLoading ? <div className="h-44 animate-pulse rounded bg-stone-100" /> : <VerticalBars items={weekdaySales} />}
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-stone-900">Top 5 ítems</h3>
            <p className="mt-1 text-xs text-stone-500">Los productos más vendidos del período.</p>
            <div className="mt-4">
              {reportLoading ? (
                <div className="h-44 animate-pulse rounded bg-stone-100" />
              ) : (report?.topItems ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-stone-500">Sin ventas en el período.</p>
              ) : (
                <ul className="space-y-3">
                  {(report?.topItems ?? []).map((item) => {
                    const max = Math.max(...(report?.topItems ?? []).map((entry) => entry.quantity), 1);
                    return (
                      <li key={item.name}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-stone-800">{item.name}</span>
                          <span className="shrink-0 text-stone-500">
                            {item.quantity} uds · {formatMoney(item.revenue)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-stone-100">
                          <div className="h-2 rounded-full bg-amber-400" style={{ width: `${(item.quantity / max) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-stone-900">Hora pico</h3>
                <p className="mt-1 text-xs text-stone-500">Concentración de ventas por hora (UTC).</p>
              </div>
              {peakHour && !reportLoading ? (
                <div className="text-right">
                  <p className="text-xl font-semibold text-stone-900">{peakHour.hour}:00</p>
                  <p className="text-xs text-stone-500">{formatMoney(peakHour.sales)} en esa hora</p>
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              {reportLoading ? <div className="h-44 animate-pulse rounded bg-stone-100" /> : <VerticalBars items={hours} />}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}