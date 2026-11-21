import { useState, type FormEvent } from "react";
import { api, brl, date, OCCURRENCE_TYPES, type OccurrenceType } from "../api";
import { useAsync } from "../useAsync";

// Converte linhas "chave: valor" em objeto. Ex.: "lote: L123" -> { lote: "L123" }
function parseDetails(text: string) {
  return Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.split(":"))
      .filter((parts) => parts.length >= 2 && parts[0].trim())
      .map(([key, ...rest]) => [key.trim(), rest.join(":").trim()]),
  );
}

export function OccurrencesPage() {
  const products = useAsync(() => api.products());
  const list = useAsync(api.occurrences);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    productId: "",
    type: "AVARIA" as OccurrenceType,
    quantity: "",
    description: "",
    location: "",
    registeredBy: "",
    tags: "",
    details: "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createOccurrence({
        productId: Number(form.productId),
        type: form.type,
        quantity: Number(form.quantity),
        description: form.description,
        location: form.location || undefined,
        registeredBy: form.registeredBy,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        details: parseDetails(form.details),
      });
      setForm({ ...form, quantity: "", description: "", tags: "", details: "" });
      setError(null);
      list.reload();
      products.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1>Ocorrências de perda</h1>
      <div className="card">
        <h2>Registrar perda</h2>
        <form onSubmit={submit}>
          <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label>
              Produto
              <select value={form.productId} onChange={set("productId")} required>
                <option value="">Selecione…</option>
                {products.data?.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} · {p.name} (saldo {p.currentStock})</option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select value={form.type} onChange={set("type")}>
                {OCCURRENCE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Quantidade<input type="number" min={1} value={form.quantity} onChange={set("quantity")} required /></label>
            <label>Local<input value={form.location} onChange={set("location")} placeholder="Corredor 4, doca…" /></label>
            <label>Registrado por<input value={form.registeredBy} onChange={set("registeredBy")} required /></label>
            <label>Tags (separadas por vírgula)<input value={form.tags} onChange={set("tags")} /></label>
          </div>
          <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <label style={{ flex: 2, minWidth: 240 }}>
              Descrição
              <textarea rows={3} value={form.description} onChange={set("description")} required minLength={3} />
            </label>
            <label style={{ flex: 1, minWidth: 200 }}>
              Detalhes livres (uma linha por item, "chave: valor")
              <textarea rows={3} value={form.details} onChange={set("details")} placeholder={"lote: L2309\nvalidade: 2026-11-10"} />
            </label>
          </div>
          <p><button type="submit">Registrar perda</button></p>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="muted">A perda baixa o estoque (PostgreSQL) e guarda os detalhes da ocorrência (MongoDB).</p>
      </div>

      <div className="card table-wrap">
        <h2>Últimas ocorrências</h2>
        <table>
          <thead>
            <tr><th>Data</th><th>SKU</th><th>Tipo</th><th className="num">Qtd.</th><th className="num">Valor</th><th>Descrição</th><th>Detalhes</th></tr>
          </thead>
          <tbody>
            {list.data?.map((o) => (
              <tr key={o._id}>
                <td>{date(o.createdAt)}</td>
                <td>{o.sku}</td>
                <td><span className="badge danger">{o.type}</span></td>
                <td className="num">{o.quantity}</td>
                <td className="num">{brl(o.totalCost)}</td>
                <td>
                  {o.description}
                  {o.location && <div className="muted">{o.location}</div>}
                  {o.tags.length > 0 && <div className="muted">#{o.tags.join(" #")}</div>}
                </td>
                <td className="muted">
                  {Object.entries(o.details).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
