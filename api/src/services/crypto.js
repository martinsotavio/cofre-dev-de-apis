// Criptografia das senhas guardadas no cofre.
// Usamos AES-256-GCM: alem de criptografar, o modo GCM gera um "auth tag" que
// permite detectar se o dado foi alterado antes de descriptografar de volta.
// A chave (VAULT_ENC_KEY) fica so no servidor, via variavel de ambiente -
// nunca no banco e nunca no codigo-fonte.

const crypto = require('crypto');

const ALGORITMO = 'aes-256-gcm';
const CHAVE = Buffer.from(process.env.VAULT_ENC_KEY, 'hex');

function criptografar(textoPuro) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITMO, CHAVE, iv);

    const criptografado = Buffer.concat([cipher.update(textoPuro, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        encryptedPassword: criptografado.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
    };
}

function descriptografar({ encryptedPassword, iv, authTag }) {
    const decipher = crypto.createDecipheriv(ALGORITMO, CHAVE, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    const textoPuro = Buffer.concat([
        decipher.update(Buffer.from(encryptedPassword, 'hex')),
        decipher.final(),
    ]);

    return textoPuro.toString('utf8');
}

module.exports = { criptografar, descriptografar };
