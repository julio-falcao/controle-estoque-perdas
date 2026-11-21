import { Router } from "express";
import * as service from "./occurrences.service.js";

export const occurrencesRoutes = Router();

occurrencesRoutes.get("/", async (req, res) => {
  res.json(await service.listOccurrences(service.listOccurrencesQuery.parse(req.query)));
});

occurrencesRoutes.post("/", async (req, res) => {
  const data = service.createOccurrenceSchema.parse(req.body);
  res.status(201).json(await service.createOccurrence(data));
});
