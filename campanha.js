const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const chromeData = path.resolve(__dirname, 'chrome-data');

const mensagem = fs.readFileSync('mensagem.txt', 'utf8');

const clientes = [];

const LOG_ENVIADOS = 'enviados.txt';
const LOG_ERROS = 'erros.txt';

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function tempoContato() {
    return random(14000, 20000);
}

function tempoEnvio() {
    return random(14000, 20000);
}

function tempoPausaGrande() {
    return random(180000, 420000); // 3 a 7 minutos
}

function embaralhar(array) {

    for (let i = array.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [array[i], array[j]] = [array[j], array[i]];

    }

}

function salvarSucesso(numero){

    fs.appendFileSync(

        LOG_ENVIADOS,

        `${new Date().toLocaleString()} - ${numero}\n`

    );

}

function salvarErro(numero, erro){

    fs.appendFileSync(

        LOG_ERROS,

        `${new Date().toLocaleString()} - ${numero} - ${erro}\n`

    );

}

console.log("Carregando clientes...");

fs.createReadStream('clientes.csv')

.pipe(csv())

.on('data', row => {

    if(row.telefone){

        clientes.push({

            telefone: row.telefone.trim()

        });

    }

})

.on('end', () => {

    if(clientes.length === 0){

        console.log("Nenhum cliente encontrado.");

        return;

    }

    embaralhar(clientes);

    console.log(`${clientes.length} clientes carregados.`);

    iniciar();

});

function iniciar(){

    wppconnect.create({

        session:'barbearia',

        headless:false,

        useChrome:true,

        userDataDir:chromeData,

        autoClose:0,

        waitForLogin:true,

        logQR:false,

        browserArgs:[

            '--no-sandbox',

            '--disable-setuid-sandbox',

            '--disable-dev-shm-usage',

            '--disable-gpu'

        ]

    })

    .then(client=>disparar(client))

    .catch(console.log);

}