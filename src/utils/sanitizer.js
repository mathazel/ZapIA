/**
 * Módulo para sanitização e validação de inputs
 */

/**
 * Sanitiza um ID do WhatsApp para evitar injeção
 * @param {string} id - ID do WhatsApp a ser sanitizado
 * @returns {string} ID sanitizado
 */
function sanitizeWhatsAppId(id) {
    if (!id || typeof id !== 'string') return '';
    // Remove tudo exceto números, letras, @ e pontos que são partes válidas de IDs do WhatsApp
    return id.replace(/[^a-zA-Z0-9@.-]/g, '');
}

/**
 * Sanitiza mensagem de texto
 * @param {string} message - Mensagem a ser sanitizada
 * @returns {string} Mensagem sanitizada
 */
function sanitizeMessage(message) {
    if (!message || typeof message !== 'string') return '';
    
    // Limita o tamanho da mensagem para evitar ataques de memory overflow
    if (message.length > 10000) {
        message = message.substring(0, 10000) + '... (mensagem truncada por exceder o limite)';
    }
    
    // Remove caracteres potencialmente perigosos
    let sanitized = message
        .replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}]/gu, '') // Remove caracteres não imprimíveis
        .trim();
    
    // Remover dados sensíveis
    sanitized = removeSensitiveData(sanitized);
    
    return sanitized;
}

/**
 * Remove dados sensíveis do texto
 * @param {string} text - Texto a ser processado
 * @returns {string} Texto sem dados sensíveis
 */
function removeSensitiveData(text) {
    // Remover possíveis CPFs (formato xxx.xxx.xxx-xx ou xxxxxxxxxxx)
    text = text.replace(/\b\d{3}[\.-]?\d{3}[\.-]?\d{3}[\.-]?\d{2}\b/g, '[CPF REMOVIDO]');
    
    // Remover possíveis números de cartão de crédito
    text = text.replace(/\b(?:\d{4}[- ]?){3}\d{4}\b/g, '[CARTÃO REMOVIDO]');
    
    // Remover possíveis chaves PIX
    text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (match) => {
        // Verifica se parece um email que poderia ser chave PIX
        if (match.includes('@') && match.includes('.')) {
            return '[CHAVE PIX REMOVIDA]';
        }
        return match;
    });
    
    // Remover possíveis tokens e chaves de API (sequências de 20+ caracteres alfanuméricos)
    text = text.replace(/\b[A-Za-z0-9_\-]{20,}\b/g, '[POSSÍVEL TOKEN REMOVIDO]');
    
    // Remover possíveis senhas (sequências curtas após palavras como senha, password, etc.)
    text = text.replace(/\b(senha|password|pwd|secret)\s*[:=]?\s*["']?[A-Za-z0-9!@#$%^&*()_+]{4,16}["']?/gi, 
                        '$1: [SENHA REMOVIDA]');
    
    // Remover possíveis números de celular brasileiros
    text = text.replace(/\b(?:\+55\s?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}\b/g, '[TELEFONE REMOVIDO]');
    
    return text;
}

/**
 * Valida se string está em formato JSON válido
 * @param {string} jsonString - String a ser validada
 * @returns {boolean} true se for JSON válido
 */
function isValidJson(jsonString) {
    try {
        JSON.parse(jsonString);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    sanitizeWhatsAppId,
    sanitizeMessage,
    removeSensitiveData,
    isValidJson
};