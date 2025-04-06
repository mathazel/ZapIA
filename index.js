const whatsapp = require('./src/services/whatsapp');
const conversation = require('./src/core/conversation');
const fileManager = require('./src/utils/fileManager');
const { conversationHistoryFile } = require('./src/config/config');
const fs = require('fs');
const path = require('path');

// Sistema de monitoramento
const statsFile = path.join(__dirname, 'data', 'stats.json');
const stats = {
    startTime: Date.now(),
    messageCount: 0,
    errorCount: 0,
    lastError: null,
    responseTime: {
        avg: 0,
        total: 0,
        samples: 0
    }
};

// Registra estatísticas periodicamente
const saveStats = async () => {
    try {
        await fs.promises.writeFile(statsFile, JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Erro ao salvar estatísticas:', error);
    }
};

// Exporta função para registrar eventos
const trackEvent = (eventType, data) => {
    switch (eventType) {
        case 'message':
            stats.messageCount++;
            break;
        case 'error':
            stats.errorCount++;
            stats.lastError = {
                time: Date.now(),
                message: data.message,
                stack: data.stack
            };
            break;
        case 'response':
            stats.responseTime.total += data.time;
            stats.responseTime.samples++;
            stats.responseTime.avg = stats.responseTime.total / stats.responseTime.samples;
            break;
    }
    
    // Salva estatísticas a cada 10 eventos
    if ((stats.messageCount + stats.errorCount) % 10 === 0) {
        saveStats();
    }
};

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
        
        // Conectar ao WhatsApp
        await whatsapp.connect();
        console.log('Bot iniciado com sucesso');
        
        // Inicia salvamento periódico de estatísticas
        setInterval(saveStats, 5 * 60 * 1000); // A cada 5 minutos
    } catch (error) {
        console.error('Falha na inicialização:', error);
        trackEvent('error', error);
        process.exit(1);
    }
})();

// Exporta função de rastreamento para outros módulos
module.exports = {
    trackEvent
};
