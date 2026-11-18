import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { AppError } from '../errors.js';
import { validateUser } from './validation.js';

// Regras de negócio independentes de HTTP e SQL.
export function userService(repository) {
  const find = (id) => {
    const user = repository.find(id);
    if (!user) throw new AppError(404, 'Usuário não encontrado.');
    return user;
  };
  function translateConflict(error) {
    if (error.message?.includes('UNIQUE constraint failed: users.')) {
      const field = error.message.includes('users.email') ? 'email' : 'login';
      throw new AppError(400, 'Já existe um usuário com este e-mail ou login.', {
        [field]: 'Este valor já está em uso.',
      });
    }
    throw error;
  }
  return {
    list: () => repository.list(),
    find,
    async create(body) {
      const { password, ...value } = validateUser(body);
      const hash = await bcrypt.hash(password, 12);
      const now = new Date().toISOString();
      try {
        return repository.create(
          { ...value, id: randomUUID(), created_at: now, updated_at: now },
          hash,
        );
      } catch (error) {
        translateConflict(error);
      }
    },
    async update(id, body, partial) {
      find(id);
      const { password, ...value } = validateUser(body, partial);
      const hash = password === undefined ? undefined : await bcrypt.hash(password, 12);
      // Releitura após o hash preserva alterações concorrentes em outros campos.
      const current = find(id);
      try {
        return repository.update(
          { ...current, ...value, updated_at: new Date().toISOString() },
          hash,
        );
      } catch (error) {
        translateConflict(error);
      }
    },
    remove(id) {
      find(id);
      repository.remove(id);
    },
  };
}
