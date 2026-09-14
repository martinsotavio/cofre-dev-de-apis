# Roteiro de apresentação

Guia para a apresentação ao vivo. O enunciado exige: subir via Docker Compose
ao vivo, demonstrar o CRUD, demonstrar as 2 opções escolhidas, e responder
perguntas técnicas sobre as decisões tomadas.

## Antes de começar (checklist)

- [ ] `docker compose down -v` seguido de `docker compose up --build -d` pelo
      menos uma vez antes da apresentação, para garantir que sobe do zero.
- [ ] Confirmar que `.env` existe (copiado de `.env.example`, com
      `JWT_SECRET`/`VAULT_ENC_KEY` gerados) e que `SMTP_HOST`, `SMTP_USER` e
      `SMTP_PASS` estão preenchidos com a senha de app do Gmail (não a senha
      normal da conta) — é isso que faz o e-mail cair na caixa real.
- [ ] Ter à mão duas abas do navegador: uma em `http://localhost:8080`
      (aplicação) e outra em `http://localhost:15672` (painel do RabbitMQ,
      login com o usuário/senha do `.env`).
- [ ] Ter o Gmail aberto num celular ou outra aba, pronto para mostrar o
      e-mail chegando ao vivo.
- [ ] **Testar internet na sala antes de começar** — com SMTP real, a
      notificação por e-mail passa a depender de internet + do Gmail aceitar
      o envio na hora. Se a rede da sala for instável, ver o plano B no final
      deste documento (voltar para o Ethereal).

## Roteiro (ordem sugerida)

1. **Subir a aplicação ao vivo**
   ```
   docker compose up --build
   ```
   Enquanto sobe, explicar rapidamente os componentes (ver tabela em
   `ARQUITETURA.md`): 2 instâncias da API, gateway, banco, RabbitMQ, 2
   workers.

2. **Demonstrar o CRUD (requisito obrigatório)**
   - Abrir `http://localhost:8080`, cadastrar um usuário, fazer login.
   - Criar uma credencial (ex: "Netflix").
   - Mostrar que a lista não expõe a senha em texto puro, e que "Ver senha"
     revela sob demanda.
   - Editar e excluir a credencial.

3. **Demonstrar o Gateway (rate limit + load balancer)**
   - Load balancer: rodar no terminal
     ```
     for i in 1 2 3 4; do curl -s http://localhost:8080/api/health; echo; done
     ```
     Mostrar o campo `"instance"` alternando entre `api1` e `api2`.
   - Rate limit: tentar logar várias vezes seguidas com senha errada e
     mostrar que, a partir da 4ª tentativa no minuto, a resposta vira `503`
     antes mesmo de chegar na API — protegendo contra força bruta no login.

4. **Demonstrar o RabbitMQ (mensageria)**
   - Criar uma nova credencial na interface.
   - Mostrar no painel do RabbitMQ (`localhost:15672` → Queues) as duas
     filas `notifications` e `audit-log` recebendo e processando mensagens.
   - Mostrar o e-mail chegando de verdade na caixa de entrada (Gmail) —
     configuramos SMTP real, então não é mais um link de preview, é o e-mail
     mesmo. Se quiser reforçar tecnicamente, pode mostrar antes o log
     (`docker compose logs worker-notifications`) com a linha
     "usando SMTP real (smtp.gmail.com)".
   - Consultar a tabela de auditoria:
     ```
     docker compose exec postgres psql -U vaultuser -d vaultdb -c "SELECT * FROM audit_log ORDER BY id DESC LIMIT 5;"
     ```

## Perguntas técnicas esperadas (e respostas prontas)

**Por que essas 2 opções e não as outras?**
Rate limit e load balancer se justificam pelo próprio domínio: um cofre de
senhas é alvo natural de força bruta no login. RabbitMQ se justifica porque
há duas necessidades de propósito bem diferente (avisar o usuário por e-mail
vs. registrar auditoria interna), o que é o caso de uso clássico de filas
separadas. Loki/telemetria ficou de fora por decisão de escopo dado o prazo,
não por dificuldade técnica.

**Por que duas filas e não uma só?**
Porque os consumidores são diferentes e não deveriam depender um do outro:
se o envio de e-mail falhar ou demorar, isso não pode atrasar ou quebrar a
gravação da auditoria (e vice-versa). Cada fila também pode escalar e ser
monitorada de forma independente.

**O rate limit é por IP — e se o ataque vier de vários IPs?**
Sim, o limite é por IP (`$binary_remote_addr` no Nginx), então cada IP tem
sua própria cota — isso impede um atacante sozinho de tentar força bruta,
mas não impede um ataque distribuído (vários IPs, poucas tentativas cada).
Resolver isso exigiria outra camada (bloqueio de conta, CAPTCHA), fora do
escopo deste trabalho.

**Como a senha é protegida no banco?**
A senha mestra do usuário (login) usa hash bcrypt. A senha de cada
credencial do cofre é criptografada com AES-256-GCM antes de ser persistida;
a chave fica só em variável de ambiente do servidor. A listagem nunca
retorna a senha em texto puro — só o endpoint de "revelar".

**O que acontece se uma instância da API cair?**
O Nginx só remove uma instância do balanceamento depois de falhas
consecutivas (comportamento padrão do upstream); enquanto isso, as
requisições continuam sendo enviadas normalmente para a instância saudável.

**Por que Postgres e não um banco não-relacional?**
Os dados têm relacionamento claro (usuário → itens do cofre → auditoria) e
se beneficiam de chaves estrangeiras e integridade referencial.

**O e-mail é real?**
Sim — o worker está configurado com SMTP real do Gmail (via senha de app,
não a senha da conta) e o e-mail chega de verdade na caixa de entrada. O
código também suporta um modo de teste com o Ethereal (serviço de teste do
próprio Nodemailer, que simula o envio sem entregar de verdade) — é o que
usamos por padrão quando não há SMTP configurado, útil para não depender de
credenciais reais em outros ambientes.

## Se algo der errado ao vivo

- **`docker compose up` falha**: rodar `docker compose logs <serviço>` para
  ver o erro. Erros mais prováveis: porta ocupada (`8080`, `5432`, `5672`,
  `15672`) por outro processo — parar o processo ou trocar a porta no
  `docker-compose.yml`.
- **E-mail real não chega / sem internet / Gmail bloqueou o envio**: dá para
  voltar ao Ethereal em segundos, sem mudar código — só esvaziar as
  variáveis SMTP e reiniciar o worker:
  ```
  # no .env, apague os valores de SMTP_HOST, SMTP_USER e SMTP_PASS
  # (ou comente as linhas), depois:
  docker compose up -d --build worker-notifications
  docker compose logs -f worker-notifications
  ```
  Vai aparecer "caixa de teste Ethereal criada" e um link de preview a cada
  e-mail — mensageria continua provada, só muda a "ponta" visual. Ou, se
  preferir nem tentar consertar ao vivo, pule direto para mostrar a fila
  `notifications` recebendo e consumindo a mensagem no painel do RabbitMQ —
  isso já prova a mensageria funcionando, com ou sem e-mail.
- **Rate limit atrapalhando a própria demo**: se testar login errado demais
  vezes antes da apresentação, espere ~1 minuto para a janela resetar, ou
  reinicie o gateway (`docker compose restart gateway`) para zerar o estado.
