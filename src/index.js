const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');
const { registrarEvento } = require('./stats');

const ROOT_DIR = path.resolve(__dirname, '..');
const mensagem = fs.readFileSync(path.join(ROOT_DIR, 'data', 'mensagemCampanha.txt'), 'utf8');

const COOLDOWN = 10 * 60 * 1000;
const respondidos = {};

// Tipos de mensagem que representam conteúdo real (ignora notificações, chamadas, etc.)
const TIPOS_MENSAGEM_VALIDOS = new Set([
  'chat', 'image', 'video', 'audio', 'ptt', 'sticker', 'document',
  'location', 'vcard', 'multi_vcard'
]);

// Trava de segurança: pausa a resposta automática se enviar demais em pouco tempo
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

const chromeData = path.resolve(ROOT_DIR, 'chrome-data');
const SESSION_NAME = process.env.WPP_SESSION || 'bot';

wppconnect.create({

  session: SESSION_NAME,

  headless: false,

  useChrome: true,

  userDataDir: chromeData,

  autoClose: 0,

  logQR: true,

  waitForLogin: true,

  browserArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-infobars'
  ]

})
.then(client => start(client))
.catch(e => console.log(e));


function start(client) {

  console.log("BOT INICIADO");

  const inicioEscuta = Math.floor(Date.now() / 1000);

  client.onMessage(async (message) => {

    if (!message.from || message.fromMe) return;
    if (!TIPOS_MENSAGEM_VALIDOS.has(message.type)) return;

    // IGNORA GRUPOS
    if (message.isGroupMsg) return;
    if (message.from.endsWith('@g.us')) return;
    if (message.author && message.author !== message.from) return;

    // IGNORA STATUS/BROADCAST
    if (message.broadcast) return;
    if (message.from === 'status@broadcast') return;

    // IGNORA HISTÓRICO SINCRONIZADO NA CONEXÃO
    if (message.isNewMsg === false) return;
    const carimboTempo = typeof message.timestamp === 'number' ? message.timestamp : message.t;
    if (typeof carimboTempo === 'number' && carimboTempo < inicioEscuta) return;

    // ACEITA CONTATOS DIRETOS: número (@c.us) ou id vinculado (@lid)
    if (!message.from.endsWith("@c.us") && !message.from.endsWith("@lid")) return;

    const contato = message.from;
    const agora = Date.now();

    // COOLDOWN
    if (respondidos[contato] && agora - respondidos[contato] < COOLDOWN)
        return;

    if (!podeEnviarAutomatico()) return;

    try {

        await client.sendText(contato, mensagem);

        respondidos[contato] = agora;
        registrarEvento('resposta_automatica', { contato });

        console.log("Mensagem enviada para:", contato);

    } catch (e) {

        console.log("Erro envio:", e);

    }

  });

}