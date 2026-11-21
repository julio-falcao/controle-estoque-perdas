import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Dados inválidos",
      issues: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  // 23505 = violação de UNIQUE no PostgreSQL (ex.: SKU repetido)
  if (err?.code === "23505") {
    res.status(409).json({ message: "Registro duplicado" });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Erro interno" });
};
