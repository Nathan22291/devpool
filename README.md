# Devpool - Gestão de Usuários

Aplicação full-stack do desafio técnico: CRUD de usuários com API REST em Node.js, banco SQLite e frontend em HTML, CSS e JavaScript puro.

## Tecnologias

**Backend**
- Node.js 24 ou superior, com módulos ES e servidor HTTP nativo (sem framework)
- SQLite integrado ao Node (`node:sqlite`), sem precisar instalar banco separado
- `bcryptjs` para o hash das senhas (BCrypt, custo 12)
- Testes com a ferramenta nativa `node:test`

**Frontend**
- HTML, CSS e JavaScript puro (Vanilla JS), sem frameworks nem CDNs
- O próprio backend entrega a tela, então basta um servidor

## Arquitetura

```text
Navegador (index.html + public/app.js + public/style.css)
    -> HTTP / JSON
src/app.js                      rotas e status HTTP
    -> src/users/service.js     regras de negócio e hash da senha
        -> src/users/validation.js   validação dos dados
        -> src/users/repository.js   SQL parametrizado
            -> src/database.js       arquivo SQLite
```

O navegador nunca acessa o banco diretamente. Toda operação passa pela API REST.

## Como executar

Pré-requisito: Node.js 24 ou superior (`node -v` para conferir).

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

Depois abra **http://localhost:3101** no navegador.

- Para encerrar o servidor: `Ctrl+C`
- Para reiniciar automaticamente ao salvar arquivos: `npm run dev`
- Não abra o `index.html` com duplo clique. Ele precisa ser acessado pelo servidor.

No Linux/macOS, use `cp .env.example .env` no lugar de `Copy-Item`.

### Configuração (`.env`)

| Variável | Para que serve | Padrão |
| --- | --- | --- |
| `PORT` | Porta do servidor | `3101` |
| `HOST` | Endereço de escuta | `127.0.0.1` |
| `DATA_DIR` | Pasta onde fica o arquivo do banco | pasta local do usuário |
| `CORS_ORIGINS` | Origens extras permitidas (separadas por vírgula) | vazio |

O caminho do banco aparece no terminal ao iniciar. Ele não vai para o repositório.

## API

| Método | Caminho | Resultado |
| --- | --- | --- |
| POST | `/users` | Cria usuário. Retorna 201 e o usuário com `id` |
| GET | `/users` | Lista todos. Retorna 200 |
| GET | `/users/{id}` | Detalhe. Retorna 200 ou 404 |
| PUT | `/users/{id}` | Substitui os campos editáveis. Retorna 200 ou 404 |
| PATCH | `/users/{id}` | Altera só os campos enviados. Retorna 200 ou 404 |
| DELETE | `/users/{id}` | Exclui. Retorna 204 ou 404 |
| GET | `/health` | Verifica se o servidor está no ar |

Envie o corpo em JSON com `Content-Type: application/json`.

### Campos e regras

- `id`: UUID gerado pelo servidor. Não é aceito no corpo da requisição.
- `name`: obrigatório, mínimo de 3 caracteres (sem contar espaços nas pontas).
- `email`: obrigatório, formato válido e único. Guardado em minúsculas.
- `login`: obrigatório, mínimo de 3 caracteres e único. Guardado em minúsculas.
- `password`: obrigatório, mínimo de 8 caracteres. Guardada com hash BCrypt e **nunca** devolvida pela API.
- `active`: booleano. Padrão `true` quando não informado.
- `created_at` e `updated_at`: datas geradas pelo servidor.

Dados ausentes ou inválidos retornam **400** com um JSON explicativo:

```json
{
  "message": "Revise os campos informados.",
  "errors": {
    "name": "Use pelo menos 3 caracteres.",
    "email": "Informe um e-mail válido."
  }
}
```

E-mail ou login repetidos também retornam 400. Rotas inexistentes retornam 404.

### Exemplos de chamadas (PowerShell)

```powershell
$base = 'http://localhost:3101'
$body = @{
  name = 'Maria Oliveira'
  email = 'maria@example.com'
  login = 'maria'
  password = 'Senha123!'
  active = $true
} | ConvertTo-Json

$user = Invoke-RestMethod "$base/users" -Method Post -ContentType 'application/json' -Body $body
Invoke-RestMethod "$base/users"
Invoke-RestMethod "$base/users/$($user.id)"
Invoke-RestMethod "$base/users/$($user.id)" -Method Patch -ContentType 'application/json' -Body '{"active":false}'
Invoke-RestMethod "$base/users/$($user.id)" -Method Delete
```

### Exemplo com cURL

```sh
curl -i -X POST http://localhost:3101/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Maria Oliveira","email":"maria@example.com","login":"maria","password":"Senha123!"}'

curl -i http://localhost:3101/users
```

### Formato do JSON retornado

```json
{
  "id": "ea659411-c981-447e-a6cd-28e097521452",
  "name": "Maria Oliveira",
  "email": "maria@example.com",
  "login": "maria",
  "active": true,
  "created_at": "2026-11-18T12:00:14.310Z",
  "updated_at": "2026-11-18T12:00:14.310Z"
}
```

## CORS

A tela usa a mesma origem da API, então funciona sem configuração extra. Para usar outro frontend, adicione a origem em `CORS_ORIGINS` no `.env`:

```dotenv
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
```

A API responde ao preflight (`OPTIONS`) das origens permitidas. Origens não autorizadas recebem 403.

## Decisões de projeto

- **Exclusão física:** o registro é removido de vez. Foi escolhido por simplicidade na demonstração do CRUD. Para apenas desativar um usuário, o formulário de edição altera o campo `active`.
- **UUID como identificador:** não é sequencial, então não revela a quantidade de usuários nem permite adivinhar IDs.
- **Validação em duas camadas:** o formulário valida no navegador para dar resposta rápida, e a API valida de novo, porque a tela pode ser ignorada por quem chama a API diretamente.
- **Senha com BCrypt:** o hash é irreversível e nunca é selecionado nas consultas de apresentação.
- Não há autenticação nem perfis de acesso, pois não foram pedidos no desafio.

## Testes

```powershell
npm test
```

São 22 testes automatizados, com banco isolado e portas aleatórias, que não alteram os dados da aplicação. Cobrem CRUD, status HTTP, UUID, hash, validações, duplicidade, PUT e PATCH, CORS, tratamento de JSON inválido e persistência.

## Estrutura de pastas

```text
index.html            estrutura da tela
public/app.js         lógica da tela (chamadas à API)
public/style.css      visual
src/server.js         inicia o servidor
src/app.js            rotas e status HTTP
src/config.js         leitura do .env
src/database.js       conexão e criação da tabela
src/errors.js         erros padronizados
src/http.js           utilitários HTTP (JSON, CORS)
src/users/            validação, regras e acesso ao banco
tests/api.test.js     testes automatizados
```
