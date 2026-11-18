# Devpool - Gestão de usuários

Aplicação do desafio técnico full-stack: CRUD de usuários com Node.js 24,
SQLite e frontend HTML, CSS e JavaScript puro. Não utiliza API externa.

## Tecnologias e arquitetura

- Node.js 24.x (validado com 24.22.1), módulos ES e servidor HTTP nativo.
- SQLite integrado ao Node (`node:sqlite`), sem servidor de banco separado.
- BCrypt por `bcryptjs` 3.0.2, com custo 12 e salt gerado pela biblioteca.
- Frontend sem frameworks, CDNs, fontes externas ou dependência de internet.
- Testes pela ferramenta nativa `node:test`.

```text
Navegador (index.html + public/app.js + public/style.css)
    -> HTTP / JSON
src/app.js                 rotas e status HTTP
    -> src/users/service.js       regras e hash
        -> src/users/validation.js validação
        -> src/users/repository.js SQL parametrizado
            -> src/database.js    arquivo SQLite no disco local
```

O backend também entrega a tela. Não é necessário abrir dois servidores.
O navegador nunca acessa o banco, os arquivos internos ou o hash de senha.

## Instalar e executar no Windows

Você já informou Node 24.22.1 e npm 11.19.1, suficientes para este projeto.
Não é necessário instalar SQLite separadamente.

Abra o PowerShell na pasta do projeto. No computador com o X: mapeado:

```powershell
Set-Location 'C:\Desenvolvimento\devpool'
npm ci
Copy-Item .env.example .env
npm start
```

Copie `.env.example` somente na primeira configuração. Preserve um `.env`
existente com ajustes próprios. Abra **http://localhost:3101** no mesmo
computador que está executando o Node. Não abra o HTML por duplo clique.
Use Ctrl+C para encerrar. Para iniciar novamente, basta executar `npm start`.
Para desenvolvimento com reinício ao salvar: `npm run dev`.

### Porta e acesso pela rede

