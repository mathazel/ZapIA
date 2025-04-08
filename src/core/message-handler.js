const fs = require('fs');
const async = require('async');
const { 
    getSystemPrompt, 
    botNumber, 
    MAX_STORED_BOT_MESSAGE_IDS 
} = require('../config/config');
const conversation = require('./conversation');
const openai = require('../services/openai');
const utils = require('../utils/utils');
const Sanitizer = require('../utils/sanitizer');
const { trackEvent } = require('../utils/eventTracker');
const healthMonitor = require('../utils/healthMonitor');

const botMessageIds = new Set();

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
        trackEvent('error', error);
        throw error;
    }
};

const handleMessageUpsert = async (socket, { messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
        try {
            // Atualiza o heartbeat ao processar mensagem
            healthMonitor.updateHeartbeat();
            
            // Ignora mensagens do próprio bot
            if (msg.key.fromMe || botMessageIds.has(msg.key.id)) continue;

            const chatId = msg.key.remoteJid;
            const text = msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption || '';

            if (!text) continue;

            const isGroup = chatId.endsWith('@g.us');
            const sender = msg.key.participant || msg.key.remoteJid;

            // Registra a mensagem recebida
            trackEvent('message', { chatId, isGroup });

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
            trackEvent('error', error);
            logErrorDetails(error);
        }
    }
};

const messageQueue = async.queue(async (task, callback) => {
    try {
        await processMessage(task.socket, task.data);
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        trackEvent('error', error);
    } finally {
        callback();
    }
}, 1);

/**
 * Sanitiza os inputs da mensagem
 */
const sanitizeInputs = (chatId, text, sender) => ({
    contextId: Sanitizer.sanitizeWhatsAppId(chatId),
    sanitizedText: Sanitizer.sanitizeMessage(text),
    sanitizedSender: Sanitizer.sanitizeWhatsAppId(sender)
});

/**
 * Verifica se a mensagem em grupo é válida
 */
const isGroupMessageValid = (msg, sanitizedText, isGroup) => {
    if (!isGroup) return true;

    const isMentioned = utils.isBotMentioned(sanitizedText);
    const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant === botNumber ||
                         botMessageIds.has(msg.message?.extendedTextMessage?.contextInfo?.stanzaId);

    return isMentioned || isReplyToBot;
};

/**
 * Processa uma mensagem da fila
 */
const processMessage = async (socket, { msg, text, chatId, isGroup, sender }) => {
    const startTime = Date.now();
    try {
        // Sanitiza os inputs
        const { contextId, sanitizedText, sanitizedSender } = sanitizeInputs(chatId, text, sender);
        if (!contextId || !sanitizedText) {
            console.warn('Input inválido detectado');
            return;
        }

        // Valida mensagens de grupo
        if (!isGroupMessageValid(msg, sanitizedText, isGroup)) return;

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
        
        // Rastreia o tempo de resposta
        const responseTime = Date.now() - startTime;
        trackEvent('response', { time: responseTime, chatId });
    } catch (error) {
        console.error('Erro:', error);
        trackEvent('error', error);
        await sendBotMessage(
            socket, 
            chatId, 
            "Desculpe, não consegui processar sua mensagem no momento. Por favor, tente novamente em alguns instantes."
        );
    }
};

module.exports = {
    messageQueue,
    sendBotMessage,
    processMessage,
    handleMessageUpsert
};
