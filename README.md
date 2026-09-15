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

Requer Docker e Docker Compose v2. O comando acima sobe tudo — banco, filas,
gateway e as duas instâncias da API esperam as dependências ficarem prontas
antes de iniciar, sem nenhum passo manual extra.

## Portas e variáveis de ambiente

| Porta | Serviço |
|---|---|
| 8080 | Aplicação (frontend + API via gateway) |
| 5432 | PostgreSQL |
| 5672 | RabbitMQ (AMQP) |
| 15672 | Painel do RabbitMQ (usuário/senha no `.env`) |

Todas as variáveis usadas (`.env`) estão listadas e comentadas em
[`.env.example`](.env.example) — `JWT_SECRET` e `VAULT_ENC_KEY` são
obrigatórias; `SMTP_*` é opcional (sem elas, o e-mail de notificação usa o
Ethereal em vez de SMTP real).

## Estrutura

- `api/` — API principal (auth + CRUD do cofre)
- `worker-notifications/` e `worker-audit/` — consumidores do RabbitMQ
- `gateway/` — config do Nginx
- `frontend/` — HTML/CSS/JS, sem framework
- `db/` — schema do Postgres

Projeto acadêmico — não usar para guardar senhas reais.
