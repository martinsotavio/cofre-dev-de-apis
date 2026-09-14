// Consumidor da fila "notifications".
// Para cada senha cadastrada no cofre, envia um e-mail avisando o dono.
//
// Por padrao usamos o Ethereal (https://ethereal.email), um servico de teste
// do proprio Nodemailer: ele cria uma caixa de entrada falsa na hora e devolve
// um link de preview para cada e-mail "enviado" - nao entrega em caixas reais,
// o que e' o comportamento certo para a apresentacao (nao depende de SMTP real
// nem manda mensagem de verdade). Se as variaveis SMTP_HOST/SMTP_USER/SMTP_PASS
// estiverem definidas, usa esse SMTP real no lugar do Ethereal.

const amqp = require('amqplib');
const nodemailer = require('nodemailer');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const FILA_NOTIFICACOES = 'notifications';

async function conectarRabbitMQ(maxTentativas = 15, intervaloMs = 2000) {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            const conexao = await amqp.connect(RABBITMQ_URL);
            const canal = await conexao.createChannel();
            await canal.assertQueue(FILA_NOTIFICACOES, { durable: true });
            console.log('worker-notifications: conectado ao RabbitMQ.');
            return canal;
        } catch (erro) {
            console.log(`worker-notifications: RabbitMQ indisponivel (tentativa ${tentativa}/${maxTentativas}).`);
            await new Promise((resolve) => setTimeout(resolve, intervaloMs));
        }
    }
    throw new Error('worker-notifications: nao foi possivel conectar ao RabbitMQ.');
}

async function criarTransportadorEmail() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log(`worker-notifications: usando SMTP real (${process.env.SMTP_HOST}).`);
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }

    const contaTeste = await nodemailer.createTestAccount();
    console.log('worker-notifications: caixa de teste Ethereal criada.');
    console.log(`  usuario: ${contaTeste.user}`);

    return nodemailer.createTransport({
        host: contaTeste.smtp.host,
        port: contaTeste.smtp.port,
        secure: contaTeste.smtp.secure,
        auth: { user: contaTeste.user, pass: contaTeste.pass },
    });
}

async function processarMensagem(transportador, mensagem) {
    const { userEmail, serviceTitle, timestamp } = mensagem;

    const info = await transportador.sendMail({
        from: '"Cofre de Senhas" <no-reply@cofre-senhas.local>',
        to: userEmail,
        subject: `Nova senha cadastrada: ${serviceTitle}`,
        text: `A senha para "${serviceTitle}" foi cadastrada no seu cofre em ${timestamp}.`,
    });

    console.log(`worker-notifications: e-mail enviado para ${userEmail} sobre "${serviceTitle}".`);

    // getTestMessageUrl so retorna algo quando o transportador e' o Ethereal;
    // com SMTP real (Gmail etc) ele retorna false, entao so logamos se existir.
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
        console.log(`  preview: ${previewUrl}`);
    }
}

async function iniciar() {
    const [canal, transportador] = await Promise.all([conectarRabbitMQ(), criarTransportadorEmail()]);

    // prefetch(1): so processa uma mensagem por vez, confirmando (ack) antes
    // de pegar a proxima - evita perder e-mail se o worker cair no meio.
    canal.prefetch(1);

    canal.consume(FILA_NOTIFICACOES, async (msg) => {
        if (!msg) return;
        try {
            const mensagem = JSON.parse(msg.content.toString());
            await processarMensagem(transportador, mensagem);
            canal.ack(msg);
        } catch (erro) {
            console.error('worker-notifications: erro ao processar mensagem:', erro);
            canal.nack(msg, false, false);
        }
    });

    console.log('worker-notifications: aguardando mensagens...');
}

iniciar().catch((erro) => {
    console.error('worker-notifications: falha ao iniciar:', erro);
    process.exit(1);
});
