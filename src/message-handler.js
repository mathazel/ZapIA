const fs = require('fs');
const async = require('async');
const axios = require('axios');
const { processedMessagesFile, getSystemPrompt, botNumber, MAX_STORED_BOT_MESSAGE_IDS } = require('./config');
const conversation = require('./conversation');
const openai = require('./openai');
const utils = require('./utils');

const botMessageIds = new Set();
let processedMessages = new Set(); // Cache de mensagens processadas

// Carregar mensagens processadas uma única vez
try {
    const storedMessages = fs.readFileSync(processedMessagesFile, 'utf8');
    processedMessages = new Set(JSON.parse(storedMessages));
} catch (error) {
    console.error('Erro ao carregar mensagens processadas:', error);
}

// Função para formatar o nome da cidade
function formatCityName(city) {
    // Remove acentos
    city = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Remove caracteres especiais, mantendo apenas letras, números e espaços
    city = city.replace(/[^a-zA-Z0-9\s]/g, '');
    
    // Se contiver "sp", "rj", etc, adiciona vírgula e "BR"
    const estados = ['sp', 'rj', 'mg', 'rs', 'pr', 'sc', 'ba', 'ce', 'pe', 'pa'];
    for (const estado of estados) {
        if (city.toLowerCase().includes(estado)) {
            city = city.replace(new RegExp(`\\s*[-,]?\\s*${estado}\\b`, 'i'), '');
            return `${city},BR`;
        }
    }
    
    // Se não tiver estado especificado, assume que é do Brasil
    return `${city},BR`;
}

// Função para extrair cidade da mensagem
function extractCityFromMessage(text) {
    const patterns = [
        /clima\s+(?:em|de|para)\s+(.+?)(?:\s*$|\s+[,-])/i,
        /(?:como|qual)\s+(?:está|é)\s+o\s+clima\s+(?:em|de)\s+(.+?)(?:\s*$|\s+[,-])/i,
        /tempo\s+(?:em|de|para)\s+(.+?)(?:\s*$|\s+[,-])/i,
        /previsão\s+(?:em|de|para)\s+(.+?)(?:\s*$|\s+[,-])/i,
        /ei,\s+me\s+fale\s+o\s+clima\s+em\s+(.+?)(?:\s*$|\s+[,-])/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    return null;
}

// Função para obter dados do clima
async function getWeather(city) {
    try {
        const formattedCity = formatCityName(city);
        console.log('Buscando clima para cidade formatada:', formattedCity);
        
        const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather`, {
            params: {
                q: formattedCity,
                appid: process.env.OPENWEATHER_API_KEY,
                units: 'metric',
                lang: 'pt_br'
            }
        });

        const weather = response.data;
        return `Clima em ${weather.name}:
        🌡️ Temperatura: ${Math.round(weather.main.temp)}°C
        💧 Umidade: ${weather.main.humidity}%
        🌤️ Condição: ${weather.weather[0].description}
        🌪️ Vento: ${Math.round(weather.wind.speed * 3.6)} km/h`;
    } catch (error) {
        console.error('Erro ao buscar clima:', error);
        
        // Se a primeira tentativa falhar, tenta sem o ,BR
        if (error.response?.status === 404 && city.includes(',BR')) {
            try {
                const cityWithoutCountry = city.replace(',BR', '');
                const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather`, {
                    params: {
                        q: cityWithoutCountry,
                        appid: process.env.OPENWEATHER_API_KEY,
                        units: 'metric',
                        lang: 'pt_br'
                    }
                });

                const weather = response.data;
                return `
            Clima em ${weather.name}:
            🌡️ Temperatura: ${Math.round(weather.main.temp)}°C
            💧 Umidade: ${weather.main.humidity}%
            🌤️ Condição: ${weather.weather[0].description}
            🌪️ Vento: ${Math.round(weather.wind.speed * 3.6)} km/h`;
            } catch (retryError) {
                console.error('Erro na segunda tentativa:', retryError);
            }
        }
        
        if (error.response?.status === 404) {
            return `Desculpe, não encontrei dados para a cidade "${city}". Tente especificar o estado, exemplo: "São Paulo, SP"`;
        }
        return `Desculpe, houve um erro ao buscar o clima. Tente novamente mais tarde.`;
    }
}

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

