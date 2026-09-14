// Consumidor da fila "audit-log".
// Toda operacao sensivel no cofre (criar, revelar, editar, excluir) chega
// aqui como mensagem e vira uma linha na tabela audit_log do Postgres -
// um rastro interno de quem fez o que, independente da API que atendeu o
// pedido (api1 ou api2).

const amqp = require('amqplib');
const { Pool } = require('pg');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const FILA_AUDITORIA = 'audit-log';

const pool = new Pool({
    host: process.env.PGHOST || 'postgres',
    port: process.env.PGPORT || 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
});

async function conectarRabbitMQ(maxTentativas = 15, intervaloMs = 2000) {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            const conexao = await amqp.connect(RABBITMQ_URL);
            const canal = await conexao.createChannel();
            await canal.assertQueue(FILA_AUDITORIA, { durable: true });
            console.log('worker-audit: conectado ao RabbitMQ.');
            return canal;
        } catch (erro) {
            console.log(`worker-audit: RabbitMQ indisponivel (tentativa ${tentativa}/${maxTentativas}).`);
            await new Promise((resolve) => setTimeout(resolve, intervaloMs));
        }
    }
    throw new Error('worker-audit: nao foi possivel conectar ao RabbitMQ.');
}

async function aguardarBanco(maxTentativas = 15, intervaloMs = 2000) {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            await pool.query('SELECT 1');
            console.log('worker-audit: conectado ao Postgres.');
            return;
        } catch (erro) {
            console.log(`worker-audit: Postgres indisponivel (tentativa ${tentativa}/${maxTentativas}).`);
            await new Promise((resolve) => setTimeout(resolve, intervaloMs));
        }
    }
    throw new Error('worker-audit: nao foi possivel conectar ao Postgres.');
}

async function gravarAuditoria(mensagem) {
    const { userId, action, entity, entityId, details } = mensagem;
    await pool.query(
        'INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
        [userId, action, entity, entityId, details ? JSON.stringify(details) : null]
    );
    console.log(`worker-audit: registrado "${action}" em "${entity}" (id ${entityId}).`);
}

async function iniciar() {
    await aguardarBanco();
    const canal = await conectarRabbitMQ();
    canal.prefetch(1);

    canal.consume(FILA_AUDITORIA, async (msg) => {
        if (!msg) return;
        try {
            const mensagem = JSON.parse(msg.content.toString());
            await gravarAuditoria(mensagem);
            canal.ack(msg);
        } catch (erro) {
            console.error('worker-audit: erro ao processar mensagem:', erro);
            canal.nack(msg, false, false);
        }
    });

    console.log('worker-audit: aguardando mensagens...');
}

iniciar().catch((erro) => {
    console.error('worker-audit: falha ao iniciar:', erro);
    process.exit(1);
});
