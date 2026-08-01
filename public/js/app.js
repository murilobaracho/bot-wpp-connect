let digitando = false;

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

    const res = await fetch('/api/mensagem/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, texto })
    });
    const data = await res.json();
    alert(data.mensagem);
}

async function iniciarCampanha() {
    if (!confirm('Deseja realmente iniciar os disparos para a lista do CSV?')) return;

    const res = await fetch('/api/campanha/iniciar', { method: 'POST' });
    const data = await res.json();
    alert(data.mensagem);
}

carregarDados();
setInterval(carregarDados, 3000);
