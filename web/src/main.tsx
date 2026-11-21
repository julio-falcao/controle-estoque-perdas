import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import "./styles.css";

// Cada página é carregada só quando é aberta (o gráfico do painel é a parte mais pesada).
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ProductsPage = lazy(() => import("./pages/ProductsPage").then((m) => ({ default: m.ProductsPage })));
const MovementsPage = lazy(() => import("./pages/MovementsPage").then((m) => ({ default: m.MovementsPage })));
const InventoryPage = lazy(() => import("./pages/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const OccurrencesPage = lazy(() => import("./pages/OccurrencesPage").then((m) => ({ default: m.OccurrencesPage })));

const links = [
  ["/", "Painel"],
  ["/produtos", "Produtos"],
  ["/movimentacoes", "Movimentações"],
  ["/inventario", "Inventário"],
  ["/ocorrencias", "Ocorrências"],
] as const;

function App() {
  return (
    <BrowserRouter>
      <header className="topbar">
        <strong>Estoque &amp; Perdas</strong>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Suspense fallback={<p className="muted">Carregando…</p>}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/movimentacoes" element={<MovementsPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/ocorrencias" element={<OccurrencesPage />} />
          </Routes>
        </Suspense>
      </main>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
