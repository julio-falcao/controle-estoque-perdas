import { Schema, model } from "mongoose";

export const OCCURRENCE_TYPES = ["FURTO", "AVARIA", "VENCIMENTO", "OUTRO"] as const;

/**
 * Ocorrência de perda. Fica no MongoDB porque o formato varia muito de um caso
 * para outro: um furto tem local e horário; uma avaria tem a causa; um vencimento
 * tem lote e validade. O campo "details" aceita esses dados livres sem precisar
 * criar uma coluna nova no PostgreSQL para cada tipo.
 */
const occurrenceSchema = new Schema(
  {
    productId: { type: Number, required: true, index: true },
    sku: { type: String, required: true },
    type: { type: String, enum: OCCURRENCE_TYPES, required: true },
    quantity: { type: Number, required: true, min: 1 },
    totalCost: { type: Number, required: true },
    description: { type: String, required: true, maxlength: 500 },
    location: { type: String },
    registeredBy: { type: String, required: true },
    tags: { type: [String], default: [] },
    details: { type: Schema.Types.Mixed, default: {} },
    // id da movimentação de PERDA gerada no PostgreSQL (liga os dois bancos)
    movementId: { type: Number, required: true },
  },
  { timestamps: true },
);

export const Occurrence = model("Occurrence", occurrenceSchema);
