const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const mensagem = fs.readFileSync(path.join(ROOT_DIR, 'data', 'mensagemCampanha.txt'), 'utf8');

const COOLDOWN = 10 * 60 * 1000;
const respondidos = {};

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

  client.onMessage(async (message) => {

    if (!message.from) return;

    // ACEITA CONTATOS DIRETOS: número (@c.us) ou id vinculado/privacidade (@lid)
    if (!message.from.endsWith("@c.us") && !message.from.endsWith("@lid")) return;

    // IGNORA GRUPOS
    if (message.isGroupMsg) return;

    // IGNORA MENSAGENS DO PRÓPRIO BOT
    if (message.fromMe) return;

    const contato = message.from;
    const agora = Date.now();

    // COOLDOWN
    if (respondidos[contato] && agora - respondidos[contato] < COOLDOWN)
        return;

    try {

        await client.sendText(contato, mensagem);

        respondidos[contato] = agora;

        console.log("Mensagem enviada para:", contato);

    } catch (e) {

        console.log("Erro envio:", e);

    }

  });

}