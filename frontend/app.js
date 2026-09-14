// Frontend basico, sem framework: so fetch() puro contra o gateway (Nginx),
// que roteia tudo que comeca com /api/ para a API (com rate limit e load
// balancing por baixo dos panos).

const API_BASE = '/api';

let token = localStorage.getItem('token');
let emailLogado = localStorage.getItem('email');
let modoCadastro = false;

const telaAuth = document.getElementById('telaAuth');
const telaVault = document.getElementById('telaVault');
const formAuth = document.getElementById('formAuth');
const authErro = document.getElementById('authErro');
const tituloAuth = document.getElementById('tituloAuth');
const alternarAuth = document.getElementById('alternarAuth');
const usuarioLogado = document.getElementById('usuarioLogado');
const botaoSair = document.getElementById('botaoSair');
const formNovoItem = document.getElementById('formNovoItem');
const listaItens = document.getElementById('listaItens');
const instanciaInfo = document.getElementById('instanciaInfo');

function mostrarTelaCorreta() {
    if (token) {
        telaAuth.classList.add('oculto');
        telaVault.classList.remove('oculto');
        usuarioLogado.textContent = emailLogado;
        carregarItens();
    } else {
        telaAuth.classList.remove('oculto');
        telaVault.classList.add('oculto');
    }
}

alternarAuth.addEventListener('click', () => {
    modoCadastro = !modoCadastro;
    tituloAuth.textContent = modoCadastro ? 'Cadastrar' : 'Entrar';
    alternarAuth.textContent = modoCadastro
        ? 'Ja tenho conta - entrar'
        : 'Ainda nao tenho conta - cadastrar';
});

formAuth.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    authErro.textContent = '';

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authSenha').value;

    try {
        if (modoCadastro) {
            const respostaRegistro = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!respostaRegistro.ok) {
                const dados = await respostaRegistro.json();
                throw new Error(dados.erro || 'Erro ao cadastrar.');
            }
        }

        const respostaLogin = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const dados = await respostaLogin.json();
        if (!respostaLogin.ok) {
            throw new Error(dados.erro || 'Erro ao entrar.');
        }

        token = dados.token;
        emailLogado = email;
        localStorage.setItem('token', token);
        localStorage.setItem('email', email);
        instanciaInfo.textContent = `Ultima resposta atendida por: ${dados.instance}`;

        mostrarTelaCorreta();
    } catch (erro) {
        authErro.textContent = erro.message;
    }
});

botaoSair.addEventListener('click', () => {
    token = null;
    emailLogado = null;
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    mostrarTelaCorreta();
});

async function chamarApi(caminho, opcoes = {}) {
    const resposta = await fetch(`${API_BASE}${caminho}`, {
        ...opcoes,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(opcoes.headers || {}),
        },
    });

    if (resposta.status === 401) {
        // Token expirado ou invalido: volta para a tela de login.
        botaoSair.click();
        throw new Error('Sessao expirada, faca login novamente.');
    }

    return resposta;
}

async function carregarItens() {
    const resposta = await chamarApi('/vault-items');
    const itens = await resposta.json();

    listaItens.innerHTML = '';
    itens.forEach((item) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${item.service_title}</strong> - ${item.service_username}
            ${item.url ? `<br><small>${item.url}</small>` : ''}
            <div class="senha-area"></div>
            <div class="acoes">
                <button data-acao="revelar">Ver senha</button>
                <button data-acao="editar">Editar</button>
                <button data-acao="excluir">Excluir</button>
            </div>
        `;

        li.querySelector('[data-acao="revelar"]').addEventListener('click', () => revelarSenha(item.id, li));
        li.querySelector('[data-acao="editar"]').addEventListener('click', () => editarItem(item));
        li.querySelector('[data-acao="excluir"]').addEventListener('click', () => excluirItem(item.id));

        listaItens.appendChild(li);
    });
}

async function revelarSenha(id, li) {
    const resposta = await chamarApi(`/vault-items/${id}`);
    const item = await resposta.json();

    const area = li.querySelector('.senha-area');
    area.innerHTML = `<span class="senha-revelada">${item.password}</span>`;
}

async function editarItem(item) {
    const novoUsuario = window.prompt('Usuario/login:', item.service_username);
    if (novoUsuario === null) return;

    const novaSenha = window.prompt('Nova senha (deixe em branco para manter a atual):', '');

    await chamarApi(`/vault-items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
            serviceTitle: item.service_title,
            serviceUsername: novoUsuario,
            password: novaSenha || undefined,
            url: item.url,
            notes: item.notes,
        }),
    });

    carregarItens();
}

async function excluirItem(id) {
    if (!window.confirm('Excluir esta credencial do cofre?')) return;
    await chamarApi(`/vault-items/${id}`, { method: 'DELETE' });
    carregarItens();
}

formNovoItem.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const serviceTitle = document.getElementById('novoServico').value;
    const serviceUsername = document.getElementById('novoUsuario').value;
    const password = document.getElementById('novaSenha').value;
    const url = document.getElementById('novaUrl').value;

    await chamarApi('/vault-items', {
        method: 'POST',
        body: JSON.stringify({ serviceTitle, serviceUsername, password, url }),
    });

    formNovoItem.reset();
    carregarItens();
});

mostrarTelaCorreta();
