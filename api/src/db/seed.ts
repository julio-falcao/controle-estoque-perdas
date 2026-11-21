// Popula o banco com dados de exemplo (produtos de supermercado e algumas perdas).
// Uso: npm run seed   (apaga os dados atuais!)
import { createOccurrence } from "../modules/occurrences/occurrences.service.js";
import { createMovement } from "../modules/movements/movements.service.js";
import { createProduct } from "../modules/products/products.service.js";
import { migrate } from "./migrate.js";
import { connectMongo, disconnectMongo } from "./mongo.js";
import { pool } from "./postgres.js";
import { Occurrence } from "../modules/occurrences/occurrence.model.js";

const products = [
  { sku: "ALI-001", name: "Arroz tipo 1 5kg", category: "Alimentos", unitCost: 22.9, minStock: 20 },
  { sku: "ALI-002", name: "Feijão carioca 1kg", category: "Alimentos", unitCost: 7.5, minStock: 30 },
  { sku: "ALI-003", name: "Café torrado 500g", category: "Alimentos", unitCost: 18.4, minStock: 15 },
  { sku: "BEB-001", name: "Refrigerante 2L", category: "Bebidas", unitCost: 6.8, minStock: 40 },
  { sku: "BEB-002", name: "Suco integral 1L", category: "Bebidas", unitCost: 9.9, minStock: 12 },
  { sku: "LIM-001", name: "Detergente 500ml", category: "Limpeza", unitCost: 2.3, minStock: 50 },
  { sku: "LIM-002", name: "Sabão em pó 1kg", category: "Limpeza", unitCost: 12.6, minStock: 20 },
  { sku: "HIG-001", name: "Creme dental 90g", category: "Higiene", unitCost: 4.2, minStock: 30 },
];
const initialStock = [120, 200, 60, 300, 25, 400, 80, 150];

async function main() {
  await migrate();
  await connectMongo();
  await pool.query(
    "TRUNCATE inventory_items, inventories, stock_movements, products RESTART IDENTITY CASCADE",
  );
  await Occurrence.deleteMany({});

  const created = [];
  for (const [i, p] of products.entries()) {
    const product = await createProduct(p);
    await createMovement({ productId: product.id, type: "ENTRADA", quantity: initialStock[i], reason: "Carga inicial" });
    created.push(product);
  }

  await createMovement({ productId: created[3].id, type: "SAIDA", quantity: 270, reason: "Venda" });
  await createMovement({ productId: created[4].id, type: "SAIDA", quantity: 18, reason: "Venda" });

  const losses = [
    { i: 2, type: "FURTO", quantity: 6, description: "Embalagens vazias encontradas no corredor 4", location: "Corredor 4", tags: ["corredor"], details: { horario: "18:40" } },
    { i: 4, type: "VENCIMENTO", quantity: 4, description: "Lote vencido na gôndola", location: "Bebidas", tags: ["validade"], details: { lote: "L2309", validade: "2026-11-10" } },
    { i: 6, type: "AVARIA", quantity: 5, description: "Pacotes rasgados no recebimento", location: "Doca 2", tags: ["recebimento"], details: { causa: "transporte", fornecedor: "Distribuidora X" } },
    { i: 0, type: "AVARIA", quantity: 3, description: "Sacos furados pela empilhadeira", location: "Depósito", tags: ["deposito"], details: { causa: "manuseio" } },
  ] as const;
  for (const l of losses) {
    await createOccurrence({
      productId: created[l.i].id,
      type: l.type,
      quantity: l.quantity,
      description: l.description,
      location: l.location,
      registeredBy: "Equipe de prevenção",
      tags: [...l.tags],
      details: { ...l.details },
    });
  }
  console.log(`seed ok: ${created.length} produtos, ${losses.length} ocorrências`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
    await pool.end();
  });
