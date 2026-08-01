const express = require('express');
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { dispararCampanha, getProgresso } = require('./campanha');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TOKENS_DIR = path.join(ROOT_DIR, 'tokens');
const MENSAGEM_PATH = path.join(DATA_DIR, 'mensagem.txt');
const MENSAGEM_CAMPANHA_PATH = path.join(DATA_DIR, 'mensagemCampanha.txt');
const CLIENTES_PATH = path.join(DATA_DIR, 'clientes.csv');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(PUBLIC_DIR));

const COOLDOWN = 10 * 60 * 1000;
const respondidos = {};

// Só reage a tipos que são mensagens de verdade escritas por alguém. onMessage também
// dispara pra eventos como chamada perdida, mudança de código de segurança, entrada/saída
// de grupo, mensagem apagada etc. — que têm um contato real em "from" mas não são conversa.
const TIPOS_MENSAGEM_VALIDOS = new Set([
    'chat', 'image', 'video', 'audio', 'ptt', 'sticker', 'document',
    'location', 'vcard', 'multi_vcard'
]);

let clientInstance = null;
let statusTexto = 'Desconectado';
let campanhaEmAndamento = false;
let qrCodeAtual = null;

// O painel consulta /api/dados a cada 3s (1s enquanto conecta); se esse "pulso"
// sumir por muito tempo, é porque a aba do painel foi fechada (um F5 comum retoma
// antes disso). Folga generosa porque diálogos como confirm()/alert() no navegador
// pausam o JavaScript da página enquanto estão abertos, sem a aba ter sido fechada.
let ultimoHeartbeat = Date.now();
const HEARTBEAT_TIMEOUT = 40000;
let encerrando = false;

async function encerrarTudo(motivo) {
    if (encerrando) return;
    encerrando = true;

    console.log(`🔒 ${motivo} Encerrando WhatsApp e finalizando o processo...`);

    if (clientInstance) {
        try {
            await clientInstance.close();
        } catch (e) {
            console.log('Erro ao encerrar o WhatsApp:', e);
        }
    }

    process.exit(0);
}

setInterval(() => {
    if (Date.now() - ultimoHeartbeat > HEARTBEAT_TIMEOUT) {
        encerrarTudo('Painel fechado.');
    }
}, 5000);

process.on('SIGINT', () => encerrarTudo('Processo interrompido (Ctrl+C).'));
process.on('SIGTERM', () => encerrarTudo('Processo finalizado.'));

// Garante que os arquivos existam
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(MENSAGEM_PATH)) fs.writeFileSync(MENSAGEM_PATH, 'Olá! Como posso te ajudar?');
if (!fs.existsSync(MENSAGEM_CAMPANHA_PATH)) fs.writeFileSync(MENSAGEM_CAMPANHA_PATH, 'Olá! Temos uma promoção especial hoje.');

// --- ROTAS DA API ---

