import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// O banco fica em disco local, mesmo se o código estiver no compartilhamento.
export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3101);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 3000) {
    throw new Error('PORT deve ser uma porta válida diferente de 3000.');
  }
  const base = env.LOCALAPPDATA || join(homedir(), '.local', 'share');
  const dataDir = resolve(env.DATA_DIR || join(base, 'Devpool', 'data'));
  if (dataDir.startsWith('\\\\')) {
    throw new Error('DATA_DIR deve apontar para disco local, não para um compartilhamento.');
  }
  return {
    host: env.HOST || '127.0.0.1',
    port,
    dataDir,
    origins: (env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
