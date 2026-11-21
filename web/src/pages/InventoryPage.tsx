import { useState } from "react";
import { api, brl, date, type Inventory } from "../api";
import { useAsync } from "../useAsync";

export function InventoryPage() {
  const list = useAsync(api.inventories);
  const [current, setCurrent] = useState<Inventory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<Inventory>) {
    try {
      setCurrent(await action());
      setError(null);
      list.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const open = list.data?.find((i) => i.status === "ABERTO");

  return (
    <>
      <h1>Inventário</h1>
      <div className="card">
        <p className="muted">
          Ao abrir, o sistema guarda o saldo de cada produto. Depois da contagem física, o fechamento
          gera um ajuste para cada divergência.
        </p>
        {open ? (
          <button onClick={() => run(() => api.inventory(open.id))}>Continuar inventário #{open.id}</button>
        ) : (
          <button onClick={() => run(() => api.openInventory({}))}>Abrir novo inventário</button>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      {current && <InventoryDetail key={current.id} inventory={current} onChange={run} />}

      <div className="card table-wrap">
        <h2>Histórico</h2>
        <table>
          <thead><tr><th>#</th><th>Status</th><th>Aberto em</th><th>Fechado em</th><th></th></tr></thead>
          <tbody>
            {list.data?.map((i) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td><span className={`badge ${i.status === "ABERTO" ? "danger" : "ok"}`}>{i.status}</span></td>
                <td>{date(i.createdAt)}</td>
                <td>{i.closedAt ? date(i.closedAt) : "—"}</td>
                <td><button className="secondary" onClick={() => run(() => api.inventory(i.id))}>Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InventoryDetail({ inventory, onChange }: { inventory: Inventory; onChange: (a: () => Promise<Inventory>) => void }) {
  const isOpen = inventory.status === "ABERTO";
  const s = inventory.summary!;
  return (
    <div className="card">
      <h2>Inventário #{inventory.id} · {inventory.status}</h2>
      <div className="grid">
        <div className="kpi"><span>Contados</span><strong>{s.countedItems}/{s.totalItems}</strong></div>
        <div className="kpi"><span>Acurácia</span><strong>{s.accuracy}%</strong></div>
        <div className="kpi"><span>Faltas</span><strong className="neg">{brl(s.shortageValue)}</strong></div>
        <div className="kpi"><span>Sobras</span><strong className="pos">{brl(s.surplusValue)}</strong></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Produto</th><th className="num">Sistema</th><th className="num">Contado</th><th className="num">Diferença</th></tr>
          </thead>
          <tbody>
            {inventory.items!.map((item) => {
              const diff = item.countedQty === null ? null : item.countedQty - item.systemQty;
              return (
                <tr key={item.productId}>
                  <td>{item.sku} · {item.name}</td>
                  <td className="num">{item.systemQty}</td>
                  <td className="num">
                    {isOpen ? (
                      <input
                        type="number"
                        min={0}
                        defaultValue={item.countedQty ?? ""}
                        style={{ width: 90 }}
                        // Salva ao sair do campo, sem precisar de botão por linha.
                        onBlur={(e) => {
                          if (e.target.value === "" || Number(e.target.value) === item.countedQty) return;
                          onChange(() => api.count(inventory.id, item.productId, Number(e.target.value)));
                        }}
                      />
                    ) : (
                      item.countedQty
                    )}
                  </td>
                  <td className={`num ${diff ? (diff > 0 ? "pos" : "neg") : ""}`}>
                    {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {isOpen && (
        <p>
          <button
            disabled={s.countedItems < s.totalItems}
            onClick={() => onChange(() => api.closeInventory(inventory.id))}
          >
            Fechar inventário e gerar ajustes
          </button>
        </p>
      )}
    </div>
  );
}
