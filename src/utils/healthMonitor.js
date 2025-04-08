const { trackEvent } = require('./eventTracker');

class HealthMonitor {
    constructor() {
        this.lastHeartbeat = Date.now();
        this.isHealthy = true;
        this.checkInterval = 5 * 60 * 1000; // 5 minutos
        this.maxInactivity = 15 * 60 * 1000; // 15 minutos
    }

    start() {
        // Inicia o monitoramento periódico
        setInterval(() => this.checkHealth(), this.checkInterval);
        
        // Monitora eventos do processo
        process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
        process.on('SIGINT', () => this.handleShutdown('SIGINT'));
        
        // Monitora uso de memória
        setInterval(() => this.checkMemoryUsage(), 10 * 60 * 1000); // 10 minutos
    }

    updateHeartbeat() {
        this.lastHeartbeat = Date.now();
        this.isHealthy = true;
    }

    checkHealth() {
        const now = Date.now();
        const timeSinceLastHeartbeat = now - this.lastHeartbeat;

        if (timeSinceLastHeartbeat > this.maxInactivity) {
            this.isHealthy = false;
            trackEvent('error', {
                message: 'Aplicação inativa por muito tempo',
                timeInactive: timeSinceLastHeartbeat
            });
            
            // Tenta recuperar a aplicação
            this.recover();
        }
    }

    checkMemoryUsage() {
        const used = process.memoryUsage();
        const memoryUsage = {
            heapUsed: Math.round(used.heapUsed / 1024 / 1024),
            heapTotal: Math.round(used.heapTotal / 1024 / 1024),
            external: Math.round(used.external / 1024 / 1024)
        };

        // Alerta se o uso de memória estiver muito alto
        if (memoryUsage.heapUsed > 1024) { // Mais de 1GB
            trackEvent('error', {
                message: 'Uso de memória alto detectado',
                memoryUsage
            });
            
            // Força coleta de lixo
            if (global.gc) {
                global.gc();
            }
        }
    }

    async recover() {
        try {
            // Tenta reconectar ao WhatsApp
            const whatsapp = require('../services/whatsapp');
            await whatsapp.connect();
            
            // Atualiza o heartbeat após recuperação bem-sucedida
            this.updateHeartbeat();
            
            trackEvent('message', {
                type: 'recovery',
                message: 'Aplicação recuperada com sucesso'
            });
        } catch (error) {
            trackEvent('error', {
                message: 'Falha na recuperação da aplicação',
                error: error.message
            });
            
            // Se não conseguir recuperar, reinicia o processo
            process.exit(1);
        }
    }

    handleShutdown(signal) {
        trackEvent('message', {
            type: 'shutdown',
            message: `Recebido sinal ${signal}, encerrando aplicação...`
        });
        
        // Limpa recursos e encerra
        process.exit(0);
    }
}

module.exports = new HealthMonitor(); 