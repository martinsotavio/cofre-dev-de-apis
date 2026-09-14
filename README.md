# Cofre de Senhas — Trabalho Prático de APIs

Trabalho da disciplina de APIs: uma aplicação de cofre de senhas (CRUD de
credenciais) com persistência em banco de dados e arquitetura distribuída.

- **API** (Node/Express) com CRUD de credenciais, autenticação por JWT e
  senhas criptografadas com AES-256-GCM antes de ir para o banco.
- **Gateway** (Nginx) na frente da API, com rate limit no login (contra
  força bruta) e load balancing entre duas instâncias da API.
- **Mensageria** (RabbitMQ): ao cadastrar uma credencial, dois eventos são
  publicados — um dispara um e-mail de notificação, outro grava um registro
  de auditoria no banco.
- **PostgreSQL** para persistência (usuários, credenciais, auditoria).

As decisões de arquitetura e o porquê de cada escolha estão em
[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Como rodar

```
cp .env.example .env
```

Preenche `JWT_SECRET` e `VAULT_ENC_KEY` no `.env` (gera cada um com
`openssl rand -hex 32`).

```
docker compose up --build
```

Aplicação em **http://localhost:8080**. Painel do RabbitMQ em
**http://localhost:15672** (usuário/senha no `.env`).

Requer Docker e Docker Compose v2. O comando acima sobe tudo — banco, filas,
gateway e as duas instâncias da API esperam as dependências ficarem prontas
antes de iniciar, sem nenhum passo manual extra.

## Estrutura

- `api/` — API principal (auth + CRUD do cofre)
- `worker-notifications/` e `worker-audit/` — consumidores do RabbitMQ
- `gateway/` — config do Nginx
- `frontend/` — HTML/CSS/JS, sem framework
- `db/` — schema do Postgres

Projeto acadêmico — não usar para guardar senhas reais.
