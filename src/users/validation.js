import { AppError } from '../errors.js';

// PATCH aceita campos omitidos; qualquer valor enviado continua sendo validado.
export function validateUser(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'Envie um objeto JSON.');
  }
  const allowed = ['name', 'email', 'login', 'password', 'active'];
  const fields = Object.create(null),
    value = {};
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) fields[key] = 'Campo não permitido.';
  }
  for (const key of ['name', 'email', 'login', 'password']) {
    if (partial && !Object.hasOwn(body, key)) continue;
    if (typeof body[key] !== 'string') {
      fields[key] = 'Campo obrigatório em formato de texto.';
      continue;
    }
    value[key] = key === 'password' ? body[key] : body[key].trim();
    const min = key === 'password' ? 8 : key === 'email' ? 1 : 3;
    if ([...value[key]].length < min) fields[key] = `Use pelo menos ${min} caracteres.`;
    if (key !== 'password' && value[key].length > 254)
      fields[key] = 'Use no máximo 254 caracteres.';
  }
  if (value.email !== undefined) {
    value.email = value.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) fields.email = 'Informe um e-mail válido.';
  }
  if (value.login !== undefined) value.login = value.login.toLowerCase();
  // BCrypt limita a entrada a 72 bytes. Rejeitar evita truncamento silencioso.
  if (value.password !== undefined && Buffer.byteLength(value.password, 'utf8') > 72) {
    fields.password = 'A senha deve ter no máximo 72 bytes em UTF-8.';
  }
  if (Object.hasOwn(body, 'active')) {
    if (typeof body.active !== 'boolean') fields.active = 'Informe true ou false.';
    else value.active = body.active;
  } else if (!partial) value.active = true;
  if (partial && Object.keys(body).length === 0)
    fields.body = 'Envie ao menos um campo para alterar.';
  if (Object.keys(fields).length) throw new AppError(400, 'Revise os campos informados.', fields);
  return value;
}
