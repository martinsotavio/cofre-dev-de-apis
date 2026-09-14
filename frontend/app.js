// Frontend basico, sem framework: so fetch() puro contra o gateway (Nginx),
// que roteia tudo que comeca com /api/ para a API (com rate limit e load
// balancing por baixo dos panos). O unico "extra" aqui e' visual: toasts de
// feedback e um leve efeito de inclinacao (tilt) nos cards ao passar o mouse.

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
const listaVazia = document.getElementById('listaVazia');
const instanciaInfo = document.getElementById('instanciaInfo');
const toastContainer = document.getElementById('toastContainer');

// ---------- Feedback visual (toasts) ----------

function notificar(mensagem, tipo = 'ok') {
    const toast = document.createElement('div');
    toast.className = tipo === 'erro' ? 'toast erro-toast' : 'toast';
    toast.textContent = mensagem;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('saindo');
        setTimeout(() => toast.remove(), 200);
    }, 3200);
}

function definirCarregando(botao, carregando, textoNormal) {
    botao.disabled = carregando;
    const rotulo = botao.querySelector('.rotulo') || botao;
    rotulo.textContent = carregando ? '...' : textoNormal;
}

// ---------- Icones (SVG inline, sem dependencia externa) ----------

const ICONE_OLHO = '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>';
const ICONE_LAPIS = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l.9-4L16.4 4.5a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1L8 19l-4 1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const ICONE_LIXEIRA = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7h8Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------- Alternar telas ----------

function mostrarTelaCorreta() {
    if (token) {
        telaAuth.classList.add('oculto');
        telaVault.classList.remove('oculto');
        usuarioLogado.textContent = emailLogado;
        carregarItens();
    } else {
        telaAuth.classList.remove('oculto');
        telaVault.classList.add('oculto');
        instanciaInfo.classList.add('oculto');
    }
}

alternarAuth.addEventListener('click', () => {
    modoCadastro = !modoCadastro;
    tituloAuth.textContent = modoCadastro ? 'Cadastrar' : 'Entrar';
    alternarAuth.textContent = modoCadastro
        ? 'Já tenho conta — entrar'
        : 'Ainda não tenho conta — cadastrar';
});

formAuth.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    authErro.textContent = '';

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authSenha').value;
    const botao = formAuth.querySelector('button[type="submit"]');
    definirCarregando(botao, true);

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
        instanciaInfo.textContent = `atendido por ${dados.instance}`;
        instanciaInfo.classList.remove('oculto');

        notificar(modoCadastro ? 'Conta criada. Bem-vindo(a)!' : 'Login realizado.');
        mostrarTelaCorreta();
    } catch (erro) {
        authErro.textContent = erro.message;
    } finally {
        definirCarregando(botao, false, 'Entrar');
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
        throw new Error('Sessão expirada, faça login novamente.');
    }

    return resposta;
}

// ---------- Efeito de inclinacao (tilt) nos cards ----------

function ativarTilt(elemento) {
    const intensidade = 6; // graus maximos de rotacao

    elemento.addEventListener('mousemove', (evento) => {
        const retangulo = elemento.getBoundingClientRect();
        const x = (evento.clientX - retangulo.left) / retangulo.width - 0.5;
        const y = (evento.clientY - retangulo.top) / retangulo.height - 0.5;

        elemento.style.transform = `translateY(-3px) rotateX(${(-y * intensidade).toFixed(2)}deg) rotateY(${(x * intensidade).toFixed(2)}deg)`;
    });

    elemento.addEventListener('mouseleave', () => {
        elemento.style.transform = '';
    });
}

// ---------- CRUD do cofre ----------

async function carregarItens() {
    const resposta = await chamarApi('/vault-items');
    const itens = await resposta.json();

    listaItens.innerHTML = '';
    listaVazia.classList.toggle('oculto', itens.length > 0);

    itens.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'item-credencial';
        li.innerHTML = `
            <div class="item-cabecalho">
                <div class="item-info">
                    <p class="item-servico">${escaparHtml(item.service_title)}</p>
                    <p class="item-usuario">${escaparHtml(item.service_username)}</p>
                    ${item.url ? `<a class="item-url" href="${escaparHtml(item.url)}" target="_blank" rel="noopener">${escaparHtml(item.url)}</a>` : ''}
                </div>
                <div class="item-acoes">
                    <button class="botao botao-icone" data-acao="revelar" title="Ver senha">${ICONE_OLHO}</button>
                    <button class="botao botao-icone" data-acao="editar" title="Editar">${ICONE_LAPIS}</button>
                    <button class="botao botao-icone perigo" data-acao="excluir" title="Excluir">${ICONE_LIXEIRA}</button>
                </div>
            </div>
            <div class="senha-area"></div>
        `;

        li.querySelector('[data-acao="revelar"]').addEventListener('click', () => revelarSenha(item.id, li));
        li.querySelector('[data-acao="editar"]').addEventListener('click', () => editarItem(item));
        li.querySelector('[data-acao="excluir"]').addEventListener('click', () => excluirItem(item.id));

        ativarTilt(li);
        listaItens.appendChild(li);
    });
}

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

async function revelarSenha(id, li) {
    const resposta = await chamarApi(`/vault-items/${id}`);
    const item = await resposta.json();

    const area = li.querySelector('.senha-area');
    area.innerHTML = `<span class="senha-revelada">${escaparHtml(item.password)}</span>`;
}

async function editarItem(item) {
    const novoUsuario = window.prompt('Usuário/login:', item.service_username);
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

    notificar('Credencial atualizada.');
    carregarItens();
}

async function excluirItem(id) {
    if (!window.confirm('Excluir esta credencial do cofre?')) return;
    await chamarApi(`/vault-items/${id}`, { method: 'DELETE' });
    notificar('Credencial excluída.');
    carregarItens();
}

formNovoItem.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const serviceTitle = document.getElementById('novoServico').value;
    const serviceUsername = document.getElementById('novoUsuario').value;
    const password = document.getElementById('novaSenha').value;
    const url = document.getElementById('novaUrl').value;
    const botao = formNovoItem.querySelector('button[type="submit"]');
    definirCarregando(botao, true);

    try {
        await chamarApi('/vault-items', {
            method: 'POST',
            body: JSON.stringify({ serviceTitle, serviceUsername, password, url }),
        });

        formNovoItem.reset();
        notificar(`"${serviceTitle}" salvo no cofre. E-mail de notificação enviado.`);
        carregarItens();
    } catch (erro) {
        notificar(erro.message || 'Erro ao salvar credencial.', 'erro');
    } finally {
        definirCarregando(botao, false, 'Salvar no cofre');
    }
});

mostrarTelaCorreta();
