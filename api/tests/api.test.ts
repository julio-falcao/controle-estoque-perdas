// Testes de integração: sobem o app Express e falam com PostgreSQL e MongoDB reais.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db/migrate.js";
import { connectMongo, disconnectMongo } from "../src/db/mongo.js";
import { pool } from "../src/db/postgres.js";
import { Occurrence } from "../src/modules/occurrences/occurrence.model.js";

const app = createApp();

beforeAll(async () => {
  await migrate();
  await connectMongo();
});

beforeEach(async () => {
  await pool.query(
    "TRUNCATE inventory_items, inventories, stock_movements, products RESTART IDENTITY CASCADE",
  );
  await Occurrence.deleteMany({});
});

afterAll(async () => {
  await disconnectMongo();
  await pool.end();
});

async function newProduct(stock = 0, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/products")
    .send({ sku: "SKU-1", name: "Arroz 5kg", category: "Alimentos", unitCost: 20, minStock: 5, ...overrides });
  expect(res.status).toBe(201);
  if (stock > 0) {
    await request(app)
      .post("/api/movements")
      .send({ productId: res.body.id, type: "ENTRADA", quantity: stock })
      .expect(201);
  }
  return res.body as { id: number };
}

async function stockOf(id: number) {
  const res = await request(app).get(`/api/products/${id}`);
  return res.body.currentStock as number;
}

describe("produtos", () => {
  it("cria um produto com saldo zero", async () => {
    const product = await newProduct();
    expect(await stockOf(product.id)).toBe(0);
  });

  it("recusa SKU duplicado com 409", async () => {
    await newProduct();
    const res = await request(app)
      .post("/api/products")
      .send({ sku: "SKU-1", name: "Outro", category: "X", unitCost: 1 });
    expect(res.status).toBe(409);
  });

  it("valida os campos e diz qual está errado", async () => {
    const res = await request(app).post("/api/products").send({ sku: "", unitCost: -1 });
    expect(res.status).toBe(400);
    const fields = res.body.issues.map((i: { field: string }) => i.field);
    expect(fields).toEqual(expect.arrayContaining(["sku", "name", "category", "unitCost"]));
  });

  it("filtra produtos abaixo do estoque mínimo", async () => {
    await newProduct(2); // mínimo 5
    await newProduct(50, { sku: "SKU-2" });
    const res = await request(app).get("/api/products?lowStock=true");
    expect(res.body.map((p: { sku: string }) => p.sku)).toEqual(["SKU-1"]);
  });
});

describe("movimentações", () => {
  it("entrada soma e saída subtrai do saldo", async () => {
    const product = await newProduct(10);
    await request(app)
      .post("/api/movements")
      .send({ productId: product.id, type: "SAIDA", quantity: 4 })
      .expect(201);
    expect(await stockOf(product.id)).toBe(6);
  });

  it("não deixa o estoque ficar negativo", async () => {
    const product = await newProduct(3);
    const res = await request(app)
      .post("/api/movements")
      .send({ productId: product.id, type: "SAIDA", quantity: 5 });
    expect(res.status).toBe(422);
    expect(await stockOf(product.id)).toBe(3);
  });

  it("saídas simultâneas não ultrapassam o saldo", async () => {
    const product = await newProduct(10);
    // 5 pedidos de 3 unidades ao mesmo tempo: só 3 cabem em 10.
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post("/api/movements").send({ productId: product.id, type: "SAIDA", quantity: 3 }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(await stockOf(product.id)).toBe(1);
  });
});

describe("inventário", () => {
  it("fecha o inventário e gera ajustes pelas divergências", async () => {
    const a = await newProduct(10);
    const b = await newProduct(8, { sku: "SKU-2", unitCost: 5 });

    const inv = await request(app).post("/api/inventories").send({}).expect(201);
    expect(inv.body.items).toHaveLength(2);

    await request(app).put(`/api/inventories/${inv.body.id}/items/${a.id}`).send({ countedQty: 10 }).expect(200);
    const counted = await request(app)
      .put(`/api/inventories/${inv.body.id}/items/${b.id}`)
      .send({ countedQty: 6 })
      .expect(200);
    expect(counted.body.summary).toMatchObject({ itemsWithDivergence: 1, shortageValue: 10, accuracy: 50 });

    const closed = await request(app).post(`/api/inventories/${inv.body.id}/close`).expect(200);
    expect(closed.body.status).toBe("FECHADO");
    expect(await stockOf(b.id)).toBe(6);

    const movements = await request(app).get(`/api/movements?productId=${b.id}`);
    expect(movements.body[0]).toMatchObject({ type: "AJUSTE", quantity: -2 });
  });

  it("não fecha com produtos sem contagem", async () => {
    await newProduct(10);
    const inv = await request(app).post("/api/inventories").send({}).expect(201);
    const res = await request(app).post(`/api/inventories/${inv.body.id}/close`);
    expect(res.status).toBe(422);
    expect(res.body.message).toContain("Faltam 1");
  });

  it("permite só um inventário aberto por vez", async () => {
    await newProduct(1);
    await request(app).post("/api/inventories").send({}).expect(201);
    await request(app).post("/api/inventories").send({}).expect(409);
  });
});

describe("ocorrências de perda", () => {
  const occurrence = (productId: number) => ({
    productId,
    type: "AVARIA",
    quantity: 2,
    description: "Embalagem rasgada no recebimento",
    registeredBy: "Júlio",
    tags: ["recebimento"],
    details: { fornecedor: "Distribuidora X", causa: "transporte" },
  });

  it("baixa o estoque no PostgreSQL e guarda os detalhes no MongoDB", async () => {
    const product = await newProduct(10);
    const res = await request(app).post("/api/occurrences").send(occurrence(product.id));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ sku: "SKU-1", totalCost: 40, details: { fornecedor: "Distribuidora X" } });
    expect(await stockOf(product.id)).toBe(8);

    const list = await request(app).get("/api/occurrences?tag=recebimento");
    expect(list.body).toHaveLength(1);
  });

  it("se o MongoDB falhar, o estoque não é baixado (rollback)", async () => {
    const product = await newProduct(10);
    const spy = vi.spyOn(Occurrence, "create").mockRejectedValueOnce(new Error("Mongo fora do ar"));

    const res = await request(app).post("/api/occurrences").send(occurrence(product.id));

    expect(res.status).toBe(500);
    expect(await stockOf(product.id)).toBe(10);
    const movements = await request(app).get(`/api/movements?productId=${product.id}`);
    expect(movements.body.every((m: { type: string }) => m.type !== "PERDA")).toBe(true);
    spy.mockRestore();
  });

  it("aparece no dashboard como perda do mês", async () => {
    const product = await newProduct(10);
    await request(app).post("/api/occurrences").send(occurrence(product.id)).expect(201);

    const res = await request(app).get("/api/dashboard").expect(200);
    expect(res.body.summary.lossesThisMonth).toBe(40);
    expect(res.body.lossesByMonth[0]).toMatchObject({ type: "AVARIA", value: 40 });
    expect(res.body.topLossProducts[0]).toMatchObject({ sku: "SKU-1", total: 40, occurrences: 1 });
  });
});
