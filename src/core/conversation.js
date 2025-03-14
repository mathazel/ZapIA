const fs = require('fs');
const path = require('path');
const AsyncLock = require('async-lock');
const { 
    conversationHistoryFile, 
    MAX_HISTORY_MESSAGES,
    HISTORY_CLEANUP_INTERVAL
} = require('../config/config');

// Garantir que o diretório existe
const ensureDirectoryExists = (filepath) => {
    const dir = path.dirname(filepath);
    if (dir && dir !== '' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};
ensureDirectoryExists(conversationHistoryFile);

// Sistema de gerenciamento de conversas
const conversationManager = {
    history: {},
    saveCounter: 0,
    lock: new AsyncLock({ timeout: 5000 }),
    hasChanges: false,

    // Salvar histórico de conversas
    saveHistory: async function(force = false) {
        this.saveCounter++;
        
        if (!force && this.saveCounter < 5) return;
        if (!force && !this.hasChanges) return;
        
        this.saveCounter = 0;
        
        try {
            await this.lock.acquire('saveHistory', async () => {
                ensureDirectoryExists(conversationHistoryFile);
                const tempFile = `${conversationHistoryFile}.tmp`;
                await fs.promises.writeFile(tempFile, JSON.stringify(this.history, null, 2), 'utf8');
                await fs.promises.rename(tempFile, conversationHistoryFile);
                this.hasChanges = false;
            });
        } catch (error) {
            console.error('Erro ao salvar histórico de conversas:', error);
            if (error.name === 'TimeoutError') {
                console.error('Timeout ao tentar obter lock para salvamento');
            }
        }
    },
    
    // Carregar histórico de conversas
    loadHistory: async function() {
        if (fs.existsSync(conversationHistoryFile)) {
            try {
                await this.lock.acquire('loadHistory', async () => {
                    const data = await fs.promises.readFile(conversationHistoryFile, 'utf8');
                    this.history = JSON.parse(data);
                });
                console.log(`Histórico de conversas carregado para ${Object.keys(this.history).length} usuários`);
            } catch (error) {
                console.error('Erro ao carregar histórico de conversas:', error);
                this.history = {};
            }
        }
    },
    
    // Adicionar mensagem ao histórico
    addMessage: async function(userId, role, content) {
        await this.lock.acquire('modifyHistory', () => {
            if (!this.history[userId]) {
                this.history[userId] = [];
            }
            
            const userHistory = this.history[userId];
            userHistory.push({ role, content, timestamp: Date.now() });
            
            if (userHistory.length > MAX_HISTORY_MESSAGES) {
                this.history[userId] = userHistory.slice(-MAX_HISTORY_MESSAGES);
            }
            
            this.hasChanges = true;
        });
        
        await this.saveHistory();
    },
    
    // Obter histórico formatado para a API
    getUserConversation: async function(userId) {
        return await this.lock.acquire('readHistory', () => {
            const userHistory = this.history[userId] || [];
            return userHistory.map(msg => ({ role: msg.role, content: msg.content }));
        });
    },
    
    // Limpar histórico de um usuário
    clearUserHistory: async function(userId) {
        await this.lock.acquire('modifyHistory', () => {
            delete this.history[userId];
            this.hasChanges = true;
        });
        await this.saveHistory(true);
    },
    
    // Limpeza de históricos antigos
    cleanupOldHistories: async function() {
        const now = Date.now(); 
        let cleanedCount = 0;
        
        await this.lock.acquire('cleanupHistory', async () => {
            Object.keys(this.history).forEach(userId => {
                const messages = this.history[userId];
                if (messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    if (now - lastMessage.timestamp > ONE_DAY) {
                        console.log(`Limpando histórico antigo para: ${userId}`);
                        delete this.history[userId];
                        cleanedCount++;
                    }
                }
            });
        });
        
        if (cleanedCount > 0) {
            console.log(`Limpeza concluída: ${cleanedCount} históricos removidos`);
            await this.saveHistory(true);
        }
    }
};

const schedulePeriodicTask = (task, interval, taskName) => {
    let isRunning = false;

    return setInterval(async () => {
        if (isRunning) {
            console.log(`Tarefa '${taskName}' ainda em execução, pulando...`);
            return;
        }

        isRunning = true;
        try {
            await task();
        } catch (error) {
            console.error(`Erro na tarefa '${taskName}':`, error);
        } finally {
            isRunning = false;
        }
    }, interval);
};

const scheduleCleanup = () => {
    const tasks = [
        {
            name: 'limpeza de históricos antigos',
            fn: () => conversationManager.cleanupOldHistories(),
            interval: HISTORY_CLEANUP_INTERVAL
        }
    ];

    const intervals = tasks.map(task => 
        schedulePeriodicTask(task.fn, task.interval, task.name)
    );

    process.on('SIGTERM', () => {
        intervals.forEach(clearInterval);
        process.exit(0);
    });
};

module.exports = {
    addMessage: conversationManager.addMessage.bind(conversationManager),
    getUserConversation: conversationManager.getUserConversation.bind(conversationManager),
    clearUserHistory: conversationManager.clearUserHistory.bind(conversationManager),
    loadHistory: conversationManager.loadHistory.bind(conversationManager),
    scheduleCleanup
};
