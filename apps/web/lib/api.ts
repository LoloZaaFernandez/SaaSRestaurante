export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: "Entradas" | "Principales" | "Postres" | "Bebidas";
  price: number;
  available: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`API ${path} respondió ${res.status}`);
  }
  return (await res.json()) as T;
}