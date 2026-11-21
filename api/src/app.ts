import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/error-handler.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { inventoriesRoutes } from "./modules/inventories/inventories.routes.js";
import { movementsRoutes } from "./modules/movements/movements.routes.js";
import { occurrencesRoutes } from "./modules/occurrences/occurrences.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";

// A criação do app fica separada do server.ts para os testes usarem o app sem abrir porta.
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/products", productsRoutes);
  app.use("/api/movements", movementsRoutes);
  app.use("/api/inventories", inventoriesRoutes);
  app.use("/api/occurrences", occurrencesRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use((_req, res) => {
    res.status(404).json({ message: "Rota não encontrada" });
  });
  // O Express 5 envia para cá os erros lançados dentro de rotas async.
  app.use(errorHandler);
  return app;
}
