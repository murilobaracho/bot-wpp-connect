const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const mensagem = fs.readFileSync(path.join(ROOT_DIR, 'data', 'mensagemCampanha.txt'), 'utf8');

const COOLDOWN = 10 * 60 * 1000;
const respondidos = {};

// Só reage a tipos que são mensagens de verdade escritas por alguém. onMessage também
// dispara pra eventos como chamada perdida, mudança de código de segurança, entrada/saída
// de grupo, mensagem apagada etc. — que têm um contato real em "from" mas não são conversa.
const TIPOS_MENSAGEM_VALIDOS = new Set([
  'chat', 'image', 'video', 'audio', 'ptt', 'sticker', 'document',
  'location', 'vcard', 'multi_vcard'
]);

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

const chromeData = path.resolve(ROOT_DIR, 'chrome-data');

wppconnect.create({

  session: 'barbearia',

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

  // Momento em que o bot começou a ouvir: usado para ignorar mensagens antigas
  // que o WhatsApp sincroniza ao conectar (senão o bot "responde" ao histórico inteiro)
  const inicioEscuta = Math.floor(Date.now() / 1000);

  client.onMessage(async (message) => {

    if (!message.from || message.fromMe) return;

    // SÓ REAGE A MENSAGENS DE CONTEÚDO DE VERDADE (texto, mídia...), ignora
    // notificações, chamadas, eventos de grupo, mensagens apagadas, etc.
    if (!TIPOS_MENSAGEM_VALIDOS.has(message.type)) return;

    // IGNORA GRUPOS (isGroupMsg nem sempre é confiável sozinho: também checa o
    // sufixo do JID e o campo "author", que só existe em mensagens de grupo)
    if (message.isGroupMsg) return;
    if (message.from.endsWith('@g.us')) return;
    if (message.author && message.author !== message.from) return;

    // IGNORA STATUS/BROADCAST DO WHATSAPP (aparece pra qualquer contato da agenda,
    // mesmo sem nunca ter havido conversa)
    if (message.broadcast) return;
    if (message.from === 'status@broadcast') return;

    // IGNORA MENSAGENS DO HISTÓRICO SINCRONIZADAS NA CONEXÃO
    if (message.isNewMsg === false) return;
    const carimboTempo = typeof message.timestamp === 'number' ? message.timestamp : message.t;
    if (typeof carimboTempo === 'number' && carimboTempo < inicioEscuta) return;

    // ACEITA CONTATOS DIRETOS: número (@c.us) ou id vinculado/privacidade (@lid)
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

        console.log("Mensagem enviada para:", contato);

    } catch (e) {

        console.log("Erro envio:", e);

    }

  });

}