import pg from "pg";
import { env } from "../config/env.js";

// O driver devolve NUMERIC como texto para não perder precisão; aqui convertemos para number,
// o que é seguro para valores monetários com 2 casas decimais.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
// COUNT(*) e SUM() de inteiros voltam como BIGINT (texto); os volumes deste sistema cabem em number.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Executa uma função dentro de uma transação: se algo falhar, nada é gravado.
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
