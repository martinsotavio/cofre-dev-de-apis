// Rotas de autenticacao: registro e login.
// O rate limit rigoroso contra forca bruta e' aplicado no gateway (Nginx),
// nao aqui - a API so cuida da logica de negocio.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ erro: 'Informe email e senha.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ erro: 'A senha precisa ter ao menos 6 caracteres.' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const resultado = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
            [email, hash]
        );
        return res.status(201).json(resultado.rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {
            return res.status(409).json({ erro: 'Ja existe um usuario com esse email.' });
        }
        console.error(erro);
        return res.status(500).json({ erro: 'Erro ao registrar usuario.' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ erro: 'Informe email e senha.' });
    }

    try {
        const resultado = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const usuario = resultado.rows[0];

        // Mensagem generica de proposito: nao revelar se o email existe ou nao.
        if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
            return res.status(401).json({ erro: 'Email ou senha invalidos.' });
        }

        const token = jwt.sign(
            { userId: usuario.id, email: usuario.email },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        return res.json({ token, instance: process.env.INSTANCE_ID || 'desconhecida' });
    } catch (erro) {
        console.error(erro);
        return res.status(500).json({ erro: 'Erro ao autenticar.' });
    }
});

module.exports = router;
