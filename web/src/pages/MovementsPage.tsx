import { useState, type FormEvent } from "react";
import { api, brl, date } from "../api";
import { useAsync } from "../useAsync";

export function MovementsPage() {
  const products = useAsync(() => api.products());
  const movements = useAsync(api.movements);

  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"ENTRADA" | "SAIDA">("ENTRADA");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createMovement({ productId: Number(productId), type, quantity: Number(quantity), reason: reason || undefined });
      setQuantity("");
      setReason("");
      setError(null);
      movements.reload();
      products.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1>Movimentações</h1>
      <div className="card">
        <h2>Registrar entrada ou saída</h2>
        <form className="row" onSubmit={submit}>
          <label>
            Produto
            <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">Selecione…</option>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} · {p.name} (saldo {p.currentStock})</option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value as "ENTRADA" | "SAIDA")}>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
            </select>
          </label>
          <label>
            Quantidade
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </label>
          <label>
            Motivo
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compra, venda…" />
          </label>
          <button type="submit">Registrar</button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="muted">Perdas são registradas em Ocorrências; ajustes saem do fechamento do inventário.</p>
      </div>

      <div className="card table-wrap">
        <h2>Últimas movimentações</h2>
        <table>
          <thead>
            <tr><th>Data</th><th>Produto</th><th>Tipo</th><th className="num">Qtd.</th><th className="num">Valor</th><th>Motivo</th></tr>
          </thead>
          <tbody>
            {movements.data?.map((m) => (
              <tr key={m.id}>
                <td>{date(m.createdAt)}</td>
                <td>{m.sku} · {m.productName}</td>
                <td><span className="badge neutral">{m.type}</span></td>
                <td className={`num ${m.quantity > 0 ? "pos" : "neg"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                <td className="num">{brl(Math.abs(m.quantity) * m.unitCost)}</td>
                <td>{m.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
