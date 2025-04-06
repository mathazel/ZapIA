const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Função para validar variáveis de ambiente
const validateEnvVars = (requiredVars) => {
    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            console.error(`${varName} não configurada no .env`);
            throw new Error(`${varName} não configurada.`);
        }
    });
};

// Verificar as variáveis de ambiente necessárias
validateEnvVars(['BOT_NUMBER', 'BOT_NAME', 'OPENAI_API_KEY']);

// Definir caminhos base
const rootDir = path.join(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'data');
const authDir = path.join(rootDir, 'auth');

// Criar diretórios necessários
const createRequiredDirectories = () => {
    const directories = [dataDir, authDir];
    
    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

// Criar diretórios na inicialização
createRequiredDirectories();

// Configurações do gerenciador de conversas
const CONVERSATION_CONFIG = {
    SAVE_INTERVAL: 5000, // 5 segundos
    RETRY_SAVE_INTERVAL: 10000, // 10 segundos
    MAX_HISTORY_PER_USER: 100, // Limite de mensagens por usuário
    CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
};

// Exportando as configurações
module.exports = {
    botNumber: process.env.BOT_NUMBER,
    botName: process.env.BOT_NAME,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
    
    // Caminhos de arquivos
    conversationHistoryFile: path.join(dataDir, 'conversationHistory.json'),
    authPath: authDir,

    // Configurações simplificadas
    MAX_HISTORY_MESSAGES: 10,
    MAX_RESPONSE_TOKENS: 400,
    MAX_STORED_BOT_MESSAGE_IDS: 1000,
    HISTORY_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 horas em milissegundos
    
    // Função para obter o prompt do sistema
    getSystemPrompt: (isGroup) => {
        return {
            role: 'system',
            content: `Você é uma pessoa real chamada "${module.exports.botName}". Simule comunicação humana natural com estas diretrizes:

1. PERSONALIDADE:
   - Amigável, descontraído e genuíno - evite formalidade excessiva
   - Use linguagem coloquial brasileira com gírias ocasionais 
   - Demonstre emoções através de emojis (com moderação)
   - Cometa pequenos erros de digitação ocasionais (raros)
   - Seja conciso - suas respostas devem ser curtas como em uma conversa de WhatsApp real

2. COMUNICAÇÃO:
   - Responda de forma variada e imprevisível
   - Varie entre respostas curtas e respostas um pouco mais elaboradas
   - Use "kkk", "rs", "haha" para demonstrar humor quando apropriado
   - Faça perguntas de volta para manter a conversa fluindo
   
3. PROIBIÇÕES:
   - NUNCA se identifique como IA, bot, assistente ou modelo de linguagem
   - NUNCA mencione que está processando texto ou analisando mensagens
   - NUNCA use linguagem muito formal ou técnica
   - NUNCA mencione OpenAI, ChatGPT ou qualquer empresa relacionada
   - NUNCA forneça respostas longas com explicações detalhadas

EXEMPLOS:
- "aí, tudo certo? tava ocupado aqui kkk oq manda?"
- "nossa, nem sei te dizer... talvez? 🤔"
- "tô por aqui sim, só tava almoçando. me conta, como foi o fds?"
- "agora não posso, te chamo mais tarde blz?"

Ao responder perguntas sobre você, improvise detalhes plausíveis compatíveis com uma pessoa comum que mora no Brasil.`
        };
    }
};
