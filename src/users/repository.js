const columns = 'id, name, email, login, active, created_at, updated_at';
const present = (row) => (row ? { ...row, active: Boolean(row.active) } : null);

// Parâmetros ? separam os valores do SQL e evitam injeção.
export function userRepository(db) {
  const list = db.prepare(`SELECT ${columns} FROM users ORDER BY created_at DESC, id`);
  const find = db.prepare(`SELECT ${columns} FROM users WHERE id = ?`);
  const insert = db.prepare(`INSERT INTO users
    (id, name, email, login, password_hash, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(
    `UPDATE users SET name=?, email=?, login=?, active=?, updated_at=? WHERE id=?`,
  );
  const password = db.prepare('UPDATE users SET password_hash=? WHERE id=?');
  const remove = db.prepare('DELETE FROM users WHERE id=?');
  return {
    list: () => list.all().map(present),
    find: (id) => present(find.get(id)),
    create(user, hash) {
      insert.run(
        user.id,
        user.name,
        user.email,
        user.login,
        hash,
        Number(user.active),
        user.created_at,
        user.updated_at,
      );
      return this.find(user.id);
    },
    update(user, hash) {
      // Os campos e a senha são alterados na mesma transação.
      db.exec('BEGIN IMMEDIATE');
      try {
        update.run(
          user.name,
          user.email,
          user.login,
          Number(user.active),
          user.updated_at,
          user.id,
        );
        if (hash) password.run(hash, user.id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return this.find(user.id);
    },
    remove: (id) => remove.run(id).changes > 0,
  };
}
