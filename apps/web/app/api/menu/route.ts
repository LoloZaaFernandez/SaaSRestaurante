import { NextResponse } from "next/server";
import type { MenuItem } from "@/lib/api";

const items: MenuItem[] = [
  { id: "1", name: "Empanadas de carne", description: "Dos unidades, corte criollo.", category: "Entradas", price: 5800, available: true },
  { id: "2", name: "Humita en chala", description: "Choclo, cebolla y salsa blanca.", category: "Entradas", price: 4800, available: true },
  { id: "3", name: "Milanesa napolitana", description: "Con puré y ensalada.", category: "Principales", price: 12500, available: true },
  { id: "4", name: "Parrillada para dos", description: "Asado, vacío, chorizo y morcilla.", category: "Principales", price: 28500, available: true },
  { id: "5", name: "Risotto de hongos", description: "Arroz cremoso con parmesano.", category: "Principales", price: 13800, available: true },
  { id: "6", name: "Flan casero", description: "Con dulce de leche.", category: "Postres", price: 4200, available: true },
  { id: "7", name: "Helado artesanal", description: "Dos bochas a elección.", category: "Postres", price: 4600, available: false },
  { id: "8", name: "Café de especialidad", description: "Doble o americano.", category: "Bebidas", price: 3200, available: true },
  { id: "9", name: "Agua mineral", description: "500 ml, con o sin gas.", category: "Bebidas", price: 2800, available: true },
  { id: "10", name: "Vino tinto de la casa", description: "Copa 180 ml.", category: "Bebidas", price: 5500, available: true },
];

export async function GET() {
  return NextResponse.json({ items });
}