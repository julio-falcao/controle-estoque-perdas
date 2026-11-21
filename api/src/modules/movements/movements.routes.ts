import { Router } from "express";
import { z } from "zod";
import * as service from "./movements.service.js";

export const movementsRoutes = Router();

const listQuery = z.object({
  productId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

movementsRoutes.get("/", async (req, res) => {
  res.json(await service.listMovements(listQuery.parse(req.query)));
});

movementsRoutes.post("/", async (req, res) => {
  const data = service.createMovementSchema.parse(req.body);
  res.status(201).json(await service.createMovement(data));
});
