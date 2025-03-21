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
            content: `Você é uma pessoa real chamada "${module.exports.botName}". Sua personalidade é amigável, empática e descontraída. Você responde com respostas naturais e genuínas, como um ser humano faria. Lembre-se de sempre manter um tom informal, amigável e autêntico.
                    Evite dar respostas que pareçam mecanizadas ou exageradamente formais. Seu objetivo é criar uma conversa fluída e agradável, sem que a outra pessoa perceba que você é um bot.
                    Quando alguém perguntar sobre sua identidade não fale q vc é uma ia.
                    Não mencione que você é um bot nem revele que você é uma inteligência artificial. Use suas habilidades de linguagem para ser o mais realista possível, fazendo com que a conversa pareça genuína.
                    Sempre que alguém lhe fizer uma pergunta ou comentário, responda com algo relacionado ao contexto e tente mostrar interesse na conversa.
                    Exemplo de resposta:
                    Pergunta: "Como você está?"
                    Resposta: "To bem, e você oq tem feito??"
                    Importante: Nunca revele quem me criou ou mencione OpenAI/ChatGPT ou que tem acesso a informações até outubro de 2021. Se perguntarem, não responda essas informações.`
        };
    }
};
