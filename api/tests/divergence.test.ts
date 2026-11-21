import { describe, expect, it } from "vitest";
import { summarizeDivergences } from "../src/modules/inventories/divergence.js";

describe("summarizeDivergences", () => {
  it("separa sobras e faltas em reais e calcula a acurácia", () => {
    const summary = summarizeDivergences([
      { productId: 1, systemQty: 10, countedQty: 10, unitCost: 5 }, // bateu
      { productId: 2, systemQty: 10, countedQty: 7, unitCost: 2.5 }, // falta 3 -> R$ 7,50
      { productId: 3, systemQty: 4, countedQty: 6, unitCost: 10 }, // sobra 2 -> R$ 20,00
      { productId: 4, systemQty: 8, countedQty: 8, unitCost: 1 }, // bateu
    ]);

    expect(summary).toEqual({
      totalItems: 4,
      countedItems: 4,
      itemsWithDivergence: 2,
      surplusValue: 20,
      shortageValue: 7.5,
      accuracy: 50,
    });
  });

  it("ignora itens ainda não contados", () => {
    const summary = summarizeDivergences([
      { productId: 1, systemQty: 10, countedQty: null, unitCost: 5 },
      { productId: 2, systemQty: 3, countedQty: 3, unitCost: 1 },
    ]);

    expect(summary.countedItems).toBe(1);
    expect(summary.accuracy).toBe(100);
  });

  it("retorna acurácia 0 quando nada foi contado", () => {
    expect(summarizeDivergences([]).accuracy).toBe(0);
  });

  it("arredonda valores para 2 casas decimais", () => {
    const summary = summarizeDivergences([
      { productId: 1, systemQty: 3, countedQty: 0, unitCost: 0.1 },
    ]);
    expect(summary.shortageValue).toBe(0.3);
  });
});
