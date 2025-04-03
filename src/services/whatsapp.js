const { 
    makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason 
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
 * Conecta ao WhatsApp
 * @returns {Promise<Object>} - Socket conectado
 */
const connect = async () => {
    try {
        if (currentSocket) {
            await currentSocket.end();
            currentSocket.ev.removeAllListeners();
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        currentSocket = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            browser: ['Bot GPT', 'Chrome', '1.0.0'],
            connectTimeoutMs: 30_000 // Timeout de 30 segundos
        });

        currentSocket.ev.on('connection.update', handleConnectionUpdate);
        currentSocket.ev.on('creds.update', saveCreds);
        currentSocket.ev.on('messages.upsert', (data) => handleMessageUpsert(currentSocket, data));

        console.log(`Bot WhatsApp conectado como "${botName}"`);
        return currentSocket;
    } catch (error) {
        console.error('Erro crítico ao conectar:', error);
        process.exit(1);
    }
};

/**
 * Lida com a atualização de conexão, incluindo reconexões.
 */
const handleConnectionUpdate = ({ connection, qr, lastDisconnect }) => {
    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log('Código de desconexão:', DisconnectReason[statusCode]);

        if (statusCode === DisconnectReason.connectionReplaced) {
            console.log('Conexão substituída. O bot será encerrado.');
            process.exit(0);
        }

        if (statusCode !== DisconnectReason.loggedOut && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectWithBackoff();
        } else {
            console.error('Número máximo de tentativas de reconexão atingido ou usuário desconectado.');
            process.exit(1);
        }
    } else if (connection === 'open') {
        console.log('Conexão restabelecida com sucesso!');
        reconnectAttempts = 0; // Redefine o contador de tentativas
    } else if (qr) {
        qrcode.generate(qr, { small: true });
    }
};

/**
 * Tenta reconectar com um backoff exponencial.
 */
const reconnectWithBackoff = () => {
    if (isReconnecting) return; // Evita múltiplas tentativas simultâneas
    isReconnecting = true;

    const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000);
    console.log(`Tentativa ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS} em ${delay}ms`);

    setTimeout(async () => {
        await connect();
        isReconnecting = false; // Libera para novas tentativas após reconexão
    }, delay);

    reconnectAttempts++;
};

module.exports = {
    connect,
    getSocket: () => currentSocket
};
