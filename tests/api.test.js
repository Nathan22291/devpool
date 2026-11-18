import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { openDatabase } from '../src/database.js';
import { createApplication } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// Cada cenário recebe banco isolado e porta aleatória. Nunca usa a porta 3000.
async function fixture(t, filename = ':memory:') {
  const db = openDatabase(filename);
  const server = createApplication(db, { origins: ['http://localhost:5500'] });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    db,
    base,
    async request(path, method = 'GET', body, extra = {}) {
      const response = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...extra },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      return {
        status: response.status,
        headers: response.headers,
        data: text ? JSON.parse(text) : null,
      };
    },
  };
}
const valid = (extra = {}) => ({
  name: 'Maria Oliveira',
  email: 'maria@example.com',
  login: 'maria',
  password: 'Senha123!',
  ...extra,
});
function safe(user) {
  assert.equal(Object.hasOwn(user, 'password'), false);
  assert.equal(Object.hasOwn(user, 'password_hash'), false);
}

test('CRUD completo: status HTTP, UUID, normalização, hash, PUT, PATCH e exclusão física', async (t) => {
  const f = await fixture(t);
  assert.deepEqual((await f.request('/users')).data, []);
  const created = await f.request(
    '/users',
    'POST',
    valid({ name: '  Maria Oliveira  ', email: 'MARIA@example.com', login: 'MARIA' }),
  );
  assert.equal(created.status, 201);
  const user = created.data;
  assert.match(user.id, /^[0-9a-f-]{36}$/);
  assert.equal(user.name, 'Maria Oliveira');
  assert.equal(user.email, 'maria@example.com');
  assert.equal(user.login, 'maria');
  assert.equal(user.active, true);
  assert.equal(created.headers.get('location'), `/users/${user.id}`);
  safe(user);
  const stored = f.db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
  assert.notEqual(stored.password_hash, 'Senha123!');
  assert.match(stored.password_hash, /^\$2[ab]\$12\$/);
  assert.equal(await bcrypt.compare('Senha123!', stored.password_hash), true);
  const listed = await f.request('/users');
  assert.equal(listed.status, 200);
  safe(listed.data[0]);
  const found = await f.request(`/users/${user.id}`);
  assert.equal(found.status, 200);
  safe(found.data);
  const patched = await f.request(`/users/${user.id}`, 'PATCH', {
    name: 'Maria Silva',
    active: false,
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.active, false);
  assert.equal(patched.data.email, user.email);
  assert.equal(
    f.db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id).password_hash,
    stored.password_hash,
  );
  const replaced = await f.request(
    `/users/${user.id}`,
    'PUT',
    valid({ name: 'Maria Souza', password: 'Outra123!' }),
  );
  assert.equal(replaced.status, 200);
  assert.equal(replaced.data.active, true);
  safe(replaced.data);
  assert.equal(
    await bcrypt.compare(
      'Outra123!',
      f.db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id).password_hash,
    ),
    true,
  );
  assert.equal((await f.request(`/users/${user.id}`, 'DELETE')).status, 204);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS total FROM users').get().total, 0);
  assert.equal((await f.request(`/users/${user.id}`)).status, 404);
});

const invalid = [
  ['nome ausente', { name: undefined }],
  ['nome curto após trim', { name: '  ab  ' }],
  ['e-mail ausente', { email: undefined }],
  ['e-mail inválido', { email: 'invalido' }],
  ['login ausente', { login: undefined }],
  ['login curto', { login: 'ab' }],
  ['senha ausente', { password: undefined }],
  ['senha curta', { password: '1234567' }],
  ['senha acima de 72 bytes', { password: 'á'.repeat(37) }],
  ['status textual', { active: 'false' }],
  ['status null', { active: null }],
  ['nome numérico', { name: 123 }],
  ['ID fornecido pelo cliente', { id: 'forjado' }],
  ['hash fornecido pelo cliente', { password_hash: 'forjado' }],
];
for (const [name, change] of invalid) {
  test(`POST rejeita ${name} com 400 e mensagem`, async (t) => {
    const f = await fixture(t);
    const result = await f.request('/users', 'POST', valid(change));
    assert.equal(result.status, 400);
    assert.equal(typeof result.data.message, 'string');
    assert.deepEqual((await f.request('/users')).data, []);
  });
}

