/**
 * Ferramentas de sanitização e validação de dados
 * Protege contra injections e remove informações sensíveis
 */

/**
 * Limpa identificadores do WhatsApp
 * @param {string} id ID a ser processado
 * @returns {string} ID seguro para uso
 */
function sanitizeWhatsAppId(id) {
    if (!id || typeof id !== 'string') return '';
    // Remove tudo exceto números, letras, @ e pontos que são partes válidas de IDs do WhatsApp
    return id.replace(/[^a-zA-Z0-9@.-]/g, '');
}

/**
 * Processa mensagens de texto
 * @param {string} message Texto a ser sanitizado
 * @returns {string} Mensagem segura para processamento
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
 * Filtra informações sensíveis
 * @param {string} text Texto original
 * @returns {string} Texto sem dados pessoais ou confidenciais
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
 * Verifica formato JSON
 * @param {string} jsonString Texto a validar
 * @returns {boolean} Resultado da validação
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