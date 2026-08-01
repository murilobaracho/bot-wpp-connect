let digitando = false;

function toast(mensagem, tipo = 'success') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${tipo === 'error' ? 'error' : ''}`.trim();
    el.textContent = mensagem;
    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('fade-out');
        el.addEventListener('animationend', () => el.remove());
    }, 3500);
}

document.getElementById('msgBot').addEventListener('focus', () => digitando = true);
document.getElementById('msgBot').addEventListener('blur', () => digitando = false);
document.getElementById('msgCampanha').addEventListener('focus', () => digitando = true);
document.getElementById('msgCampanha').addEventListener('blur', () => digitando = false);

async function carregarDados() {
    try {
        const res = await fetch('/api/dados');
        const data = await res.json();

        if (!digitando) {
            document.getElementById('msgBot').value = data.msgBot;
            document.getElementById('msgCampanha').value = data.msgCampanha;
        }

        const statusElem = document.getElementById('botStatus');
        const statusDot = document.getElementById('statusDot');

        let texto = data.statusTexto;
        if (data.campanhaRodando) {
            texto += ' (🚀 Campanha em andamento...)';
        }
        statusElem.innerText = texto;

        statusDot.classList.toggle('online', !!data.botConectado);

        const qrBox = document.getElementById('qrBox');
        const qrImage = document.getElementById('qrImage');
        if (data.qrCode) {
            qrImage.src = data.qrCode;
            qrBox.hidden = false;
        } else {
            qrBox.hidden = true;
            qrImage.src = '';
        }
    } catch (e) {
        console.error(e);
    }
}

async function ligarBot() {
    const res = await fetch('/api/bot/iniciar', { method: 'POST' });
    const data = await res.json();
    alert(data.mensagem);
    carregarDados();
}

async function salvarMensagem(tipo) {
    const texto = tipo === 'bot'
        ? document.getElementById('msgBot').value
        : document.getElementById('msgCampanha').value;

    try {
        const res = await fetch('/api/mensagem/salvar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, texto })
        });
        const data = await res.json();

        if (res.ok) {
            toast(data.mensagem || 'Mensagem salva com sucesso!', 'success');
        } else {
            toast(data.mensagem || 'Não foi possível salvar a mensagem.', 'error');
        }
    } catch (e) {
        toast('Erro de conexão ao salvar a mensagem.', 'error');
    }
}

async function encerrarBot() {
    if (!confirm('Deseja realmente encerrar o bot?')) return;

    try {
        const res = await fetch('/api/bot/encerrar', { method: 'POST' });
        const data = await res.json();
        toast(data.mensagem, res.ok ? 'success' : 'error');
    } catch (e) {
        toast('Erro de conexão ao encerrar o bot.', 'error');
    }
    carregarDados();
}

document.getElementById('inputCsv').addEventListener('change', async (event) => {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    document.getElementById('csvFileName').textContent = arquivo.name;

    try {
        const conteudo = await arquivo.text();
        const res = await fetch('/api/clientes/importar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conteudo })
        });
        const data = await res.json();
        toast(data.mensagem, res.ok ? 'success' : 'error');
    } catch (e) {
        toast('Erro ao importar o arquivo CSV.', 'error');
    } finally {
        event.target.value = '';
    }
});

async function iniciarCampanha() {
    if (!confirm('Deseja realmente iniciar os disparos para a lista do CSV?')) return;

    const res = await fetch('/api/campanha/iniciar', { method: 'POST' });
    const data = await res.json();
    alert(data.mensagem);
}

carregarDados();
setInterval(carregarDados, 3000);
