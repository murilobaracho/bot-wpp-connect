const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');

const mensagem = fs.readFileSync('mensagem.txt', 'utf8');

const COOLDOWN = 10 * 60 * 1000;
const respondidos = {};

const chromeData = path.resolve(__dirname, 'chrome-data');

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

    // IGNORA STATUS
    if (!message.from.endsWith("@c.us")) return;

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

}c