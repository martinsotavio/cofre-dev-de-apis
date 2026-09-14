# Decisões de arquitetura

## Tema

Cofre de senhas: uma API para guardar credenciais (serviço, usuário, senha,
url, notas) de forma segura, com cadastro/login de usuário.

Este é um projeto acadêmico, não um produto real de gerenciamento de senhas.
Não deve ser usado para guardar senhas reais. Faltam recursos essenciais de
um produto de verdade, como criptografia do lado do cliente (o servidor nunca
deveria ter acesso à senha em texto puro), recuperação de conta, MFA, etc.

## Componentes

| Componente | Função |
|---|---|
| `gateway` (Nginx) | Serve o frontend estático e faz proxy reverso para a API, com rate limiting e load balancing. |
| `api1` / `api2` | Duas instâncias da mesma API (Node/Express), atendendo autenticação e CRUD do cofre. |
| `postgres` | Persistência dos usuários, itens do cofre e trilha de auditoria. |
| `rabbitmq` | Mensageria entre a API e os workers. |
| `worker-notifications` | Consome a fila `notifications` e envia e-mail (via Ethereal) quando uma senha é cadastrada. |
| `worker-audit` | Consome a fila `audit-log` e grava a trilha de auditoria no Postgres. |

## Por que essas duas opções (Gateway e RabbitMQ)

**Gateway com rate limit e load balancer**: um cofre de senhas é um alvo
natural para ataques de força bruta no login. O gateway aplica um rate limit
bem mais restrito na rota `/api/auth/login` (3 requisições por minuto por IP)
do que nas demais rotas (10 req/s), e distribui as requisições entre `api1` e
`api2` por round-robin — a resposta de `/auth/login` inclui o campo
`instance`, que alterna entre as duas instâncias, e cada resposta de
`/health` também expõe isso, para comprovar o balanceamento na prática.

**RabbitMQ com duas filas de propósitos diferentes**: a fila `notifications`
é voltada para o usuário final (recebe um e-mail avisando que uma senha foi
cadastrada); a fila `audit-log` é interna (grava quem fez o quê e quando —
criar, revelar, editar ou excluir uma credencial). São propósitos e
consumidores completamente diferentes, o que justifica duas filas separadas
em vez de uma única fila genérica.

Optamos por não implementar a opção de telemetria/Loki porque, dado o prazo
disponível, o stack Grafana + Loki + Promtail tem mais peças móveis e mais
risco de falhar durante a apresentação ao vivo, sem agregar tanto à
demonstração quanto as outras duas opções.

## Segurança das senhas no cofre

- A senha mestra do usuário (login) é armazenada com hash `bcrypt`, nunca em
  texto puro.
- A senha de cada credencial do cofre é criptografada com `AES-256-GCM`
  antes de ir para o banco. A chave de criptografia (`VAULT_ENC_KEY`) fica só
  em variável de ambiente do servidor, nunca no banco de dados.
- A listagem de credenciais (`GET /vault-items`) nunca devolve a senha em
  texto puro — só o endpoint de detalhe (`GET /vault-items/:id`, o "revelar
  senha") descriptografa, e essa ação também gera um registro de auditoria.

## Fluxo de uma criação de credencial

1. Frontend envia `POST /api/vault-items` para o gateway.
2. Gateway aplica rate limit geral e encaminha para `api1` ou `api2`
   (round-robin).
3. A API criptografa a senha, grava em `vault_items` e publica duas
   mensagens no RabbitMQ: uma na fila `notifications`, outra na fila
   `audit-log`.
4. `worker-notifications` consome a mensagem e envia um e-mail (Ethereal)
   avisando o usuário.
5. `worker-audit` consome a mensagem e grava uma linha em `audit_log`.

Os passos 4 e 5 acontecem de forma assíncrona, sem bloquear a resposta da
API ao frontend.
