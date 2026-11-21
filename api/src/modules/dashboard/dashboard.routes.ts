import { Router } from "express";
import { pool } from "../../db/postgres.js";
import { Occurrence } from "../occurrences/occurrence.model.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/", async (_req, res) => {
  const [summary, lossesByMonth, lowStock, topLossProducts] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM products) AS "totalProducts",
        (SELECT COALESCE(SUM(current_stock * unit_cost), 0) FROM products) AS "stockValue",
        (SELECT COUNT(*) FROM products WHERE current_stock <= min_stock) AS "lowStockCount",
        (SELECT COALESCE(SUM(-quantity * unit_cost), 0) FROM stock_movements
          WHERE type = 'PERDA' AND created_at >= date_trunc('month', now())) AS "lossesThisMonth"
    `),
    // Perdas dos últimos 6 meses, em R$, separadas pelo motivo (FURTO, AVARIA...).
    pool.query(`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             reason AS type,
             SUM(-quantity * unit_cost)::numeric(12,2) AS value
      FROM stock_movements
      WHERE type = 'PERDA' AND created_at >= date_trunc('month', now()) - interval '5 months'
      GROUP BY 1, 2 ORDER BY 1, 2
    `),
    pool.query(`
      SELECT id, sku, name, current_stock AS "currentStock", min_stock AS "minStock"
      FROM products WHERE current_stock <= min_stock ORDER BY current_stock - min_stock LIMIT 10
    `),
    // Agregação no MongoDB: produtos com maior valor perdido.
    Occurrence.aggregate([
      { $group: { _id: "$sku", total: { $sum: "$totalCost" }, occurrences: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, sku: "$_id", total: { $round: ["$total", 2] }, occurrences: 1 } },
    ]),
  ]);

  res.json({
    summary: summary.rows[0],
    lossesByMonth: lossesByMonth.rows,
    lowStock: lowStock.rows,
    topLossProducts,
  });
});
