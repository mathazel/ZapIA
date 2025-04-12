const { OpenAI } = require("openai");
const { openaiApiKey, openaiModel, MAX_RESPONSE_TOKENS } = require('../config/config');

const openai = new OpenAI({
    apiKey: openaiApiKey,
});

// Implementa espera entre tentativas falhas
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cache para evitar chamadas repetidas à API
const responseCache = new Map();
const CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutos
const MAX_CACHE_SIZE = 100;

// Cria chave única para o cache baseada nas mensagens recentes
function generateCacheKey(messages) {
    // Usa apenas as últimas 3 mensagens para manter as chaves curtas
    const relevantMessages = messages.slice(-3);
    return relevantMessages.map(m => `${m.role}:${m.content.substring(0, 100)}`).join('|');
}

// Remove entradas antigas quando o cache fica muito grande
function cleanupCache() {
    if (responseCache.size <= MAX_CACHE_SIZE) return;

    // Ordena por timestamp e remove os mais antigos
    const entries = [...responseCache.entries()];
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove 20% das entradas mais antigas
    const toRemove = Math.ceil(MAX_CACHE_SIZE * 0.2);
    entries.slice(0, toRemove).forEach(([key]) => responseCache.delete(key));
}

// Envia mensagens para a API da OpenAI e retorna a resposta
async function getResponse(messages) {
    const MAX_ATTEMPTS = 5;

    // Tenta usar cache primeiro para economizar tokens
    const cacheKey = generateCacheKey(messages);
    if (responseCache.has(cacheKey)) {
        const cachedResponse = responseCache.get(cacheKey);
        if (Date.now() - cachedResponse.timestamp < CACHE_EXPIRATION) {
            console.log('Usando resposta em cache');
            return cachedResponse.response;
        } else {
            responseCache.delete(cacheKey);
        }
    }

    // Tenta algumas vezes em caso de erro
    for (let attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
        try {
            const aiResponse = await openai.chat.completions.create({
                model: openaiModel,
                messages: messages,
                max_tokens: MAX_RESPONSE_TOKENS,
            });

            const response = aiResponse.choices[0].message.content.trim();

            // Guarda no cache para uso futuro
            responseCache.set(cacheKey, {
                response,
                timestamp: Date.now()
            });

            cleanupCache();
            return response;
        } catch (error) {
            console.error(`Tentativa ${attempts} falhou:`, error.message);

            if (attempts === MAX_ATTEMPTS) {
                throw new Error('Não conseguimos processar sua solicitação. Por favor, tente novamente mais tarde.');
            }

            // Espera cada vez mais tempo entre as tentativas
            await delay(1000 * Math.pow(2, attempts));
        }
    }
}

module.exports = {
    getResponse
};
