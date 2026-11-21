import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Em desenvolvimento, as chamadas para /api vão para a API na porta 3333.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:3333" } },
});
