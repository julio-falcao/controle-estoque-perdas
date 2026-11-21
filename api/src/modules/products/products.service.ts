import { z } from "zod";
import { pool } from "../../db/postgres.js";
import { AppError } from "../../errors.js";

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  unitCost: z.number().nonnegative(),
  minStock: z.number().int().nonnegative().default(0),
});
export const updateProductSchema = createProductSchema.partial();

export type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  minStock: number;
  currentStock: number;
  createdAt: Date;
};

// Converte os nomes das colunas (snake_case) para o padrão do JavaScript (camelCase).
const SELECT = `SELECT id, sku, name, category, unit_cost AS "unitCost", min_stock AS "minStock",
                current_stock AS "currentStock", created_at AS "createdAt" FROM products`;

export async function listProducts(filters: { search?: string; lowStock?: boolean }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where.push(`(sku ILIKE $${params.length} OR name ILIKE $${params.length})`);
  }
  if (filters.lowStock) where.push("current_stock <= min_stock");
  const sql = `${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY name`;
  const { rows } = await pool.query<Product>(sql, params);
  return rows;
}

export async function getProduct(id: number) {
  const { rows } = await pool.query<Product>(`${SELECT} WHERE id = $1`, [id]);
  if (!rows[0]) throw new AppError("Produto não encontrado", 404);
  return rows[0];
}

export async function createProduct(data: z.infer<typeof createProductSchema>) {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO products (sku, name, category, unit_cost, min_stock)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [data.sku, data.name, data.category, data.unitCost, data.minStock],
  );
  return getProduct(rows[0].id);
}

// O saldo NÃO é editável aqui: ele só muda por movimentações, para manter o histórico.
export async function updateProduct(id: number, data: z.infer<typeof updateProductSchema>) {
  const current = await getProduct(id);
  const next = { ...current, ...data };
  await pool.query(
    `UPDATE products SET sku = $1, name = $2, category = $3, unit_cost = $4, min_stock = $5 WHERE id = $6`,
    [next.sku, next.name, next.category, next.unitCost, next.minStock, id],
  );
  return getProduct(id);
}
