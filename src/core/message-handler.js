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
        throw error;
    }
};

const handleMessageUpsert = async (socket, { messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
        try {
            // Ignora mensagens do próprio bot
            if (msg.key.fromMe || botMessageIds.has(msg.key.id)) continue;

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
        let sanitizedText = Sanitizer.sanitizeMessage(text);
        const sanitizedSender = Sanitizer.sanitizeWhatsAppId(sender);   
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
        // Mensagem de erro para o usuário
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
