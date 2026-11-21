// Cliente HTTP da API e os tipos que ela devolve.

export type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  minStock: number;
  currentStock: number;
};

export type Movement = {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  type: "ENTRADA" | "SAIDA" | "AJUSTE" | "PERDA";
  quantity: number;
  unitCost: number;
  reason: string | null;
  createdAt: string;
};

export type InventoryItem = {
  productId: number;
  sku: string;
  name: string;
  systemQty: number;
  countedQty: number | null;
  unitCost: number;
};

export type Inventory = {
  id: number;
  status: "ABERTO" | "FECHADO";
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
  items?: InventoryItem[];
  summary?: {
    totalItems: number;
    countedItems: number;
    itemsWithDivergence: number;
    surplusValue: number;
    shortageValue: number;
    accuracy: number;
  };
};

export const OCCURRENCE_TYPES = ["FURTO", "AVARIA", "VENCIMENTO", "OUTRO"] as const;
export type OccurrenceType = (typeof OCCURRENCE_TYPES)[number];

export type Occurrence = {
  _id: string;
  productId: number;
  sku: string;
  type: OccurrenceType;
  quantity: number;
  totalCost: number;
  description: string;
  location?: string;
  registeredBy: string;
  tags: string[];
  details: Record<string, unknown>;
  createdAt: string;
};

export type Dashboard = {
  summary: { totalProducts: number; stockValue: number; lowStockCount: number; lossesThisMonth: number };
  lossesByMonth: { month: string; type: OccurrenceType; value: number }[];
  lowStock: { id: number; sku: string; name: string; currentStock: number; minStock: number }[];
  topLossProducts: { sku: string; total: number; occurrences: number }[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.issues?.map((i: { field: string; message: string }) => `${i.field}: ${i.message}`).join("; ");
    throw new Error(detail ? `${body.message} (${detail})` : body.message ?? "Erro inesperado");
  }
  return body as T;
}

const post = <T>(path: string, data: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data) });

export const api = {
  dashboard: () => request<Dashboard>("/dashboard"),
  products: (params = "") => request<Product[]>(`/products${params}`),
  createProduct: (data: Omit<Product, "id" | "currentStock">) => post<Product>("/products", data),
  movements: () => request<Movement[]>("/movements"),
  createMovement: (data: { productId: number; type: "ENTRADA" | "SAIDA"; quantity: number; reason?: string }) =>
    post<Movement>("/movements", data),
  inventories: () => request<Inventory[]>("/inventories"),
  inventory: (id: number) => request<Inventory>(`/inventories/${id}`),
  openInventory: (data: { category?: string; notes?: string }) => post<Inventory>("/inventories", data),
  count: (id: number, productId: number, countedQty: number) =>
    request<Inventory>(`/inventories/${id}/items/${productId}`, {
      method: "PUT",
      body: JSON.stringify({ countedQty }),
    }),
  closeInventory: (id: number) => post<Inventory>(`/inventories/${id}/close`, {}),
  occurrences: () => request<Occurrence[]>("/occurrences"),
  createOccurrence: (data: Omit<Occurrence, "_id" | "sku" | "totalCost" | "createdAt">) =>
    post<Occurrence>("/occurrences", data),
};

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const date = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
