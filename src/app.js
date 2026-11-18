import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AppError } from './errors.js';
import { headers, json, readJson, sendError } from './http.js';
import { userRepository } from './users/repository.js';
import { userService } from './users/service.js';

// Lista fechada: não existe rota para baixar o banco, .env ou código do backend.
const assets = new Map([
  ['/', ['../index.html', 'text/html']],
  ['/index.html', ['../index.html', 'text/html']],
  ['/style.css', ['../public/style.css', 'text/css']],
  ['/app.js', ['../public/app.js', 'text/javascript']],
]);

export function createApplication(db, { origins = [] } = {}) {
  const users = userService(userRepository(db));
  const server = createServer(async (request, response) => {
    try {
      headers(request, response, origins);
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname;
      const method = request.method;
      if (method === 'OPTIONS') {
        response.writeHead(204);
        return response.end();
      }
      if (path === '/health' && method === 'GET') return json(response, 200, { status: 'ok' });
      if (path === '/users') {
        if (method === 'GET') return json(response, 200, users.list());
        if (method === 'POST') {
          const user = await users.create(await readJson(request));
          response.setHeader('Location', `/users/${user.id}`);
          return json(response, 201, user);
        }
        response.setHeader('Allow', 'GET, POST, OPTIONS');
        throw new AppError(405, 'Método não permitido nesta rota.');
      }
      const match = path.match(/^\/users\/([^/]+)$/);
      if (match) {
        const id = match[1];
        if (method === 'GET') return json(response, 200, users.find(id));
        if (method === 'PUT' || method === 'PATCH') {
          return json(
            response,
            200,
            await users.update(id, await readJson(request), method === 'PATCH'),
          );
        }
        if (method === 'DELETE') {
          users.remove(id);
          response.writeHead(204);
          return response.end();
        }
        response.setHeader('Allow', 'GET, PUT, PATCH, DELETE, OPTIONS');
        throw new AppError(405, 'Método não permitido nesta rota.');
      }
      if ((method === 'GET' || method === 'HEAD') && assets.has(path)) {
        const [relative, type] = assets.get(path);
        const content = await readFile(fileURLToPath(new URL(relative, import.meta.url)));
        response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        return response.end(method === 'HEAD' ? undefined : content);
      }
      throw new AppError(404, 'Recurso não encontrado.');
    } catch (error) {
      sendError(response, error);
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
