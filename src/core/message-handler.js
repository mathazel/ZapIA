const fs = require('fs');
const async = require('async');
const { 
    processedMessagesFile, 
    getSystemPrompt, 
    botNumber, 
    MAX_STORED_BOT_MESSAGE_IDS 
} = require('../config/config');
const conversation = require('./conversation');
const openai = require('../services/openai');
const utils = require('../utils/utils');
const Sanitizer = require('../utils/sanitizer');

const botMessageIds = new Set();
let processedMessages = new Set();

// Carregar mensagens processadas uma única vez
try {
    const storedMessages = fs.readFileSync(processedMessagesFile, 'utf8');
    processedMessages = new Set(JSON.parse(storedMessages));
} catch (error) {
    console.error('Erro ao carregar mensagens processadas:', error);
}

// Função para registrar detalhes de erros
const logErrorDetails = (error) => {
    console.error('Detalhes do erro:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
};

/**
 * Envia uma mensagem do bot para o chat especificado
 */
const sendBotMessage = async (socket, chatId, text) => {
    try {
        const sentMsg = await socket.sendMessage(chatId, { text });
        if (sentMsg?.key?.id) {
            botMessageIds.add(sentMsg.key.id);
            if (botMessageIds.size > MAX_STORED_BOT_MESSAGE_IDS) {
                const oldestId = botMessageIds.values().next().value;
                botMessageIds.delete(oldestId);
            }
        }
        return sentMsg;
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        throw error;
    }
};

/**
 * Manipula eventos de mensagens recebidas do WhatsApp
 */
const handleMessageUpsert = async (socket, { messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
        try {
            // Ignora mensagens do próprio bot
            if (msg.key.fromMe || botMessageIds.has(msg.key.id)) continue;

            // Ignora mensagens já processadas
            if (processedMessages.has(msg.key.id)) continue;
            processedMessages.add(msg.key.id);

            const chatId = msg.key.remoteJid;
            const text = msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption || '';

            if (!text) continue;

            const isGroup = chatId.endsWith('@g.us');
            const sender = msg.key.participant || msg.key.remoteJid;

            // Adiciona à fila de processamento
            messageQueue.push({
                socket,
                data: {
                    msg,
                    text,
                    chatId,
                    isGroup,
                    sender
                }
            });

        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
            logErrorDetails(error);
        }
    }
};

// Fila de mensagens para processar uma mensagem por vez
const messageQueue = async.queue(async (task, callback) => {
    try {
        await processMessage(task.socket, task.data);
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    } finally {
        callback();
    }
}, 1);

/**
 * Processa uma mensagem da fila
 */
const processMessage = async (socket, { msg, text, chatId, isGroup, sender }) => {
    try {
        // Sanitiza todos os inputs
        const contextId = Sanitizer.sanitizeWhatsAppId(chatId);
        let sanitizedText = Sanitizer.sanitizeMessage(text); // Mudado para let
        const sanitizedSender = Sanitizer.sanitizeWhatsAppId(sender);
        
        // Exemplo de como os caracteres especiais são tratados:
        // Input: "<script>alert('xss')</script>"
        // Output: "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
        
        if (!contextId || !sanitizedText) {
            console.warn('Input inválido detectado');
            return;
        }

        // Em grupos, só responde se for mencionado ou se for reply de uma mensagem do bot
        if (isGroup) {
            const isMentioned = utils.isBotMentioned(sanitizedText);
            const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant === botNumber ||
                                botMessageIds.has(msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
            
            if (!isMentioned && !isReplyToBot) return;
            
            sanitizedText = utils.extractMessageWithoutMention(sanitizedText);
        }

        // Verifica se é um comando
        const isCommand = await utils.handleCommand(
            sanitizedText, 
            chatId, 
            contextId, 
            conversation.clearUserHistory, 
            (chatId, text) => sendBotMessage(socket, chatId, text)
        );
        if (isCommand) return;

        // Processamento normal da mensagem
        const userMessage = isGroup ? `[${sanitizedSender.split('@')[0]}]: ${sanitizedText}` : sanitizedText;
        await conversation.addMessage(contextId, 'user', userMessage);

        const userConversation = await conversation.getUserConversation(contextId);
        const messagesForAPI = [getSystemPrompt(isGroup), ...userConversation];
        
        const responseText = await openai.getResponse(messagesForAPI);

        await conversation.addMessage(contextId, 'assistant', responseText);
        await sendBotMessage(socket, chatId, responseText);
    } catch (error) {
        console.error('Erro:', error);
        logErrorDetails(error);
        
        // Mensagem de erro para o usuário
        await sendBotMessage(
            socket, 
            chatId, 
            "Desculpe, não consegui processar sua mensagem no momento. Por favor, tente novamente em alguns instantes."
        );
    }
};

// Salvar mensagens processadas periodicamente
setInterval(() => {
    try {
        fs.writeFileSync(processedMessagesFile, JSON.stringify([...processedMessages]), 'utf8');
    } catch (error) {
        console.error('Erro ao salvar mensagens processadas:', error);
    }
}, 5 * 60 * 1000); // A cada 5 minutos

module.exports = {
    messageQueue,
    sendBotMessage,
    processMessage,
    handleMessageUpsert
};
