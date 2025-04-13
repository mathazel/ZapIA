const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const {
    authPath,
    MAX_RECONNECT_ATTEMPTS,
    botName
} = require('../config/config');
const { handleMessageUpsert } = require('../core/message-handler');
const { Crypto } = require('@peculiar/webcrypto');
global.crypto = new Crypto();

let currentSocket = null;
let reconnectAttempts = 0;
let isReconnecting = false;

/**
 * Estabelece conexão com a API do WhatsApp
 * @returns {Promise<Object>} Socket da conexão ativa
 */
const connect = async () => {
    try {
        if (currentSocket) {
            console.log('Encerrando conexão anterior...');
            await currentSocket.end();
            currentSocket.ev.removeAllListeners();
            currentSocket = null;
        }

        console.log('Iniciando conexão com WhatsApp...');
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        currentSocket = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            browser: Browsers.ubuntu('Chrome'),
            connectTimeoutMs: 60_000, // 60 segundos
            qrTimeout: 40_000, // 40 segundos
            defaultQueryTimeoutMs: 60_000, // 60 segundos
            emitOwnEvents: true,
            markOnlineOnConnect: true,
            syncFullHistory: false
        });

        // Registra handlers de eventos
        currentSocket.ev.on('connection.update', (update) => handleConnectionUpdate(update, currentSocket));
        currentSocket.ev.on('creds.update', saveCreds);
        currentSocket.ev.on('messages.upsert', (data) => handleMessageUpsert(currentSocket, data));

        // Log de eventos para debug
        currentSocket.ev.on('messaging-history.set', () => {
            console.log('Histórico de mensagens sincronizado');
        });

        currentSocket.ev.on('chats.set', () => {
            console.log('Lista de chats sincronizada');
        });

        currentSocket.ev.on('contacts.set', () => {
            console.log('Lista de contatos sincronizada');
        });

        console.log(`Bot WhatsApp conectado como "${botName}"`);
        return currentSocket;
    } catch (error) {
        console.error('Erro crítico ao conectar:', error);
        if (error.message.includes('closed') || error.message.includes('timeout')) {
            console.log('Tentando reconectar após erro de conexão...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connect();
        }
        process.exit(1);
    }
};

/**
 * Gerencia eventos de conexão e reconexão
 * @param {Object} param0 Objeto com dados da conexão
 * @param {Object} socket Socket ativo
 */
const handleConnectionUpdate = ({ connection, qr, lastDisconnect }, socket) => {
    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                              statusCode !== DisconnectReason.connectionReplaced &&
                              reconnectAttempts < MAX_RECONNECT_ATTEMPTS;

        console.log('Conexão fechada. Código:', DisconnectReason[statusCode]);
        console.log('Tentativas de reconexão:', reconnectAttempts);
        console.log('Deve reconectar?', shouldReconnect);

        if (shouldReconnect) {
            reconnectWithBackoff();
        } else {
            console.error('Não é possível reconectar. Encerrando...');
            process.exit(1);
        }
    } else if (connection === 'open') {
        console.log('Conexão estabelecida com sucesso!');
        reconnectAttempts = 0;
        isReconnecting = false;
    } else if (qr) {
        console.log('Novo QR Code gerado:');
        qrcode.generate(qr, { small: true });
    }
};

/**
 * Implementa reconexão com backoff exponencial
 */
const reconnectWithBackoff = () => {
    if (isReconnecting) {
        console.log('Já existe uma tentativa de reconexão em andamento...');
        return;
    }

    isReconnecting = true;
    reconnectAttempts++;

    const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 30000);
    console.log(`Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} em ${delay}ms`);

    setTimeout(async () => {
        try {
            await connect();
        } catch (error) {
            console.error('Erro na tentativa de reconexão:', error);
            isReconnecting = false;

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectWithBackoff();
            } else {
                console.error('Número máximo de tentativas atingido. Encerrando...');
                process.exit(1);
            }
        }
    }, delay);
};

module.exports = {
    connect,
    getSocket: () => currentSocket
};
