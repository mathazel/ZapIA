const whatsapp = require('./src/services/whatsapp');
const conversation = require('./src/core/conversation');
const fileManager = require('./src/utils/fileManager');
const { conversationHistoryFile } = require('./src/config/config');
const { trackEvent, saveStats } = require('./src/utils/eventTracker');
const healthMonitor = require('./src/utils/healthMonitor');
const fs = require('fs');
const path = require('path');

// Captura erros não tratados
process.on('uncaughtException', (error) => {
    console.error('Erro não tratado:', error);
    trackEvent('error', error);
    saveStats(); // Salva imediatamente em caso de erro crítico
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada:', reason);
    trackEvent('error', { message: String(reason), stack: reason?.stack });
    saveStats(); // Salva imediatamente em caso de erro crítico
});

// Inicialização
(async () => {
    try {
        // Cria diretório de dados se não existir
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Inicializa estruturas necessárias
        await fileManager.ensureFileAndDirectoryExists(
            conversationHistoryFile, 
            []
        );
        
        // Carregar histórico de conversas
        await conversation.loadHistory();
        
        // Iniciar limpeza periódica
        fileManager.scheduleCleanup();
        
        // Inicia o monitor de saúde
        healthMonitor.start();
        
        // Conectar ao WhatsApp
        await whatsapp.connect();
        console.log('Bot iniciado com sucesso');
        
        // Inicia salvamento periódico de estatísticas
        setInterval(saveStats, 5 * 60 * 1000); // A cada 5 minutos
        
        // Atualiza o heartbeat a cada minuto
        setInterval(() => healthMonitor.updateHeartbeat(), 60 * 1000);
    } catch (error) {
        console.error('Falha na inicialização:', error);
        trackEvent('error', error);
        process.exit(1);
    }
})();
