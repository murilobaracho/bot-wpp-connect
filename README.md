# WhatsApp Bot Panel 🤖

Bot de automação para WhatsApp desenvolvido em Node.js com a biblioteca **WPPConnect**, com um painel web para controlar tudo sem precisar mexer em código: conectar o WhatsApp, editar as mensagens, disparar campanhas e importar a lista de contatos. Serve como base para qualquer negócio que precise de atendimento/campanha automatizados via WhatsApp — basta trocar as mensagens padrão e a lista de contatos.

---

## 🚀 Funcionalidades

- **Painel web local:** conectar/desconectar o WhatsApp, editar mensagens e disparar campanhas pelo navegador.
- **Dashboard:** atendimentos automáticos, contatos únicos e envios de campanha, com gráfico dos últimos 14 dias.
- **QR Code no painel:** o QR de conexão aparece direto na página, sem precisar olhar terminal.
- **Resposta automática:** responde quem manda mensagem, com cooldown de 10 min por contato para não repetir.
- **Campanha em massa:** dispara uma mensagem para todos os contatos de um CSV, com pausas aleatórias para reduzir risco de bloqueio.
- **Importação de contatos:** troque a lista de disparo (`clientes.csv`) direto pelo painel, sem editar arquivos manualmente.
- **Bot standalone:** modo alternativo (`src/index.js`) que só fica ouvindo e respondendo mensagens, sem painel.

---

## 🛠️ Pré-requisitos

- [Node.js](https://nodejs.org/) (versão LTS recomendada)
- Google Chrome instalado (usado pelo WPPConnect para abrir o WhatsApp Web)
- [Git](https://git-scm.com/) (opcional, para clonar o repositório)

---

## 📦 Dependências (npm)

Instaladas automaticamente pelo `npm install`, mas seguem listadas aqui pra referência:

| Pacote | Versão | Uso |
|---|---|---|
| [`@wppconnect-team/wppconnect`](https://www.npmjs.com/package/@wppconnect-team/wppconnect) | `^2.2.6` | Conexão com o WhatsApp Web (QR Code, envio/recebimento de mensagens) |
| [`express`](https://www.npmjs.com/package/express) | `^5.2.1` | Servidor web do painel e API |
| [`csv-parser`](https://www.npmjs.com/package/csv-parser) | `^3.2.1` | Leitura do `clientes.csv` na campanha |

---

## 📥 Instalação

```bash
git clone https://github.com/murilobaracho/bot-wpp-connect.git
cd bot-wpp-connect
npm install
```

---

## 📂 Estrutura do projeto

```
bot-wpp-connect/
├── src/
│   ├── server.js      # Painel web (conexão, mensagens, campanha, contatos)
│   ├── index.js        # Bot standalone (sem painel, só resposta automática)
│   ├── campanha.js     # Lógica de disparo em massa
│   └── stats.js        # Registro de eventos e agregação para o dashboard
├── public/
│   ├── index.html       # Interface do painel
│   ├── css/style.css
│   └── js/app.js
├── data/
│   ├── clientes.csv         # Lista de contatos da campanha
│   ├── mensagem.txt         # Mensagem de resposta automática
│   ├── mensagemCampanha.txt # Mensagem da campanha
│   ├── enviados.txt         # Log de envios da campanha (gerado em tempo de execução)
│   └── eventos.jsonl        # Eventos usados no dashboard (gerado em tempo de execução)
├── scripts/
│   ├── iniciarPainel.bat            # Atalho para subir o painel com terminal visível (debug)
│   └── iniciarPainelSilencioso.vbs  # Atalho para subir o painel sem abrir terminal
└── tokens/                  # Sessão do WhatsApp (gerado automaticamente, não versionado)
```

---

## ▶️ Uso

### Painel web (recomendado)

```bash
npm run panel
```

No Windows, dê duplo clique em:
- [scripts/iniciarPainelSilencioso.vbs](scripts/iniciarPainelSilencioso.vbs) — sobe o painel sem abrir nenhuma janela de terminal (uso normal). Na primeira vez, instala as dependências (`npm install`) automaticamente antes de iniciar.
- [scripts/iniciarPainel.bat](scripts/iniciarPainel.bat) — sobe o painel com o terminal visível, útil para ver logs em caso de erro.

O painel abre automaticamente em `http://localhost:3000`, onde é possível:
- Conectar o WhatsApp: o QR Code aparece direto no card de conexão do painel — basta escanear com o celular.
- Desconectar o WhatsApp a qualquer momento pelo botão ao lado do status.
- Editar a mensagem de resposta automática e a mensagem de campanha.
- Importar um novo `clientes.csv` para a campanha.
- Disparar a campanha para todos os contatos da lista.

### Bot standalone (sem painel)

```bash
npm start
```

Sobe apenas o bot de resposta automática, lendo a mensagem de `data/mensagemCampanha.txt`.

### Campanha via terminal

```bash
npm run campanha
```

---

## ⚙️ Configuração

- **Mensagem de resposta automática:** `data/mensagem.txt` (editável também pelo painel).
- **Mensagem de campanha:** `data/mensagemCampanha.txt` (editável também pelo painel).
- **Lista de contatos da campanha:** `data/clientes.csv`, com uma coluna `Telefone` (DDD + número, com ou sem `55`).
- **Cooldown de resposta automática:** 10 minutos por contato (ajustável em `COOLDOWN` no `src/server.js`/`src/index.js`).
- **Nome da sessão do WhatsApp:** variável de ambiente `WPP_SESSION` (padrão: `bot`). Define o nome da pasta em `tokens/` onde a sessão fica salva.

---

## ⚠️ Aviso

Disparos em massa não solicitados podem violar os Termos de Serviço do WhatsApp e resultar em bloqueio do número. Use com moderação, preferencialmente com contatos que já interagiram com o seu negócio.
