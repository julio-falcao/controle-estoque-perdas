import type { PoolClient } from "pg";
import { z } from "zod";
import { pool, withTransaction } from "../../db/postgres.js";
import { AppError } from "../../errors.js";

export type MovementType = "ENTRADA" | "SAIDA" | "AJUSTE" | "PERDA";

export const createMovementSchema = z.object({
  productId: z.number().int().positive(),
  type: z.enum(["ENTRADA", "SAIDA"]),
  quantity: z.number().int().positive(),
  reason: z.string().trim().max(120).optional(),
});

/**
 * Aplica uma movimentação ao saldo e grava o histórico, usando a transação recebida.
 * delta é com sinal (+ entra, - sai).
 *
 * O UPDATE só acontece se o saldo continuar >= 0. Como a checagem e a alteração são
 * um único comando, duas saídas simultâneas não conseguem deixar o estoque negativo.
 */
export async function applyMovement(
  client: PoolClient,
  productId: number,
  type: MovementType,
  delta: number,
  reason?: string,
) {
  const updated = await client.query<{ unit_cost: number }>(
    `UPDATE products SET current_stock = current_stock + $2
     WHERE id = $1 AND current_stock + $2 >= 0
     RETURNING unit_cost`,
    [productId, delta],
  );
  if (!updated.rowCount) {
    const exists = await client.query("SELECT 1 FROM products WHERE id = $1", [productId]);
    if (!exists.rowCount) throw new AppError("Produto não encontrado", 404);
    throw new AppError("Estoque insuficiente para esta saída", 422);
  }
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO stock_movements (product_id, type, quantity, unit_cost, reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [productId, type, delta, updated.rows[0].unit_cost, reason ?? null],
  );
  return rows[0].id;
}

export async function createMovement(data: z.infer<typeof createMovementSchema>) {
  const delta = data.type === "ENTRADA" ? data.quantity : -data.quantity;
  const id = await withTransaction((client) =>
    applyMovement(client, data.productId, data.type, delta, data.reason),
  );
  return getMovement(id);
}

const SELECT = `SELECT m.id, m.product_id AS "productId", p.sku, p.name AS "productName", m.type,
                m.quantity, m.unit_cost AS "unitCost", m.reason, m.created_at AS "createdAt"
                FROM stock_movements m JOIN products p ON p.id = m.product_id`;

export async function getMovement(id: number) {
  const { rows } = await pool.query(`${SELECT} WHERE m.id = $1`, [id]);
  return rows[0];
}

export async function listMovements(filters: { productId?: number; limit: number }) {
  const params: unknown[] = [];
  let where = "";
  if (filters.productId) {
    params.push(filters.productId);
    where = "WHERE m.product_id = $1";
  }
  params.push(filters.limit);
  const { rows } = await pool.query(
    `${SELECT} ${where} ORDER BY m.created_at DESC, m.id DESC LIMIT $${params.length}`,
    params,
  );
  return rows;
}
