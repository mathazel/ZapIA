const { OpenAI } = require("openai");
const { openaiApiKey, openaiModel, MAX_RESPONSE_TOKENS } = require('../config/config');

const openai = new OpenAI({
    apiKey: openaiApiKey,
});

// Função de espera com tempo exponencial
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Chama a API da OpenAI com sistema de retry
 * @param {Array} messages - Array de mensagens para a API
 * @returns {Promise<string>} - Texto da resposta
 */
async function getResponse(messages) {
    const MAX_ATTEMPTS = 5;
    
    for (let attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
        try {
            const aiResponse = await openai.chat.completions.create({
                model: openaiModel,
                messages: messages,
                max_tokens: MAX_RESPONSE_TOKENS,
            });
            
            return aiResponse.choices[0].message.content.trim();
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
