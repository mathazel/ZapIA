const whatsapp = require('./src/services/whatsapp');
const conversation = require('./src/core/conversation');
const fileManager = require('./src/utils/fileManager');
const { processedMessagesFile } = require('./src/config/config');

// Inicialização
(async () => {
    try {
        // Inicializa estruturas necessárias
        await fileManager.ensureFileAndDirectoryExists(
            processedMessagesFile, 
            []
        );
        
        // Carregar histórico de conversas
        await conversation.loadHistory();
        
        // Iniciar limpeza periódica e backup
        conversation.scheduleCleanup();
        
        // Conectar ao WhatsApp
        await whatsapp.connect();
        console.log('Bot iniciado com sucesso');
    } catch (error) {
        console.error('Falha na inicialização:', error);
        process.exit(1);
    }
})();
