import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, brl, OCCURRENCE_TYPES } from "../api";
import { useAsync } from "../useAsync";

const COLORS: Record<string, string> = {
  FURTO: "#b42318",
  AVARIA: "#dc6803",
  VENCIMENTO: "#1f4e79",
  OUTRO: "#5d6b7c",
};

export function DashboardPage() {
  const { data, error, loading } = useAsync(api.dashboard);
  if (loading) return <p className="muted">Carregando…</p>;
  if (error || !data) return <p className="error">{error}</p>;

  // Transforma [{month, type, value}] em [{month, FURTO: x, AVARIA: y}] para o gráfico empilhado.
  const byMonth = Object.values(
    data.lossesByMonth.reduce<Record<string, Record<string, string | number>>>((acc, row) => {
      acc[row.month] ??= { month: row.month };
      acc[row.month][row.type] = row.value;
      return acc;
    }, {}),
  );

  const { summary } = data;
  return (
    <>
      <h1>Painel</h1>
      <div className="grid">
        <div className="card kpi"><span>Produtos cadastrados</span><strong>{summary.totalProducts}</strong></div>
        <div className="card kpi"><span>Valor em estoque</span><strong>{brl(summary.stockValue)}</strong></div>
        <div className="card kpi"><span>Abaixo do mínimo</span><strong>{summary.lowStockCount}</strong></div>
        <div className="card kpi"><span>Perdas no mês</span><strong className="neg">{brl(summary.lossesThisMonth)}</strong></div>
      </div>

      <div className="card">
        <h2>Perdas por mês e tipo (R$)</h2>
        {byMonth.length === 0 ? (
          <p className="muted">Nenhuma perda registrada nos últimos 6 meses.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => brl(Number(v))} />
              <Legend />
              {OCCURRENCE_TYPES.map((t) => (
                <Bar key={t} dataKey={t} stackId="perdas" fill={COLORS[t]} maxBarSize={90} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <h2>Estoque abaixo do mínimo</h2>
          <table>
            <thead><tr><th>Produto</th><th className="num">Saldo</th><th className="num">Mínimo</th></tr></thead>
            <tbody>
              {data.lowStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.sku} · {p.name}</td>
                  <td className="num neg">{p.currentStock}</td>
                  <td className="num">{p.minStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Produtos com mais perdas</h2>
          <table>
            <thead><tr><th>SKU</th><th className="num">Ocorrências</th><th className="num">Total</th></tr></thead>
            <tbody>
              {data.topLossProducts.map((p) => (
                <tr key={p.sku}>
                  <td>{p.sku}</td>
                  <td className="num">{p.occurrences}</td>
                  <td className="num">{brl(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
