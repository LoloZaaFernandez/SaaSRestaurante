import { clearSession, readCookie, SESSION_COOKIE } from "@/lib/auth";

export type MenuItem = {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  active: boolean;
  sortOrder: number;
};

export type MenuCategory = {
  id: string;
  tenantId: string;
  name: string;
  position: number;
};

export type ModifierGroup = {
  id: string;
  tenantId: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
};

export type AnalyticsPeriod = { from: string; to: string };

export type AnalyticsTableOccupancy = {
  total: number;
  occupied: number;
  free: number;
  reserved: number;
  cleaning: number;
};

export type AnalyticsDashboard = {
  period: AnalyticsPeriod;
  metrics: {
    salesToday: string;
    ordersToday: number;
    averageTicket: string;
    openOrders: number;
    tables: AnalyticsTableOccupancy;
  };
  topItems: Array<{ name: string; quantity: number; revenue: string }>;
};

export type AnalyticsDailySales = {
  date: string;
  sales: string;
  orders: number;
  payments: number;
};

export type AnalyticsReport = {
  period: AnalyticsPeriod;
  dailySales: AnalyticsDailySales[];
  topItems: Array<{ name: string; quantity: number; revenue: string }>;
  salesByHour: Array<{ hour: number; sales: string; orders: number }>;
  totals: { sales: string; orders: number; averageTicket: string };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
  const token = readCookie(SESSION_COOKIE);
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  const res = await fetch(url, {
    ...init,
    headers,
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    throw new Error(`API ${path} respondió ${res.status}`);
  }
  return (await res.json()) as T;
}
