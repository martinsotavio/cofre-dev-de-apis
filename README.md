# Cofre de Senhas — Trabalho Prático de APIs

API RESTful com persistência em PostgreSQL, gateway com rate limiting e load
balancing (Nginx) e mensageria assíncrona com RabbitMQ (envio de e-mail de
notificação + trilha de auditoria).

Ver decisões de arquitetura em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Requisitos

- Docker
- Docker Compose v2 (`docker compose version`)

## Como rodar

1. Copie o arquivo de variáveis de ambiente e ajuste os segredos:

   ```
   cp .env.example .env
   ```

   Gere valores para `JWT_SECRET` e `VAULT_ENC_KEY` com:

   ```
   openssl rand -hex 32
   ```

2. Suba tudo com um único comando:

   ```
   docker compose up --build
   ```

3. Acesse a aplicação em **http://localhost:8080**.

Nenhum passo manual adicional é necessário: o banco é inicializado
automaticamente (`db/init.sql`), e a API e os workers esperam o Postgres e o
RabbitMQ ficarem prontos antes de iniciar.

## Portas usadas

| Porta | Serviço |
|---|---|
| 8080 | Aplicação (frontend + API via gateway) |
| 5432 | PostgreSQL (acesso direto para depuração) |
| 5672 | RabbitMQ (protocolo AMQP) |
| 15672 | Painel de administração do RabbitMQ (usuário/senha em `.env`) |

## Testando a aplicação

1. Abra **http://localhost:8080**, cadastre um usuário e faça login.
2. Cadastre uma credencial (serviço, usuário, senha). Isso deve:
   - Aparecer na lista imediatamente (via `GET /vault-items`);
   - Disparar um e-mail de notificação: se `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`
     estiverem configurados no `.env`, o e-mail chega de verdade na caixa de
     entrada; caso contrário, o worker usa o Ethereal (e-mail de teste) e
     mostra um link de preview nos logs: `docker compose logs -f worker-notifications`;
   - Gravar um evento de auditoria — confira com:
     ```
     docker compose exec postgres psql -U vaultuser -d vaultdb -c "SELECT * FROM audit_log ORDER BY id DESC LIMIT 5;"
     ```
3. Para ver o load balancing entre as duas instâncias da API em ação:
   ```
   for i in 1 2 3 4; do curl -s http://localhost:8080/api/health; echo; done
   ```
   O campo `instance` deve alternar entre `api1` e `api2`.
4. Para ver o rate limit em ação, tente logar várias vezes seguidas com
   senha errada — a partir da 3ª tentativa no mesmo minuto, o gateway passa a
   responder `503` antes mesmo de chegar na API.
5. O painel do RabbitMQ (http://localhost:15672) mostra as filas
   `notifications` e `audit-log`, com o número de mensagens publicadas e
   consumidas.

## Variáveis de ambiente

Ver `.env.example` para a lista completa. Nenhuma credencial real está
commitada no repositório — o `.env` usado localmente é gerado a partir dele e
está no `.gitignore`.

## Estrutura do repositório

```
api/                    API principal (Express) - auth + CRUD do cofre
worker-notifications/   Consumer da fila "notifications" (envia e-mail)
worker-audit/           Consumer da fila "audit-log" (grava auditoria)
gateway/                Config do Nginx (rate limit, load balancer, estáticos)
frontend/               HTML/CSS/JS simples, sem framework
db/                      Script de inicialização do PostgreSQL
docs/ARQUITETURA.md     Decisões de arquitetura e das 2 opções escolhidas
docker-compose.yml      Orquestração de todos os serviços
```

## Limitações conhecidas

Projeto acadêmico — não deve ser usado para guardar senhas reais. Faltam
recursos de um gerenciador de senhas de produção: criptografia do lado do
cliente, recuperação de conta, autenticação em duas etapas, entre outros.