app.get('/api/dados', async (req, res) => {
    ultimoHeartbeat = Date.now();
    let conectado = false;

    if (clientInstance) {
        try {
            conectado = await clientInstance.isConnected();
            statusTexto = conectado ? 'Conectado e Pronto!' : 'Conectando...';
            if (conectado) qrCodeAtual = null;
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
        campanhaRodando: campanhaEmAndamento,
        // Independente do isConnected(): só mostra QR enquanto de fato aguarda leitura
        qrCode: qrCodeAtual,
        respostaAutomaticaPausada
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
    qrCodeAtual = null;

    wppconnect.create({
        session: 'barbearia',
        folderNameToken: TOKENS_DIR, // Utiliza a pasta tokens em vez de chrome-data
        headless: true, // QR e status ficam no painel, não precisa de janela/ícone visível
        useChrome: true,
        autoClose: 0,
        waitForLogin: true,
        logQR: false, // QR não vai pro terminal, é exibido no painel
        catchQR: (base64Qr) => {
            qrCodeAtual = base64Qr;
            statusTexto = 'Aguardando leitura do QR Code...';
        },
        statusFind: (status) => {
            switch (status) {
                case 'qrReadSuccess':
                    qrCodeAtual = null;
                    statusTexto = 'QR Code lido! Sincronizando...';
                    break;
                case 'inChat':
                case 'isLogged':
                    qrCodeAtual = null;
                    statusTexto = 'Quase lá...';
                    break;
                case 'notLogged':
                    statusTexto = 'Aguardando leitura do QR Code...';
                    break;
                case 'qrReadError':
                case 'qrReadFail':
                    qrCodeAtual = null;
                    statusTexto = 'Erro ao ler o QR Code, tente novamente';
                    break;
                case 'phoneNotConnected':
                    statusTexto = 'Celular não conectado à internet';
                    break;
                case 'desconnectedMobile':
                    statusTexto = 'WhatsApp foi desconectado no celular';
                    break;
            }
        },
        onLoadingScreen: (percent, message) => {
            statusTexto = `Sincronizando... ${percent}%`;
        },
        browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            // Evita que a página fique "desacelerada" em segundo plano, o que pode
            // atrapalhar a renovação do QR Code e o keep-alive do WhatsApp Web
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-background-timer-throttling'
        ]
    })
    .then(client => {
        clientInstance = client;
        statusTexto = 'Conectado e Pronto!';
        qrCodeAtual = null;
        ativarRespostasAutomaticas(client);
        console.log("🤖 WhatsApp conectado com sucesso!");
    })
    .catch(err => {
        statusTexto = 'Erro ao conectar';
        clientInstance = null;
        qrCodeAtual = null;
        console.log(err);
    });

    res.json({ mensagem: 'Iniciando o WhatsApp... Verifique o navegador/terminal.' });
});

// Encerra a conexão do WhatsApp
app.post('/api/bot/encerrar', async (req, res) => {
    if (!clientInstance) {
        return res.json({ mensagem: 'O WhatsApp já está desconectado!' });
    }

    try {
        await clientInstance.close();
    } catch (e) {
        console.log('Erro ao encerrar:', e);
    }

    clientInstance = null;
    statusTexto = 'Desconectado';
    qrCodeAtual = null;
    res.json({ mensagem: 'WhatsApp desconectado!' });
});

// Substitui a lista de clientes usada na campanha
app.post('/api/clientes/importar', (req, res) => {
    const { conteudo } = req.body;

    if (!conteudo || !conteudo.trim()) {
        return res.status(400).json({ mensagem: 'Arquivo vazio ou inválido!' });
    }

    fs.writeFileSync(CLIENTES_PATH, conteudo, 'utf8');
    res.json({ mensagem: 'Lista de contatos atualizada com sucesso!' });
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

// Progresso da campanha em andamento (ou da última executada)
app.get('/api/campanha/progresso', (req, res) => {
    res.json(getProgresso());
});

// Trava de segurança: se disparar mensagens demais em pouco tempo, algo está errado
// (ex.: uma brecha de filtro ainda não identificada) — pausa em vez de virar disparo em massa
const LIMITE_ENVIOS = 5;
const JANELA_LIMITE_MS = 60 * 1000;
let enviosRecentes = [];
let respostaAutomaticaPausada = false;

function podeEnviarAutomatico() {
    if (respostaAutomaticaPausada) return false;

    const agora = Date.now();
    enviosRecentes = enviosRecentes.filter(t => agora - t < JANELA_LIMITE_MS);

    if (enviosRecentes.length >= LIMITE_ENVIOS) {
        respostaAutomaticaPausada = true;
        console.log(`🚨 Resposta automática PAUSADA: ${LIMITE_ENVIOS}+ mensagens em menos de 1 minuto (comportamento anômalo). Reinicie o bot depois de investigar.`);
        return false;
    }

    enviosRecentes.push(agora);
    return true;
}

function ativarRespostasAutomaticas(client) {
    // Momento em que o bot começou a ouvir: usado para ignorar mensagens antigas
    // que o WhatsApp sincroniza ao conectar (senão o bot "responde" ao histórico inteiro)
    const inicioEscuta = Math.floor(Date.now() / 1000);

    client.onMessage(async (message) => {
        if (!message.from || message.fromMe) return;

        // Só reage a mensagens de conteúdo de verdade (texto, mídia...), ignora
        // notificações, chamadas, eventos de grupo, mensagens apagadas, etc.
        if (!TIPOS_MENSAGEM_VALIDOS.has(message.type)) return;

        // Ignora grupos (isGroupMsg nem sempre é confiável sozinho: também checa o
        // sufixo do JID e o campo "author", que só existe em mensagens de grupo)
        if (message.isGroupMsg) return;
        if (message.from.endsWith('@g.us')) return;
        if (message.author && message.author !== message.from) return;

        // Ignora Status/broadcast do WhatsApp (aparece pra qualquer contato da agenda,
        // mesmo sem nunca ter havido conversa)
        if (message.broadcast) return;
        if (message.from === 'status@broadcast') return;

        // Ignora mensagens do histórico sincronizadas na conexão, só reage a mensagens novas
        if (message.isNewMsg === false) return;
        const carimboTempo = typeof message.timestamp === 'number' ? message.timestamp : message.t;
        if (typeof carimboTempo === 'number' && carimboTempo < inicioEscuta) return;

        // Contatos podem chegar como @c.us (número) ou @lid (id vinculado/privacidade)
        if (!message.from.endsWith("@c.us") && !message.from.endsWith("@lid")) return;

        const contato = message.from;
        const agora = Date.now();

        if (respondidos[contato] && agora - respondidos[contato] < COOLDOWN) return;

        if (!podeEnviarAutomatico()) return;

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