import { AppError } from './errors.js';

export function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

// Limita o corpo e trata JSON inválido antes de chegar à regra de negócio.
export async function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new AppError(400, 'Envie os dados com Content-Type: application/json.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw new AppError(400, 'O JSON excede o limite de 16 KB.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError(400, 'O corpo da solicitação não contém JSON válido.');
  }
}

export function headers(request, response, origins) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  response.setHeader('Vary', 'Origin');
  const origin = request.headers.origin;
  const sameOrigin = `http://${request.headers.host}`;
  if (origin && origin !== sameOrigin && !origins.includes(origin)) {
    throw new AppError(403, 'Origem não autorizada. Configure CORS_ORIGINS no backend.');
  }
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '600');
}

export function sendError(response, error) {
  if (response.headersSent || response.destroyed) return;
  if (error instanceof AppError) {
    json(response, error.status, { message: error.message, errors: error.fields });
  } else {
    // Não registra payloads, senhas ou hashes.
    console.error('Falha interna:', error.code || error.name);
    json(response, 500, { message: 'Não foi possível concluir a operação. Tente novamente.' });
  }
}
