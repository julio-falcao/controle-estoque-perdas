import { z } from "zod";

// Valida as variáveis de ambiente na inicialização: se faltar alguma, a API nem sobe.
const schema = z.object({
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  MONGO_URL: z.string().min(1),
});

export const env = schema.parse(process.env);
