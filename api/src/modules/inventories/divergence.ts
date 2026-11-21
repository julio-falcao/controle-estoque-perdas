// Cálculo puro (sem banco): fica fácil de testar e de reaproveitar.

export type CountedItem = {
  productId: number;
  systemQty: number;
  countedQty: number | null;
  unitCost: number;
};

export type DivergenceSummary = {
  totalItems: number;
  countedItems: number;
  itemsWithDivergence: number;
  /** soma do valor das sobras (contado > sistema) */
  surplusValue: number;
  /** soma do valor das faltas (contado < sistema), em número positivo */
  shortageValue: number;
  /** % de itens contados que bateram com o sistema */
  accuracy: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeDivergences(items: CountedItem[]): DivergenceSummary {
  const counted = items.filter((i) => i.countedQty !== null);
  let surplusValue = 0;
  let shortageValue = 0;
  let itemsWithDivergence = 0;

  for (const item of counted) {
    const diff = (item.countedQty as number) - item.systemQty;
    if (diff === 0) continue;
    itemsWithDivergence++;
    if (diff > 0) surplusValue += diff * item.unitCost;
    else shortageValue += -diff * item.unitCost;
  }

  const accuracy = counted.length
    ? round2(((counted.length - itemsWithDivergence) / counted.length) * 100)
    : 0;

  return {
    totalItems: items.length,
    countedItems: counted.length,
    itemsWithDivergence,
    surplusValue: round2(surplusValue),
    shortageValue: round2(shortageValue),
    accuracy,
  };
}
