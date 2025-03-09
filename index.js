const whatsapp = require('./src/whatsapp');
const conversation = require('./src/conversation');
const fs = require('fs');
const path = require('path');
const { processedMessagesFile } = require('./src/config');
// Inicialização
(async () => {
    try {
        // Verificar se o arquivo de mensagens processadas existe, senão criar
        if (!fs.existsSync(processedMessagesFile)) {
            fs.writeFileSync(processedMessagesFile, JSON.stringify([]), 'utf8');
        }
        
        // Carregar histórico de conversas
        conversation.loadHistory();
        
        // Iniciar limpeza periódica
        conversation.scheduleCleanup();
        
        // Conectar ao WhatsApp
        await whatsapp.connect();
        console.log(`Bot iniciado - respostas sem marcadores`);
    } catch (error) {
        console.error('Falha na inicialização:', error);
        process.exit(1);
    }
})();