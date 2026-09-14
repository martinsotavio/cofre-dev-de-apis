// Envolve uma rota assincrona e encaminha qualquer erro para o middleware
// de erro do Express (senao, uma promise rejeitada dentro de uma rota async
// trava a requisicao sem resposta, em vez de retornar 500).

function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { asyncHandler };
