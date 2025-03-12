const { botName } = require('../config/config');

// Função para verificar se é um chat de grupo
const isGroupChat = (jid) => jid.endsWith('@g.us');

// Função para verificar se o bot foi mencionado
const isBotMentioned = (text) => new RegExp(`\\b${botName}\\b`, 'i').test(text);

// Função para extrair a mensagem sem a menção ao bot
const extractMessageWithoutMention = (text) => text.replace(new RegExp(`\\b${botName}\\b`, 'ig'), '').trim();

// Função para tratar comandos
const handleCommand = async (text, chatId, contextId, clearHistory, sendMessage) => {
    const lowerText = text.toLowerCase();
    const commandActions = {
        '/limpar': async () => {
            clearHistory(contextId);
            await sendMessage(chatId, 'Histórico limpo. Nova conversa iniciada.');
        },
        '/ajuda': async () => {
            const helpMessage = `
                Comandos:
                /limpar - Limpa histórico
                /ajuda - Exibe esta mensagem de ajuda
            `;
            await sendMessage(chatId, helpMessage);
        }
    };

    // Verifica se o comando existe e executa
    if (commandActions[lowerText]) {
        await commandActions[lowerText]();
        return true;
    }

    return false;
};

module.exports = { isGroupChat, isBotMentioned, extractMessageWithoutMention, handleCommand };