test('uniquidade no cadastro e edição, inclusive com letras maiúsculas; rollback preserva dados', async (t) => {
  const f = await fixture(t);
  const first = (await f.request('/users', 'POST', valid())).data;
  const second = (
    await f.request('/users', 'POST', valid({ email: 'outra@example.com', login: 'outra' }))
  ).data;
  for (const change of [
    { email: 'MARIA@example.com', login: 'nova' },
    { email: 'nova@example.com', login: 'MARIA' },
  ]) {
    assert.equal((await f.request('/users', 'POST', valid(change))).status, 400);
    assert.equal((await f.request(`/users/${second.id}`, 'PATCH', change)).status, 400);
  }
  assert.equal((await f.request(`/users/${second.id}`)).data.email, second.email);
  assert.equal(
    (await f.request(`/users/${first.id}`, 'PATCH', { email: first.email })).status,
    200,
  );
  for (const body of [
    { password: '' },
    { name: 'x' },
    { email: 'x' },
    { login: 'x' },
    { active: 0 },
    {},
  ]) {
    assert.equal((await f.request(`/users/${first.id}`, 'PATCH', body)).status, 400);
  }
  assert.equal((await f.request(`/users/${first.id}`, 'PUT', { name: 'Novo Nome' })).status, 400);
});

test('404 para usuário inexistente em GET, PUT, PATCH e DELETE', async (t) => {
  const f = await fixture(t);
  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(
      (
        await f.request(
          '/users/inexistente',
          method,
          ['PUT', 'PATCH'].includes(method) ? valid() : undefined,
        )
      ).status,
      404,
    );
  }
});

test('JSON inválido, tipos, tamanho, Content-Type e métodos não permitidos', async (t) => {
  const f = await fixture(t);
  for (const body of [[], null, 'texto', 1])
    assert.equal((await f.request('/users', 'POST', body)).status, 400);
  for (const body of ['{', 'x'.repeat(17000)]) {
    const response = await fetch(f.base + '/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    assert.equal(response.status, 400);
    await response.text();
  }
  assert.equal(
    (await f.request('/users', 'POST', valid(), { 'Content-Type': 'text/plain' })).status,
    400,
  );
  assert.equal((await f.request('/users', 'DELETE')).status, 405);
  assert.equal((await f.request('/inexistente')).status, 404);
});

test('CORS aceita origem configurada e preflight; bloqueia outra origem antes de gravar', async (t) => {
  const f = await fixture(t);
  const allowed = await f.request('/users', 'GET', undefined, { Origin: 'http://localhost:5500' });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5500');
  const preflight = await f.request('/users', 'OPTIONS', undefined, {
    Origin: 'http://localhost:5500',
    'Access-Control-Request-Method': 'POST',
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods'), /PATCH/);
  const blocked = await f.request('/users', 'POST', valid(), { Origin: 'https://outro.example' });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  assert.deepEqual((await f.request('/users')).data, []);
});

test('HTML/CSS/JS acessíveis; banco, .env e backend não são servidos', async (t) => {
  const f = await fixture(t);
  for (const path of ['/', '/style.css', '/app.js'])
    assert.equal((await fetch(f.base + path)).status, 200);
  for (const path of ['/data/devpool.sqlite', '/.env', '/src/server.js', '/package.json']) {
    assert.equal((await f.request(path)).status, 404);
  }
});

test('dados persistem ao fechar e reabrir o arquivo SQLite', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'devpool-test-'));
  const filename = join(directory, 'test.sqlite');
  let db;
  let server;
  try {
    db = openDatabase(filename);
    server = createApplication(db);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base + '/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valid()),
    });
    const user = await response.json();
    await new Promise((resolve) => server.close(resolve));
    server = null;
    db.close();
    db = openDatabase(filename);
    assert.equal(db.prepare('SELECT name FROM users WHERE id=?').get(user.id).name, user.name);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    db?.close();
    rmSync(directory, { recursive: true });
  }
});

test('configuração reserva a porta 3000 e escolhe banco local por padrão', () => {
  assert.equal(loadConfig({}).port, 3101);
  assert.throws(() => loadConfig({ PORT: '3000' }), /3000/);
  assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT/);
  assert.throws(() => loadConfig({ DATA_DIR: '\\\\servidor\\pasta' }), /disco local/);
  assert.equal(loadConfig({}).dataDir.startsWith('\\\\'), false);
});
