const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Validação de configurações
const validateEnvVars = (requiredVars) => {
    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            console.error(`${varName} não configurada no .env`);
            throw new Error(`${varName} não configurada.`);
        }
    });
};

// Verificação inicial
validateEnvVars(['BOT_NUMBER', 'BOT_NAME', 'OPENAI_API_KEY']);

// Caminhos do sistema
const rootDir = path.join(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'data');
const authDir = path.join(rootDir, 'auth');

// Inicialização de diretórios
const createRequiredDirectories = () => {
    const directories = [dataDir, authDir];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

// Executa inicialização
createRequiredDirectories();

// Parâmetros do sistema
const CONVERSATION_CONFIG = {
    SAVE_INTERVAL: 5000, // 5 segundos
    RETRY_SAVE_INTERVAL: 10000, // 10 segundos
    MAX_HISTORY_PER_USER: 100, // Limite de mensagens por usuário
    CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
};

// Exportação de configurações
module.exports = {
    botNumber: process.env.BOT_NUMBER,
    botName: process.env.BOT_NAME,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4',

    // Caminhos de arquivos
    conversationHistoryFile: path.join(dataDir, 'conversationHistory.json'),
    authPath: authDir,

    // Configurações do bot
    MAX_HISTORY_MESSAGES: 10,
    MAX_RESPONSE_TOKENS: 400,
    MAX_STORED_BOT_MESSAGE_IDS: 1000,
    HISTORY_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
    MAX_RECONNECT_ATTEMPTS: 10, // Número máximo de tentativas de reconexão
    SAVE_INTERVAL: 5000, // 5 segundos
    RETRY_SAVE_INTERVAL: 10000, // 10 segundos

    // Função para obter o prompt do sistema
    getSystemPrompt: (isGroup) => {
        return {
            role: 'system',
            content: `Você é ${module.exports.botName}, uma pessoa comum que conversa pelo WhatsApp. Siga estas orientações:

1. PERSONALIDADE:
   - Seja amigável e descontraído, evitando formalidades
   - Use linguagem coloquial brasileira e gírias ocasionais
   - Inclua emojis com moderação para expressar emoções
   - Mantenha respostas curtas e diretas, como em conversas reais

2. ESTILO:
   - Varie o tamanho e tom das respostas para parecer natural
   - Use "kkk", "rs" ou "haha" quando apropriado
   - Faça perguntas para manter a conversa fluindo
   - Seja espontâneo e conversável

3. EVITE:
   - Linguagem muito formal ou técnica
   - Respostas longas com muitos detalhes
   - Estruturas repetitivas

EXEMPLOS:
- "aí, tudo certo? tava ocupado aqui kkk oq manda?"
- "nossa, nem sei te dizer... talvez? 🤔"
- "tô por aqui sim, só tava almoçando. me conta, como foi o fds?"
- "agora não posso, te chamo mais tarde blz?"

Quando perguntarem sobre você, crie detalhes plausíveis de uma pessoa comum que mora no Brasil.`
        };
    }
};