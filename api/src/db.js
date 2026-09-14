// Conexao com o Postgres, com nova tentativa automatica no startup.
// Necessario porque o container da API pode subir antes do banco estar pronto
// para aceitar conexoes.

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST || 'postgres',
    port: process.env.PGPORT || 5432,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
});

async function waitForDatabase(maxTentativas = 15, intervaloMs = 2000) {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            await pool.query('SELECT 1');
            console.log('Conectado ao Postgres.');
            return;
        } catch (erro) {
            console.log(`Postgres ainda nao disponivel (tentativa ${tentativa}/${maxTentativas}). Aguardando...`);
            await new Promise((resolve) => setTimeout(resolve, intervaloMs));
        }
    }
    throw new Error('Nao foi possivel conectar ao Postgres apos varias tentativas.');
}

module.exports = { pool, waitForDatabase };
