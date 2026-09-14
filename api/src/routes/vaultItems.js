// CRUD dos itens do cofre de senhas.
// Toda escrita (criar/editar/excluir) e toda leitura de senha em texto puro
// (revelar) publicam um evento na fila "audit-log". A criacao tambem publica
// na fila "notifications", que dispara um e-mail avisando o dono do cofre.

const express = require('express');
const { pool } = require('../db');
const { criptografar, descriptografar } = require('../services/crypto');
const { publicarNotificacao, publicarAuditoria } = require('../services/rabbitmq');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

function registrarAuditoria(req, action, entityId, details = {}) {
    publicarAuditoria({
        userId: req.userId,
        action,
        entity: 'vault_item',
        entityId,
        details,
        timestamp: new Date().toISOString(),
    });
}

// Lista os itens do usuario logado, SEM a senha em texto puro - so os metadados.
router.get('/', asyncHandler(async (req, res) => {
    const resultado = await pool.query(
        `SELECT id, service_title, service_username, url, notes, created_at, updated_at
         FROM vault_items WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.userId]
    );
    res.json(resultado.rows);
}));

// Retorna um item com a senha ja descriptografada ("revelar senha").
// Essa acao tambem vira registro de auditoria, por ser sensivel.
router.get('/:id', asyncHandler(async (req, res) => {
    const resultado = await pool.query(
        'SELECT * FROM vault_items WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
    );
    const item = resultado.rows[0];
    if (!item) {
        return res.status(404).json({ erro: 'Item nao encontrado.' });
    }

    const senha = descriptografar({
        encryptedPassword: item.encrypted_password,
        iv: item.iv,
        authTag: item.auth_tag,
    });

    registrarAuditoria(req, 'reveal', item.id, { serviceTitle: item.service_title });

    res.json({
        id: item.id,
        serviceTitle: item.service_title,
        serviceUsername: item.service_username,
        password: senha,
        url: item.url,
        notes: item.notes,
    });
}));

router.post('/', asyncHandler(async (req, res) => {
    const { serviceTitle, serviceUsername, password, url, notes } = req.body;

    if (!serviceTitle || !serviceUsername || !password) {
        return res.status(400).json({ erro: 'Informe serviceTitle, serviceUsername e password.' });
    }

    const { encryptedPassword, iv, authTag } = criptografar(password);

    const resultado = await pool.query(
        `INSERT INTO vault_items (user_id, service_title, service_username, encrypted_password, iv, auth_tag, url, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, service_title, service_username, url, notes, created_at`,
        [req.userId, serviceTitle, serviceUsername, encryptedPassword, iv, authTag, url || null, notes || null]
    );
    const item = resultado.rows[0];

    registrarAuditoria(req, 'create', item.id, { serviceTitle });

    publicarNotificacao({
        userEmail: req.userEmail,
        serviceTitle,
        timestamp: new Date().toISOString(),
    });

    res.status(201).json(item);
}));

router.put('/:id', asyncHandler(async (req, res) => {
    const { serviceTitle, serviceUsername, password, url, notes } = req.body;

    const existente = await pool.query(
        'SELECT * FROM vault_items WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
    );
    if (!existente.rows[0]) {
        return res.status(404).json({ erro: 'Item nao encontrado.' });
    }
    const item = existente.rows[0];

    // So recriptografa se uma nova senha foi enviada; senao mantem a atual.
    let dadosCripto = { encryptedPassword: item.encrypted_password, iv: item.iv, authTag: item.auth_tag };
    if (password) {
        const criptografado = criptografar(password);
        dadosCripto = {
            encryptedPassword: criptografado.encryptedPassword,
            iv: criptografado.iv,
            authTag: criptografado.authTag,
        };
    }

    const resultado = await pool.query(
        `UPDATE vault_items
         SET service_title = $1, service_username = $2, encrypted_password = $3,
             iv = $4, auth_tag = $5, url = $6, notes = $7, updated_at = now()
         WHERE id = $8 AND user_id = $9
         RETURNING id, service_title, service_username, url, notes, updated_at`,
        [
            serviceTitle || item.service_title,
            serviceUsername || item.service_username,
            dadosCripto.encryptedPassword,
            dadosCripto.iv,
            dadosCripto.authTag,
            url !== undefined ? url : item.url,
            notes !== undefined ? notes : item.notes,
            req.params.id,
            req.userId,
        ]
    );

    registrarAuditoria(req, 'update', item.id, { serviceTitle: resultado.rows[0].service_title });

    res.json(resultado.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    const resultado = await pool.query(
        'DELETE FROM vault_items WHERE id = $1 AND user_id = $2 RETURNING id, service_title',
        [req.params.id, req.userId]
    );
    const item = resultado.rows[0];
    if (!item) {
        return res.status(404).json({ erro: 'Item nao encontrado.' });
    }

    registrarAuditoria(req, 'delete', item.id, { serviceTitle: item.service_title });

    res.status(204).send();
}));

module.exports = router;
