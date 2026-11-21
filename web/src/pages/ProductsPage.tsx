import { useState, type FormEvent } from "react";
import { api, brl } from "../api";
import { useAsync } from "../useAsync";

const empty = { sku: "", name: "", category: "", unitCost: "", minStock: "" };

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const query = `?search=${encodeURIComponent(search)}${lowStock ? "&lowStock=true" : ""}`;
  const { data, error, reload } = useAsync(() => api.products(query), [query]);

  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createProduct({
        sku: form.sku,
        name: form.name,
        category: form.category,
        unitCost: Number(form.unitCost),
        minStock: Number(form.minStock || 0),
      });
      setForm(empty);
      setFormError(null);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  const field = (key: keyof typeof empty, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required={key !== "minStock"}
      />
    </label>
  );

  return (
    <>
      <h1>Produtos</h1>
      <div className="card">
        <h2>Novo produto</h2>
        <form className="row" onSubmit={submit}>
          {field("sku", "SKU")}
          {field("name", "Nome")}
          {field("category", "Categoria")}
          {field("unitCost", "Custo unitário (R$)", "number")}
          {field("minStock", "Estoque mínimo", "number")}
          <button type="submit">Cadastrar</button>
        </form>
        {formError && <p className="error">{formError}</p>}
        <p className="muted">O saldo começa em zero e só muda por movimentações.</p>
      </div>

      <div className="card">
        <form className="row" onSubmit={(e) => e.preventDefault()}>
          <label>
            Buscar por SKU ou nome
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label style={{ flexDirection: "row", alignItems: "center" }}>
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
            Só abaixo do mínimo
          </label>
        </form>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th><th>Nome</th><th>Categoria</th>
                <th className="num">Custo</th><th className="num">Saldo</th><th className="num">Mínimo</th><th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((p) => (
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td className="num">{brl(p.unitCost)}</td>
                  <td className="num">{p.currentStock}</td>
                  <td className="num">{p.minStock}</td>
                  <td>
                    {p.currentStock <= p.minStock
                      ? <span className="badge danger">Repor</span>
                      : <span className="badge ok">OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
