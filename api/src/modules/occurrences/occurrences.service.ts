import { z } from "zod";
import { withTransaction } from "../../db/postgres.js";
import { AppError } from "../../errors.js";
import { applyMovement } from "../movements/movements.service.js";
import { OCCURRENCE_TYPES, Occurrence } from "./occurrence.model.js";

export const createOccurrenceSchema = z.object({
  productId: z.number().int().positive(),
  type: z.enum(OCCURRENCE_TYPES),
  quantity: z.number().int().positive(),
  description: z.string().trim().min(3).max(500),
  location: z.string().trim().max(80).optional(),
  registeredBy: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  details: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Registra a perda nos dois bancos:
 * 1. PostgreSQL: baixa o estoque e grava a movimentação de PERDA (dentro de uma transação);
 * 2. MongoDB: grava os detalhes da ocorrência.
 * O COMMIT do PostgreSQL só acontece depois que o MongoDB salvou. Se o MongoDB falhar,
 * a transação é desfeita e o estoque não é baixado.
 */
export async function createOccurrence(data: z.infer<typeof createOccurrenceSchema>) {
  return withTransaction(async (client) => {
    const product = await client.query<{ sku: string; unit_cost: number }>(
      "SELECT sku, unit_cost FROM products WHERE id = $1",
      [data.productId],
    );
    if (!product.rows[0]) throw new AppError("Produto não encontrado", 404);

    const movementId = await applyMovement(
      client,
      data.productId,
      "PERDA",
      -data.quantity,
      data.type,
    );

    const doc = await Occurrence.create({
      ...data,
      sku: product.rows[0].sku,
      totalCost: Math.round(data.quantity * product.rows[0].unit_cost * 100) / 100,
      movementId,
    });
    return doc.toObject();
  });
}

export const listOccurrencesQuery = z.object({
  type: z.enum(OCCURRENCE_TYPES).optional(),
  productId: z.coerce.number().int().positive().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listOccurrences(q: z.infer<typeof listOccurrencesQuery>) {
  const filter: Record<string, unknown> = {};
  if (q.type) filter.type = q.type;
  if (q.productId) filter.productId = q.productId;
  if (q.tag) filter.tags = q.tag;
  return Occurrence.find(filter).sort({ createdAt: -1 }).limit(q.limit).lean();
}
