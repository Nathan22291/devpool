// Erros previstos podem ser exibidos; detalhes internos nunca vão para o JSON.
export class AppError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
