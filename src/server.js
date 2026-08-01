const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { dispararCampanha } = require('./campanha');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TOKENS_DIR = path.join(ROOT_DIR, 'tokens');
const MENSAGEM_PATH = path.join(DATA_DIR, 'mensagem.txt');
const MENSAGEM_CAMPANHA_PATH = path.join(DATA_DIR, 'mensagemCampanha.txt');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

const COOLDOWN = 10 * 60 * 1000;
const respondidos = {};

let clientInstance = null;
let statusTexto = 'Desconectado';
let campanhaEmAndamento = false;

// Garante que os arquivos existam
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MENSAGEM_PATH)) fs.writeFileSync(MENSAGEM_PATH, 'Olá! Como posso te ajudar?');
if (!fs.existsSync(MENSAGEM_CAMPANHA_PATH)) fs.writeFileSync(MENSAGEM_CAMPANHA_PATH, 'Olá! Temos uma promoção especial hoje.');

// --- ROTAS DA API ---

app.get('/api/dados', async (req, res) => {
    let conectado = false;

    if (clientInstance) {
        try {
            conectado = await clientInstance.isConnected();
            statusTexto = conectado ? 'Conectado e Pronto!' : 'Conectando...';
        } catch (e) {
            conectado = false;
            statusTexto = 'Desconectado';
        }
    }

    res.json({
        msgBot: fs.readFileSync(MENSAGEM_PATH, 'utf8'),
        msgCampanha: fs.readFileSync(MENSAGEM_CAMPANHA_PATH, 'utf8'),
        botConectado: conectado,
        statusTexto: statusTexto,
        campanhaRodando: campanhaEmAndamento
    });
});

app.post('/api/mensagem/salvar', (req, res) => {
    const { tipo, texto } = req.body;
    const arquivo = tipo === 'bot' ? MENSAGEM_PATH : MENSAGEM_CAMPANHA_PATH;
    fs.writeFileSync(arquivo, texto, 'utf8');
    res.json({ mensagem: 'Mensagem atualizada com sucesso!' });
});

// Inicia APENAS a conexão do WhatsApp e as respostas automáticas
app.post('/api/bot/iniciar', (req, res) => {
    if (clientInstance) {
        return res.json({ mensagem: 'O WhatsApp já está conectado ou inicializando!' });
    }

    statusTexto = 'Iniciando / Aguardando QR Code...';

    wppconnect.create({
        session: 'barbearia',
        folderNameToken: TOKENS_DIR, // Utiliza a pasta tokens em vez de chrome-data
        headless: false,
        useChrome: true,
        autoClose: 0,
        waitForLogin: true,
        logQR: true,
        browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    })
    .then(client => {
        clientInstance = client;
        statusTexto = 'Conectado e Pronto!';
        ativarRespostasAutomaticas(client);
        console.log("🤖 WhatsApp conectado com sucesso!");
    })
    .catch(err => {
        statusTexto = 'Erro ao conectar';
        clientInstance = null;
        console.log(err);
    });

    res.json({ mensagem: 'Iniciando o WhatsApp... Verifique o navegador/terminal.' });
});

// Dispara a campanha SOMENTE quando acionado pelo painel
app.post('/api/campanha/iniciar', async (req, res) => {
    if (!clientInstance) {
        return res.status(400).json({ mensagem: 'Primeiro conecte o WhatsApp!' });
    }
    if (campanhaEmAndamento) {
        return res.status(400).json({ mensagem: 'A campanha já está sendo executada!' });
    }

    campanhaEmAndamento = true;
    res.json({ mensagem: 'Campanha iniciada! Acompanhe o progresso pelo terminal.' });

    // Executa a campanha em segundo plano
    await dispararCampanha(clientInstance);
    campanhaEmAndamento = false;
});

function ativarRespostasAutomaticas(client) {
    client.onMessage(async (message) => {
        if (!message.from || !message.from.endsWith("@c.us") || message.isGroupMsg || message.fromMe) return;

        const contato = message.from;
        const agora = Date.now();

        if (respondidos[contato] && agora - respondidos[contato] < COOLDOWN) return;

        try {
            const msgBot = fs.readFileSync(MENSAGEM_PATH, 'utf8');
            await client.sendText(contato, msgBot);
            respondidos[contato] = agora;
            console.log("📩 Resposta automática enviada para:", contato);
        } catch (e) {
            console.log("Erro no envio:", e);
        }
    });
}

app.listen(3000, () => {
    console.log("==========================================");
    console.log("🌐 Painel rodando em: http://localhost:3000");
    console.log("==========================================");
    exec('start http://localhost:3000');
});