// Ponto de entrada da API.
// Duas instancias desse mesmo servico rodam ao mesmo tempo (api1 e api2, ver
// docker-compose.yml) e ficam atras do gateway Nginx, que faz o balanceamento
// de carga entre elas.

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { waitForDatabase } = require('./db');
const rabbitmq = require('./services/rabbitmq');
const authRoutes = require('./routes/auth');
const vaultItemsRoutes = require('./routes/vaultItems');
const { exigirAutenticacao } = require('./middleware/auth');

const app = express();
const PORTA = process.env.PORT || 3000;
const INSTANCE_ID = process.env.INSTANCE_ID || 'desconhecida';

app.use(cors());
app.use(express.json());

// Usado na demo para provar, na pratica, que o Nginx alterna entre as
// instancias (o campo "instance" muda a cada requisicao).
app.get('/health', (req, res) => {
    res.json({ status: 'ok', instance: INSTANCE_ID });
});

app.use('/auth', authRoutes);
app.use('/vault-items', exigirAutenticacao, vaultItemsRoutes);

// Rede de seguranca: qualquer erro nao tratado numa rota cai aqui, em vez de
// deixar a requisicao travada sem resposta.
app.use((err, req, res, next) => {
    console.error('Erro nao tratado:', err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
});

async function iniciar() {
    await waitForDatabase();
    await rabbitmq.conectar();

    app.listen(PORTA, () => {
        console.log(`API (${INSTANCE_ID}) rodando na porta ${PORTA}.`);
    });
}

iniciar().catch((erro) => {
    console.error('Falha ao iniciar a API:', erro);
    process.exit(1);
});
