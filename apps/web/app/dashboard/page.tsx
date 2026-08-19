"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import BarChart, { type Bar } from "@/components/BarChart";
import { getDashboard, getReport, type DashboardResponse, type ReportRange, type ReportResponse } from "@/lib/api";

const quickLinks = [
  { href: "/menu", title: "Gestión de Menú", description: "Categorías, ítems y precios del catálogo." },
  { href: "/tables", title: "Plano de Mesas", description: "Estado y distribución actual del salón." },
  { href: "/orders", title: "Toma de Pedido", description: "Armá y cobrá pedidos en tiempo real." },
] as const;

const RANGE_OPTIONS: { value: ReportRange; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
] as const;

// Día de la semana (1 = lunes … 7 = domingo, ISO).
const WEEKDAYS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

// Formatea montos (los números llegan como string decimal, p. ej. "12500.00").
const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<ReportRange>("today");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  // Carga las métricas desde GET /analytics/dashboard (vía proxy /api/dashboard).
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDashboard()
      .then(setDashboard)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las métricas.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Carga el reporte agregado para el rango activo (vía proxy /api/report).
  const loadReport = useCallback((r: ReportRange) => {
    setReportLoading(true);
    setReportError(null);
    getReport(r)
      .then(setReport)
      .catch((err: unknown) => {
        setReportError(err instanceof Error ? err.message : "No se pudo cargar el reporte.");
      })
      .finally(() => setReportLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadReport(range);
  }, [range, loadReport]);

  // Porcentaje de mesas ocupadas, con guard para evitar 0/0 cuando no hay mesas.
  const occupiedPct =
    dashboard && dashboard.occupancy.total > 0
      ? Math.round((dashboard.occupancy.occupied / dashboard.occupancy.total) * 100)
      : 0;

  // Barras para los gráficos del reporte.
  const weekdayBars: Bar[] = report
    ? report.salesByWeekday.map((w) => ({
        label: WEEKDAYS[w.weekday] ?? "",
        value: Number(w.totalSales),
        display: money.format(Number(w.totalSales)),
      }))
    : [];

  const topItemBars: Bar[] = report
    ? report.topItems.map((item) => ({
        label: item.name,
        value: Number(item.revenue),
        display: money.format(Number(item.revenue)),
      }))
    : [];

  const peakHourBars: Bar[] = report
    ? report.peakHours.map((h) => ({
        label: `${h.hour}h`,
        value: h.orderCount,
        display: `${h.orderCount} pedidos`,
      }))
    : [];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Dashboard Administrativo</h1>
        <p className="mt-1 text-sm text-stone-500">
          {dashboard ? `Resumen operativo del día ${dashboard.date}.` : "Resumen operativo del día."}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          // Skeleton: se muestran las 4 cards con animación mientras carga.
          <>
            <StatCard label="Ventas hoy" loading />
            <StatCard label="Pedidos activos" loading />
            <StatCard label="Ocupación" loading />
            <StatCard label="Ticket promedio" loading />
          </>
        ) : error ? (
          // Error: mensaje + botón reintentar.
          <div className="col-span-full rounded-xl border border-rose-200 bg-rose-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-rose-700">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Reintentar
            </button>
          </div>
        ) : dashboard ? (
          <>
            <StatCard
              label="Ventas hoy"
              value={money.format(Number(dashboard.totals.salesToday))}
              hint={`${dashboard.totals.paidOrders} pedidos pagados`}
            />
            <StatCard
              label="Pedidos activos"
              value={String(dashboard.activeOrders)}
              hint={`${dashboard.occupancy.occupied} mesas en servicio`}
            />
            <StatCard
              label="Ocupación"
              value={`${occupiedPct}%`}
              hint={`${dashboard.occupancy.occupied} de ${dashboard.occupancy.total} mesas ocupadas`}
            />
            <StatCard
              label="Ticket promedio"
              value={money.format(Number(dashboard.totals.avgTicket))}
              hint={`${dashboard.totals.ordersToday} pedidos del día`}
            />
          </>
        ) : null}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Reporte</h2>
            <p className="text-sm text-stone-500">
              {report
                ? `Ventas ${money.format(Number(report.totals.totalSales))} · ${report.totals.totalOrders} pedidos · ticket promedio ${money.format(Number(report.totals.avgTicket))}`
                : "Análisis del período seleccionado."}
            </p>
          </div>

          {/* Selector de rango: hoy / semana / mes (P2). */}
          <div className="flex rounded-lg border border-stone-200 bg-stone-100 p-1" role="tablist" aria-label="Rango del reporte">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={range === option.value}
                onClick={() => setRange(option.value)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  range === option.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {reportLoading ? (
          // Skeleton de los tres gráficos mientras carga.
          <div className="mt-5 grid gap-4 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-lg bg-stone-100" />
            ))}
          </div>
        ) : reportError ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-rose-700">{reportError}</p>
            <button
              type="button"
              onClick={() => loadReport(range)}
              className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Reintentar
            </button>
          </div>
        ) : report ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-stone-100 p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-900">Ventas por día de la semana</h3>
              <BarChart bars={weekdayBars} />
            </section>
            <section className="rounded-lg border border-stone-100 p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-900">Top 5 ítems por ingreso</h3>
              <BarChart bars={topItemBars} horizontal />
            </section>
            <section className="rounded-lg border border-stone-100 p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-900">Hora pico (pedidos por hora)</h3>
              <BarChart bars={peakHourBars} />
            </section>
          </div>
        ) : null}
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
