import { Router } from "express";
import { z } from "zod";
import * as service from "./products.service.js";

export const productsRoutes = Router();
const idParam = z.coerce.number().int().positive();

productsRoutes.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json(await service.listProducts({ search, lowStock: req.query.lowStock === "true" }));
});

productsRoutes.get("/:id", async (req, res) => {
  res.json(await service.getProduct(idParam.parse(req.params.id)));
});

productsRoutes.post("/", async (req, res) => {
  const data = service.createProductSchema.parse(req.body);
  res.status(201).json(await service.createProduct(data));
});

productsRoutes.patch("/:id", async (req, res) => {
  const data = service.updateProductSchema.parse(req.body);
  res.json(await service.updateProduct(idParam.parse(req.params.id), data));
});
