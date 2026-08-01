const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const LOG_ENVIADOS = path.join(DATA_DIR, 'enviados.txt');
const LOG_ERROS = path.join(DATA_DIR, 'erros.txt');
const MENSAGEM_CAMPANHA_PATH = path.join(DATA_DIR, 'mensagemCampanha.txt');
const CLIENTES_PATH = path.join(DATA_DIR, 'clientes.csv');

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

function salvarSucesso(numero) {
    fs.appendFileSync(
        LOG_ENVIADOS,
        `${new Date().toLocaleString()} - ${numero}\n`
    );
}

function salvarErro(numero, erro) {
    fs.appendFileSync(
        LOG_ERROS,
        `${new Date().toLocaleString()} - ${numero} - ${erro}\n`
    );
}

// Função principal que é chamada apenas quando acionada pelo painel
async function dispararCampanha(client) {
    // Lê a mensagem atualizada do arquivo de campanha no momento do disparo
    const mensagem = fs.readFileSync(MENSAGEM_CAMPANHA_PATH, 'utf8');
    const clientes = [];

    console.log("📥 Carregando clientes do CSV...");

    return new Promise((resolve) => {
        fs.createReadStream(CLIENTES_PATH)
            .pipe(csv())
            .on('data', row => {
                if (row.Telefone) {
                    clientes.push({
                        telefone: row.Telefone.trim()
                    });
                }
            })
            .on('end', async () => {
                if (clientes.length === 0) {
                    console.log("❌ Nenhum cliente encontrado no CSV.");
                    return resolve(false);
                }

                embaralhar(clientes);
                console.log(`🚀 ${clientes.length} clientes carregados. Iniciando os disparos...`);

                let contador = 0;

                for (const cliente of clientes) {
                    let numeroLimpo = cliente.telefone.replace(/\D/g, '');

                    if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
                        numeroLimpo = '55' + numeroLimpo;
                    }

                    const numeroWhatsApp = `${numeroLimpo}@c.us`;

                    try {
                        console.log(`[${contador + 1}/${clientes.length}] Preparando envio para ${numeroLimpo}...`);

                        await esperar(tempoContato());

                        await client.sendText(numeroWhatsApp, mensagem);

                        salvarSucesso(numeroLimpo);
                        console.log(`✅ Mensagem enviada com sucesso para: ${numeroLimpo}`);

                        await esperar(tempoEnvio());

                        contador++;

                        if (contador % 25 === 0 && contador < clientes.length) {
                            const pausa = tempoPausaGrande();
                            console.log(`⏳ Iniciando pausa de segurança de ${Math.round(pausa / 1000)} segundos para evitar bloqueios...`);
                            await esperar(pausa);
                            console.log("▶️ Pausa finalizada, retomando os disparos.");
                        }

                    } catch (erro) {
                        salvarErro(numeroLimpo, erro.message || JSON.stringify(erro));
                        console.log(`❌ Erro ao enviar para ${numeroLimpo}: ${erro.message || 'Erro desconhecido'}`);
                    }
                }

                console.log("🎉 Todos os disparos foram finalizados na lista!");
                resolve(true);
            });
    });
}

// Exporta a função para ser utilizada pelo server.js
module.exports = { dispararCampanha };