A porta padrão é **3101**. A porta 3000 é rejeitada na configuração,
porque pertence ao outro projeto. Antes de iniciar no servidor, confira:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3101 -ErrorAction SilentlyContinue
```

Se houver um processo nessa porta, escolha outra porta no `.env`.
O programa também informa `EADDRINUSE` sem encerrar outros processos.
Por padrão, `HOST=127.0.0.1` permite acesso apenas no próprio computador.
Para uso pela rede interna, ajuste `.env`:

```dotenv
HOST=0.0.0.0
PORT=3101
DATA_DIR=C:/Desenvolvimento/devpool-data
```

### Banco e backup

Sem `DATA_DIR`, o arquivo fica em `%LOCALAPPDATA%\Devpool\data\devpool.sqlite`
no Windows, no perfil de quem iniciou o Node. Em outros sistemas, usa
`~/.local/share/Devpool/data/devpool.sqlite`. O caminho real é mostrado ao iniciar.
É possível definir um diretório local próprio no `.env`.

Não aponte o banco para X:, unidade mapeada ou compartilhamento SMB.
O código pode ficar na rede, mas o arquivo SQLite deve ficar em disco local.
Ao fechar o navegador ou reiniciar o Node, os dados continuam no arquivo.
Outro usuário do Windows pode ter outro diretório padrão; para compartilhar
a mesma base entre execuções, mantenha `DATA_DIR` e o usuário de execução.

Para um backup simples, encerre este Node com Ctrl+C, copie o arquivo
`devpool.sqlite` para um local seguro e inicie novamente. O banco contém
dados pessoais e hashes; não o coloque no repositório público.

## Contrato da API

| Método | Caminho | Resultado |
| --- | --- | --- |
| POST | `/users` | Cria usuário; 201, objeto e cabeçalho Location |
| GET | `/users` | Lista completa; 200 e array |
| GET | `/users/{id}` | Detalhes; 200 ou 404 |
| PUT | `/users/{id}` | Substitui campos editáveis; 200 ou 404 |
| PATCH | `/users/{id}` | Altera somente campos enviados; 200 ou 404 |
| DELETE | `/users/{id}` | Exclusão física; 204 sem corpo ou 404 |
| OPTIONS | rotas da API | Preflight CORS; 204 |
| GET | `/health` | Verificação do processo; 200 |

Envie corpos JSON com `Content-Type: application/json`.

### Campos e decisões

- `id`: UUID gerado no servidor; não é aceito no corpo enviado pelo cliente.
- `name`: texto obrigatório, ao menos 3 caracteres após remover espaços das extremidades.
- `email`: obrigatório e válido; normalizado para minúsculas e único.
- `login`: obrigatório, ao menos 3 caracteres, normalizado para minúsculas e único.
- `password`: obrigatório ao criar e em PUT; mínimo 8 caracteres e máximo 72 bytes UTF-8,
  limite do BCrypt. A senha não é aparada nem truncada.
- `active`: booleano, padrão `true` no cadastro e em PUT quando omitido.
- `created_at` e `updated_at`: datas ISO geradas pelo servidor, não editáveis pelo cliente.
- Campos desconhecidos, tipos errados e dados inválidos retornam **400** com
  `message` e um objeto `errors` por campo. Duplicidade também retorna 400,
  conforme o requisito do desafio. A referência ao nome `password` em um
  erro de validação nunca inclui a senha nem seu hash.
- PATCH permite omitir senha e demais campos: mantém os valores atuais.
  Uma senha enviada vazia é inválida; a tela omite esse campo ao deixá-lo vazio na edição.
  PATCH vazio também é inválido. PUT exige todos os campos obrigatórios.
- Exclusão é física: simplifica a demonstração do CRUD. Inativar pelo formulário
  mantém o cadastro e não equivale a excluí-lo.
- Não há tela de autenticação ou perfis de acesso: não foram pedidos pelo desafio.
  O campo login é um dado do usuário; o aplicativo foi preparado para uso local/interno.

### Exemplos de chamadas no PowerShell

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

Exemplo cURL (Linux/macOS ou terminal com sintaxe equivalente):

```sh
curl -i -X POST http://localhost:3101/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Maria Oliveira","email":"maria@example.com","login":"maria","password":"Senha123!"}'
curl -i http://localhost:3101/users
```

O JSON de um usuário retornado contém apenas `id`, `name`, `email`, `login`,
`active`, `created_at` e `updated_at`. Senha e hash nunca são selecionados
pelas consultas de apresentação.

### CORS e tratamento de erros

A tela entregue usa a mesma origem da API. Para outro frontend HTTP,
adicione a origem exata em `CORS_ORIGINS` no `.env`, separando várias por vírgula.
Exemplo: `CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500`.
A API responde ao preflight e aceita os métodos e Content-Type necessários.
Origens não autorizadas recebem 403; isso não substitui autenticação.
Corpos maiores que 16 KB ou JSON inválido recebem 400. Rotas inexistentes
recebem 404, métodos incompatíveis recebem 405 e falhas internas recebem
500 com mensagem amigável, sem detalhes de SQL ou dados sensíveis.

## Testes e verificação manual

```powershell
npm test
```

São 22 testes automatizados com banco isolado e portas aleatórias. Cobrem
CRUD, UUID, status, hash BCrypt, campos, duplicidade, PUT/PATCH, CORS,
tratamento de JSON, isolamento de arquivos e persistência após reabrir o banco.
Não usam a base de dados da aplicação.

Também foram verificados no navegador: cadastro, edição sem trocar senha,
inativação, busca, filtros, cancelamento e confirmação de exclusão,
validação de duplicidade, carregamento, falha e recuperação de consulta,
renderização segura de texto e apresentação em 1440 px e 390 px.
Para repetir manualmente, percorra esses fluxos e reinicie o Node para
confirmar que um cadastro permanece salvo.

## Arquivos e guia de estudo

O PDF `output/pdf/Guia_de_Estudo_Devpool.pdf` explica a arquitetura, cada
arquivo, os blocos de código por linhas e exercícios de pequenas alterações.
As linhas se referem à versão entregue; editar ou formatar arquivos pode alterá-las.
Ele também contém um manifesto com SHA-256 para conferir a versão dos arquivos.

`package-lock.json` fixa as dependências instaladas por `npm ci`.
Arquivos em `node_modules` pertencem à biblioteca, não ao código autoral
do aplicativo; não devem ser editados nem publicados no Git.

## Entrega em repositório público

O PDF do desafio também exige um repositório público GitHub ou GitLab.
Os arquivos estão preparados para isso, mas criar a pasta compartilhada
não publica um repositório. Escolha o destino na sua conta e publique a
versão revisada, incluindo este README, o código, os testes e o PDF de estudo.
Confira que `.env`, banco, logs e `node_modules` ficaram de fora.
Não é necessário contratar hospedagem para apresentar o sistema localmente.

### Publicar no GitHub pela primeira vez

1. Entre na sua conta GitHub, escolha **New repository**, dê um nome como
   `devpool`, marque **Public** e crie o repositório vazio. Não gere outro README.
2. Se ainda não tiver Git no computador, instale o Git para Windows pelo
   site oficial https://git-scm.com/downloads/win. Ele não é necessário para
   executar o sistema, somente para versionar e publicar.
3. Abra o terminal na pasta deste projeto e execute:

```powershell
git init -b main
git add .
git status
git commit -m "Implementa desafio de gestao de usuarios"
git remote add origin https://github.com/SEU_USUARIO/devpool.git
git push -u origin main
```

Substitua `SEU_USUARIO` e o nome do repositório pela URL real criada no passo 1.
Antes do commit, confira em `git status` que `.env`, banco e `node_modules`
não aparecem. Se Git pedir identidade, configure seu nome e e-mail de autoria
nessa pasta com `git config user.name "Seu nome"` e
`git config user.email "seu-email"`. Conclua a autenticação do GitHub pelo
fluxo oferecido pelo Git; não grave tokens no código ou no README.

Depois de publicar, abra a URL em uma janela sem login para confirmar que
o repositório está público e compartilhe essa URL com a banca. No GitLab,
o procedimento é equivalente: crie projeto público vazio e use a URL dele.
