import { defineConfig } from "vitest/config";

// Os testes usam bancos SEPARADOS (estoque_test) para nunca apagar os dados de desenvolvimento.
export default defineConfig({
  test: {
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgres://estoque:estoque@localhost:5432/estoque_test",
      MONGO_URL: process.env.TEST_MONGO_URL ?? "mongodb://localhost:27017/estoque_test",
    },
    // Os testes de integração compartilham o mesmo banco, então rodam um arquivo por vez.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
