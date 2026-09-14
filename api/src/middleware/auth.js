// Middleware de autenticacao: exige um JWT valido no header Authorization.
// Usado em todas as rotas do cofre - so o dono do token acessa os proprios itens.

const jwt = require('jsonwebtoken');

function exigirAutenticacao(req, res, next) {
    const header = req.headers.authorization || '';
    const [tipo, token] = header.split(' ');

    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ erro: 'Token de autenticacao ausente.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        req.userEmail = payload.email;
        next();
    } catch (erro) {
        return res.status(401).json({ erro: 'Token invalido ou expirado.' });
    }
}

module.exports = { exigirAutenticacao };
