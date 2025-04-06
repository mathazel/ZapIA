const { OpenAI } = require("openai");
const { openaiApiKey, openaiModel, MAX_RESPONSE_TOKENS } = require('../config/config');

const openai = new OpenAI({
    apiKey: openaiApiKey,
});

// Função de espera com tempo exponencial
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Sistema de cache simples
const responseCache = new Map();
const CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutos em milissegundos
const MAX_CACHE_SIZE = 100; // Limitar o tamanho do cache

/**
 * Gera uma chave de cache única baseada no conteúdo das mensagens
 * @param {Array} messages - Array de mensagens
 * @returns {string} - Chave de cache
 */
function generateCacheKey(messages) {
    // Usar apenas as últimas 3 mensagens para a chave de cache para evitar chaves muito longas
    const relevantMessages = messages.slice(-3);
    return relevantMessages.map(m => `${m.role}:${m.content.substring(0, 100)}`).join('|');
}

/**
 * Limpa entradas antigas do cache quando o tamanho máximo é excedido
 */
function cleanupCache() {
    if (responseCache.size <= MAX_CACHE_SIZE) return;
    
    // Ordenar por timestamp e remover os mais antigos
    const entries = [...responseCache.entries()];
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remover os 20% mais antigos
    const toRemove = Math.ceil(MAX_CACHE_SIZE * 0.2);
    entries.slice(0, toRemove).forEach(([key]) => responseCache.delete(key));
}

/**
 * Chama a API da OpenAI com sistema de retry e cache
 * @param {Array} messages - Array de mensagens para a API
 * @returns {Promise<string>} - Texto da resposta
 */
async function getResponse(messages) {
    const MAX_ATTEMPTS = 5;
    
    // Verificar cache primeiro
    const cacheKey = generateCacheKey(messages);
    if (responseCache.has(cacheKey)) {
        const cachedResponse = responseCache.get(cacheKey);
        // Verificar se o cache ainda é válido
        if (Date.now() - cachedResponse.timestamp < CACHE_EXPIRATION) {
            console.log('Usando resposta em cache');
            return cachedResponse.response;
        } else {
            // Cache expirado
            responseCache.delete(cacheKey);
        }
    }
    
    for (let attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
        try {
            const aiResponse = await openai.chat.completions.create({
                model: openaiModel,
                messages: messages,
                max_tokens: MAX_RESPONSE_TOKENS,
            });
            
            const response = aiResponse.choices[0].message.content.trim();
            
            // Armazenar no cache
            responseCache.set(cacheKey, {
                response,
                timestamp: Date.now()
            });
            
            // Limpar cache se necessário
            cleanupCache();
            
            return response;
        } catch (error) {
            console.error(`Tentativa ${attempts} falhou:`, error.message);
            
            if (attempts === MAX_ATTEMPTS) {
                // Se as tentativas falharem, avisa o usuário
                throw new Error('Não conseguimos processar sua solicitação. Por favor, tente novamente mais tarde.');
            }
            
            // Espera exponencial entre tentativas
            await delay(1000 * Math.pow(2, attempts)); 
        }
    }
}

module.exports = {
    getResponse
};
