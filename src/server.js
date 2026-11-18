import { join } from 'node:path';
import { loadConfig } from './config.js';
import { openDatabase } from './database.js';
import { createApplication } from './app.js';

// Ponto de entrada: conecta as peças e escuta somente na porta configurada.
const config = loadConfig();
const filename = join(config.dataDir, 'devpool.sqlite');
const db = openDatabase(filename);
const server = createApplication(db, config);
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `A porta ${config.port} está ocupada. Altere PORT no .env; a porta 3000 é reservada.`
      : `Falha ao iniciar o servidor: ${error.code || error.name}`,
  );
  db.close();
  process.exitCode = 1;
});
server.listen(config.port, config.host, () => {
  console.log(`Devpool: http://${config.host}:${config.port}`);
  console.log(`Banco local: ${filename}`);
});

// Ctrl+C encerra conexões antes de fechar o banco.
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    db.close();
  });
  server.closeIdleConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
