const fs = require('fs');
const path = require('path');

// Sistema de monitoramento
const statsFile = path.join(__dirname, '../../data', 'stats.json');
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

// Função para registrar eventos
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

module.exports = {
    trackEvent,
    saveStats
}; 