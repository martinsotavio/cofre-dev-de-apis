// Produtor de mensagens do RabbitMQ.
// A API so PUBLICA nas filas - quem processa (envia e-mail, grava auditoria)
// sao os workers (worker-notifications e worker-audit), cada um consumindo a
// sua propria fila de forma independente.

const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

const FILA_NOTIFICACOES = 'notifications';
const FILA_AUDITORIA = 'audit-log';

let canal = null;

async function conectar(maxTentativas = 15, intervaloMs = 2000) {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            const conexao = await amqp.connect(RABBITMQ_URL);
            canal = await conexao.createChannel();

            // "durable: true" garante que a fila sobrevive a um restart do RabbitMQ
            // e as mensagens nao se perdem antes de serem consumidas.
            await canal.assertQueue(FILA_NOTIFICACOES, { durable: true });
            await canal.assertQueue(FILA_AUDITORIA, { durable: true });

            console.log('Conectado ao RabbitMQ.');
            return;
        } catch (erro) {
            console.log(`RabbitMQ ainda nao disponivel (tentativa ${tentativa}/${maxTentativas}). Aguardando...`);
            await new Promise((resolve) => setTimeout(resolve, intervaloMs));
        }
    }
    throw new Error('Nao foi possivel conectar ao RabbitMQ apos varias tentativas.');
}

function publicar(fila, mensagem) {
    if (!canal) {
        console.warn(`Canal do RabbitMQ indisponivel, mensagem para "${fila}" descartada.`);
        return;
    }
    canal.sendToQueue(fila, Buffer.from(JSON.stringify(mensagem)), { persistent: true });
}

function publicarNotificacao(mensagem) {
    publicar(FILA_NOTIFICACOES, mensagem);
}

function publicarAuditoria(mensagem) {
    publicar(FILA_AUDITORIA, mensagem);
}

module.exports = { conectar, publicarNotificacao, publicarAuditoria };
