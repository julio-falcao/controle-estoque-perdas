import { z } from "zod";
import { pool, withTransaction } from "../../db/postgres.js";
import { AppError } from "../../errors.js";
import { applyMovement } from "../movements/movements.service.js";
import { summarizeDivergences, type CountedItem } from "./divergence.js";

export const openInventorySchema = z.object({
  category: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(200).optional(),
});
export const countSchema = z.object({ countedQty: z.number().int().nonnegative() });

/**
 * Abre um inventário tirando uma "foto" do saldo de cada produto (system_qty).
 * Só pode haver um inventário aberto por vez.
 */
export async function openInventory(data: z.infer<typeof openInventorySchema>) {
  const id = await withTransaction(async (client) => {
    const open = await client.query("SELECT id FROM inventories WHERE status = 'ABERTO'");
    if (open.rowCount) throw new AppError("Já existe um inventário aberto", 409);

    const { rows } = await client.query<{ id: number }>(
      "INSERT INTO inventories (notes) VALUES ($1) RETURNING id",
      [data.notes ?? null],
    );
    const inventoryId = rows[0].id;
    const inserted = await client.query(
      `INSERT INTO inventory_items (inventory_id, product_id, system_qty)
       SELECT $1, id, current_stock FROM products
       WHERE ($2::text IS NULL OR category = $2)`,
      [inventoryId, data.category ?? null],
    );
    if (!inserted.rowCount) throw new AppError("Nenhum produto para inventariar", 422);
    return inventoryId;
  });
  return getInventory(id);
}

export async function getInventory(id: number) {
  const inv = await pool.query(
    `SELECT id, status, notes, created_at AS "createdAt", closed_at AS "closedAt"
     FROM inventories WHERE id = $1`,
    [id],
  );
  if (!inv.rows[0]) throw new AppError("Inventário não encontrado", 404);

  const items = await pool.query<CountedItem & { sku: string; name: string }>(
    `SELECT i.product_id AS "productId", p.sku, p.name, i.system_qty AS "systemQty",
            i.counted_qty AS "countedQty", p.unit_cost AS "unitCost"
     FROM inventory_items i JOIN products p ON p.id = i.product_id
     WHERE i.inventory_id = $1 ORDER BY p.name`,
    [id],
  );
  return { ...inv.rows[0], items: items.rows, summary: summarizeDivergences(items.rows) };
}

export async function listInventories() {
  const { rows } = await pool.query(
    `SELECT id, status, notes, created_at AS "createdAt", closed_at AS "closedAt"
     FROM inventories ORDER BY id DESC`,
  );
  return rows;
}

async function assertOpen(id: number) {
  const { rows } = await pool.query<{ status: string }>("SELECT status FROM inventories WHERE id = $1", [id]);
  if (!rows[0]) throw new AppError("Inventário não encontrado", 404);
  if (rows[0].status !== "ABERTO") throw new AppError("Inventário já foi fechado", 409);
}

export async function registerCount(inventoryId: number, productId: number, countedQty: number) {
  await assertOpen(inventoryId);
  const updated = await pool.query(
    "UPDATE inventory_items SET counted_qty = $3 WHERE inventory_id = $1 AND product_id = $2",
    [inventoryId, productId, countedQty],
  );
  if (!updated.rowCount) throw new AppError("Produto não faz parte deste inventário", 404);
  return getInventory(inventoryId);
}

/**
 * Fecha o inventário: cada divergência vira uma movimentação de AJUSTE.
 * O ajuste usa a diferença entre o contado e a foto (system_qty), então movimentações
 * feitas durante a contagem não são apagadas.
 * Tudo numa transação: ou todos os ajustes entram, ou nenhum.
 */
export async function closeInventory(id: number) {
  await withTransaction(async (client) => {
    // FOR UPDATE trava a linha: dois fechamentos ao mesmo tempo não geram ajuste em dobro.
    const inv = await client.query<{ status: string }>(
      "SELECT status FROM inventories WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!inv.rows[0]) throw new AppError("Inventário não encontrado", 404);
    if (inv.rows[0].status !== "ABERTO") throw new AppError("Inventário já foi fechado", 409);

    const items = await client.query<{ productId: number; systemQty: number; countedQty: number | null }>(
      `SELECT product_id AS "productId", system_qty AS "systemQty", counted_qty AS "countedQty"
       FROM inventory_items WHERE inventory_id = $1`,
      [id],
    );
    const pending = items.rows.filter((i) => i.countedQty === null).length;
    if (pending) throw new AppError(`Faltam ${pending} produto(s) para contar`, 422);

    for (const item of items.rows) {
      const diff = (item.countedQty as number) - item.systemQty;
      if (diff !== 0) await applyMovement(client, item.productId, "AJUSTE", diff, `Inventário #${id}`);
    }
    await client.query("UPDATE inventories SET status = 'FECHADO', closed_at = now() WHERE id = $1", [id]);
  });
  return getInventory(id);
}
