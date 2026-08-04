const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const EVENTOS_PATH = path.join(DATA_DIR, 'eventos.jsonl');

function registrarEvento(tipo, dados = {}) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const linha = JSON.stringify({ tipo, timestamp: Date.now(), ...dados });
        fs.appendFileSync(EVENTOS_PATH, linha + '\n');
    } catch (e) {
        console.log('Erro ao registrar evento de estatística:', e);
    }
}

function lerEventos() {
    if (!fs.existsSync(EVENTOS_PATH)) return [];

    return fs.readFileSync(EVENTOS_PATH, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(linha => {
            try {
                return JSON.parse(linha);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);
}

function chaveDia(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 10);
}

function obterResumo() {
    const eventos = lerEventos();
    const agora = Date.now();
    const umDiaMs = 24 * 60 * 60 * 1000;
    const inicioHoje = new Date().setHours(0, 0, 0, 0);

    const resumo = {
        respostasAutomaticas: { hoje: 0, total: 0 },
        campanha: { enviados: 0, erros: 0 },
        contatosUnicos: new Set(),
        ultimaPausaSeguranca: null,
        serieDiaria: []
    };

    const porDia = {};

    for (const evento of eventos) {
        if (evento.tipo === 'resposta_automatica') {
            resumo.respostasAutomaticas.total++;
            if (evento.timestamp >= inicioHoje) resumo.respostasAutomaticas.hoje++;
            if (evento.contato) resumo.contatosUnicos.add(evento.contato);
        } else if (evento.tipo === 'campanha_enviada') {
            resumo.campanha.enviados++;
        } else if (evento.tipo === 'campanha_erro') {
            resumo.campanha.erros++;
        } else if (evento.tipo === 'pausa_seguranca') {
            resumo.ultimaPausaSeguranca = evento.timestamp;
        }

        if (evento.tipo === 'resposta_automatica' || evento.tipo === 'campanha_enviada') {
            const dia = chaveDia(evento.timestamp);
            porDia[dia] = (porDia[dia] || 0) + 1;
        }
    }

    for (let i = 13; i >= 0; i--) {
        const dia = chaveDia(agora - i * umDiaMs);
        resumo.serieDiaria.push({ dia, total: porDia[dia] || 0 });
    }

    resumo.contatosUnicos = resumo.contatosUnicos.size;
    return resumo;
}

module.exports = { registrarEvento, obterResumo };
