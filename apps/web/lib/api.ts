import { readCookie, SESSION_COOKIE } from "@/lib/auth";

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
    throw new Error(`API ${path} respondió ${res.status}`);
  }
  return (await res.json()) as T;
}
