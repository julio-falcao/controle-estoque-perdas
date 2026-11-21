import { Router } from "express";
import { z } from "zod";
import * as service from "./inventories.service.js";

export const inventoriesRoutes = Router();
const id = z.coerce.number().int().positive();

inventoriesRoutes.get("/", async (_req, res) => {
  res.json(await service.listInventories());
});

inventoriesRoutes.post("/", async (req, res) => {
  const data = service.openInventorySchema.parse(req.body ?? {});
  res.status(201).json(await service.openInventory(data));
});

inventoriesRoutes.get("/:id", async (req, res) => {
  res.json(await service.getInventory(id.parse(req.params.id)));
});

inventoriesRoutes.put("/:id/items/:productId", async (req, res) => {
  const { countedQty } = service.countSchema.parse(req.body);
  res.json(await service.registerCount(id.parse(req.params.id), id.parse(req.params.productId), countedQty));
});

inventoriesRoutes.post("/:id/close", async (req, res) => {
  res.json(await service.closeInventory(id.parse(req.params.id)));
});