// Fila de mensagens para processar uma mensagem por vez
const messageQueue = async.queue(async (task, callback) => {
    try {
        await processMessage(task.socket, task.data);
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    } finally {
        callback();
    }
}, 1); // Concorrência limitada a 1 (uma mensagem por vez)

/**
 * Processa uma mensagem da fila
 */
const processMessage = async (socket, { msg, text, chatId, isGroup, sender }) => {
    try {
        const contextId = chatId;
        
        // Verifica se é um comando
        const isCommand = await utils.handleCommand(
            text, 
            chatId, 
            contextId, 
            conversation.clearUserHistory, 
            (chatId, text) => sendBotMessage(socket, chatId, text)
        );
        if (isCommand) return;

        // Verifica se é uma pergunta sobre clima
        const city = extractCityFromMessage(text);
        if (city) {
            console.log(`Buscando clima para cidade: ${city}`);
            const weatherInfo = await getWeather(city);
            await sendBotMessage(socket, chatId, weatherInfo);
            return;
        }

        // Se não for sobre clima, continua com o processamento normal
        const userMessage = isGroup ? `[${sender.split('@')[0]}]: ${text}` : text;
        conversation.addMessage(contextId, 'user', userMessage);

        const messagesForAPI = [getSystemPrompt(isGroup), ...conversation.getUserConversation(contextId)];
        const responseText = await openai.getResponse(messagesForAPI);

        conversation.addMessage(contextId, 'assistant', responseText);
        await sendBotMessage(socket, chatId, responseText);
    } catch (error) {
        console.error('Erro:', error);
        await sendBotMessage(socket, chatId, `Houve um erro ao processar sua mensagem. Por favor, tente novamente em instantes. Erro: ${error.message}`);
        logErrorDetails(error);
    }
};

/**
 * Trata a chegada de novas mensagens e as adiciona à fila
 */
const handleMessageUpsert = async (socket, data) => {
    const { messages } = data;
    const msg = messages[0];
    
    // Ignora mensagens inválidas ou enviadas pelo próprio bot
    if (!msg?.message || msg.key.remoteJid === botNumber) return;

    const messageId = msg.key.id;
    const isReplyToBot = msg.message.extendedTextMessage?.contextInfo?.stanzaId 
        && botMessageIds.has(msg.message.extendedTextMessage.contextInfo.stanzaId);

    // Ignora mensagens já enviadas pelo bot
    if (botMessageIds.has(messageId)) return;

    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.imageMessage?.caption || "";

    const chatId = msg.key.remoteJid;
    const isGroup = utils.isGroupChat(chatId);
    const sender = msg.key.participant || chatId;

    // Verifica se a mensagem já foi processada
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);

    // Atualiza a lista de mensagens processadas periodicamente
    if (processedMessages.size % 100 === 0) {
        fs.writeFileSync(processedMessagesFile, JSON.stringify([...processedMessages]), 'utf8');
    }

    let shouldRespond = false;
    let processedText = text;

    // Decide se o bot deve responder
    if (!isGroup) {
        shouldRespond = true; // Responde sempre em chats diretos
    } else {
        shouldRespond = utils.isBotMentioned(text) || isReplyToBot;
        if (utils.isBotMentioned(text)) {
            processedText = utils.extractMessageWithoutMention(text);
            console.log(`Mencionado em ${chatId}: ${processedText}`);
        }
        if (isReplyToBot) console.log(`Reply detectado em ${chatId}`);
    }

    // Se deve responder, adiciona a mensagem à fila
    if (shouldRespond && processedText) {
        messageQueue.push({ socket, data: { msg, text: processedText, chatId, isGroup, sender } });
    }
};

module.exports = { handleMessageUpsert, sendBotMessage };
