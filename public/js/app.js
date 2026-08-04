let digitando = false;
let conectando = false;
let avisoPausaMostrado = false;

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
        if (data.respostaAutomaticaPausada) {
            texto += ' ⚠️ Resposta automática pausada por segurança!';
            if (!avisoPausaMostrado) {
                avisoPausaMostrado = true;
                toast('Resposta automática pausada: volume anormal de envios detectado. Reinicie o bot depois de investigar.', 'error');
            }
        }
        statusElem.innerText = texto;

        statusDot.classList.toggle('online', !!data.botConectado);

        if (data.botConectado) {
            conectando = false;
        }

        if (data.campanhaRodando) {
            mostrarProgressoCampanha();
        }

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
    conectando = true;
    try {
        const res = await fetch('/api/bot/iniciar', { method: 'POST' });
        const data = await res.json();
        toast(data.mensagem, res.ok ? 'success' : 'error');
    } catch (e) {
        toast('Erro de conexão ao iniciar o bot.', 'error');
    }
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

    conectando = false;

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

    try {
        const res = await fetch('/api/campanha/iniciar', { method: 'POST' });
        const data = await res.json();
        toast(data.mensagem, res.ok ? 'success' : 'error');

        if (res.ok) {
            mostrarProgressoCampanha();
        }
    } catch (e) {
        toast('Erro de conexão ao iniciar a campanha.', 'error');
    }
}

let progressoInterval = null;

function mostrarProgressoCampanha() {
    const card = document.getElementById('campanhaProgressoCard');

    if (!card.hidden && progressoInterval) return;

    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    atualizarProgressoCampanha();
    if (progressoInterval) clearInterval(progressoInterval);
    progressoInterval = setInterval(atualizarProgressoCampanha, 2000);
}

async function atualizarProgressoCampanha() {
    try {
        const res = await fetch('/api/campanha/progresso');
        const data = await res.json();

        const total = data.total || 0;
        const enviados = data.enviados || 0;
        const erros = data.erros || 0;
        const feitos = enviados + erros;
        const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;

        document.getElementById('campanhaProgressoFill').style.width = pct + '%';
        document.getElementById('campanhaEnviados').textContent = enviados;
        document.getElementById('campanhaErros').textContent = erros;
        document.getElementById('campanhaTotal').textContent = total;

        const desc = document.getElementById('campanhaProgressoDesc');
        if (!data.rodando && total > 0) {
            desc.textContent = 'Campanha concluída!';
            clearInterval(progressoInterval);
            progressoInterval = null;
        } else if (data.atual) {
            desc.textContent = `Enviando para ${data.atual}...`;
        } else {
            desc.textContent = 'Preparando disparos...';
        }
    } catch (e) {
        console.error(e);
    }
}

function agendarProximaConsulta() {
    setTimeout(async () => {
        await carregarDados();
        agendarProximaConsulta();
    }, conectando ? 1000 : 3000);
}

carregarDados();
agendarProximaConsulta();
