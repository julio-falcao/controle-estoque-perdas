// Erro de regra de negócio: vira uma resposta HTTP com status e mensagem claros.
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
