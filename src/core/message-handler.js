const fs = require('fs');
const path = require('path');
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

// Registra detalhes do erro para debug
const logErrorDetails = (error) => {
    const errorDetails = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    };

    console.error('Detalhes do erro:', JSON.stringify(errorDetails, null, 2));

    // Salva em arquivo de log
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, 'error.log');
    fs.appendFile(logFile, JSON.stringify(errorDetails) + '\n', (err) => {
        if (err) console.error('Erro ao salvar log:', err);
    });
};

const sendBotMessage = async (socket, chatId, text) => {
    try {
        // Tenta mostrar indicador de digitação (se suportado pela API)
        try {
            if (socket.sendPresenceUpdate) {
                await socket.sendPresenceUpdate('composing', chatId);
            }
        } catch (err) {
            // Ignora erro se o método não estiver disponível
            console.log('Indicador de digitação não suportado');
        }

        // Pequeno delay para simular digitação natural
        const typingDelay = Math.min(text.length * 10, 2000);
        await new Promise(resolve => setTimeout(resolve, typingDelay));

        // Envia a mensagem
        const sentMsg = await socket.sendMessage(chatId, { text });

        // Nota: Funcionalidade de marcar como lida removida pois não é suportada pela API atual

        // Gerencia cache de IDs de mensagens do bot
        if (sentMsg?.key?.id) {
            botMessageIds.add(sentMsg.key.id);
            if (botMessageIds.size > MAX_STORED_BOT_MESSAGE_IDS) {
                const oldestId = botMessageIds.values().next().value;
                botMessageIds.delete(oldestId);
            }
        }

        // Tenta voltar ao estado disponível (se suportado pela API)
        try {
            if (socket.sendPresenceUpdate) {
                await socket.sendPresenceUpdate('available', chatId);
            }
        } catch (err) {
            // Ignora erro se o método não estiver disponível
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
            // Atualiza status de saúde do sistema
            healthMonitor.updateHeartbeat();

            // Pula mensagens enviadas pelo próprio bot
            if (msg.key.fromMe || botMessageIds.has(msg.key.id)) continue;

            const chatId = msg.key.remoteJid;
            const isGroup = chatId.endsWith('@g.us');
            const sender = msg.key.participant || msg.key.remoteJid;

            // Registra a mensagem recebida
            trackEvent('message', { chatId, isGroup });

            // Prepara dados para processamento
            let messageData = {
                socket,
                data: {
                    msg,
                    chatId,
                    isGroup,
                    sender
                }
            };

            // Identifica o tipo de mensagem e extrai dados relevantes
            if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
                // Texto simples ou com formatação
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                messageData.data.text = text;
                messageData.data.type = 'text';
            }
            else if (msg.message?.imageMessage) {
                // Imagem (com ou sem legenda)
                messageData.data.type = 'image';
                messageData.data.imageUrl = msg.message.imageMessage.url;
                messageData.data.caption = msg.message.imageMessage.caption || '';
            }
            else if (msg.message?.audioMessage) {
                // Áudio/mensagem de voz
                messageData.data.type = 'audio';
                messageData.data.audioUrl = msg.message.audioMessage.url;
            }
            else {
                // Pula tipos não suportados (vídeo, documentos, etc)
                continue;
            }

            // Adiciona à fila de processamento
            messageQueue.push(messageData);

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

// Limpa e valida os dados da mensagem
const sanitizeInputs = (chatId, text, sender) => ({
    contextId: Sanitizer.sanitizeWhatsAppId(chatId),
    sanitizedText: Sanitizer.sanitizeMessage(text || ''),
    sanitizedSender: Sanitizer.sanitizeWhatsAppId(sender)
});

// Verifica se o bot deve responder a uma mensagem de grupo
const isGroupMessageValid = (msg, sanitizedText, isGroup) => {
    if (!isGroup) return true;

    const isMentioned = utils.isBotMentioned(sanitizedText);
    const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant === botNumber ||
                         botMessageIds.has(msg.message?.extendedTextMessage?.contextInfo?.stanzaId);

    return isMentioned || isReplyToBot;
};

// Processa mensagens da fila e gera respostas
const processMessage = async (socket, { msg, text, chatId, isGroup, sender, type, caption }) => {
    const startTime = Date.now();
    try {
        // Limpa e valida os dados recebidos
        const { contextId, sanitizedText, sanitizedSender } = sanitizeInputs(chatId, text, sender);
        if (!contextId) {
            console.warn('Dados inválidos na mensagem');
            return;
        }

        // Em grupos, só responde quando mencionado ou em resposta direta
        if (type === 'text' && !isGroupMessageValid(msg, sanitizedText, isGroup)) return;

        // Processa comandos especiais (como limpar histórico)
        if (type === 'text') {
            const isCommand = await utils.handleCommand(
                sanitizedText,
                chatId,
                contextId,
                conversation.clearUserHistory,
                (chatId, text) => sendBotMessage(socket, chatId, text)
            );
            if (isCommand) return; // Encerra se foi um comando válido
        }

        // Prepara variáveis para processamento
        let userMessage = '';
        let responseText = '';

        if (type === 'text') {
            // Formata mensagem de texto (com identificação do remetente em grupos)
            userMessage = isGroup ? `[${sanitizedSender.split('@')[0]}]: ${sanitizedText}` : sanitizedText;
            conversation.addMessage(contextId, 'user', userMessage);

            // Obtém histórico e gera resposta
            const userConversation = await conversation.getUserConversation(contextId);
            const messagesForAPI = [getSystemPrompt(isGroup), ...userConversation];

            responseText = await openai.getResponse(messagesForAPI);
        }
        else if (type === 'image') {
            // Formata mensagem para imagem recebida
            userMessage = isGroup
                ? `[${sanitizedSender.split('@')[0]}]: [Enviou uma imagem${caption ? ` com legenda: "${caption}"` : ''}]`
                : `[Enviou uma imagem${caption ? ` com legenda: "${caption}"` : ''}]`;

            conversation.addMessage(contextId, 'user', userMessage);

            // Obtém histórico e gera resposta
            const userConversation = await conversation.getUserConversation(contextId);
            const messagesForAPI = [getSystemPrompt(isGroup), ...userConversation];

            responseText = await openai.getResponse(messagesForAPI);
        }
        else if (type === 'audio') {
            // Formata mensagem para áudio recebido
            userMessage = isGroup
                ? `[${sanitizedSender.split('@')[0]}]: [Enviou um áudio]`
                : `[Enviou um áudio]`;

            conversation.addMessage(contextId, 'user', userMessage);

            // Obtém histórico e gera resposta
            const userConversation = await conversation.getUserConversation(contextId);
            const messagesForAPI = [getSystemPrompt(isGroup), ...userConversation];

            responseText = await openai.getResponse(messagesForAPI);
        }

        // Salva a resposta no histórico e envia para o usuário
        conversation.addMessage(contextId, 'assistant', responseText);
        await sendBotMessage(socket, chatId, responseText);

        // Registra métricas de desempenho
        const responseTime = Date.now() - startTime;
        trackEvent('response', { time: responseTime, chatId, type });
    } catch (error) {
        console.error('Erro:', error);
        trackEvent('error', error);
        logErrorDetails(error);

        // Mensagem de erro mais amigável e informativa
        await sendBotMessage(
            socket,
            chatId,
            "Ops! Estou com dificuldades para processar sua mensagem agora. É algo temporário, pode tentar novamente daqui a pouco? Se o problema persistir, tente enviar de outra forma."
        );
    }
};

module.exports = {
    messageQueue,
    sendBotMessage,
    processMessage,
    handleMessageUpsert
};
