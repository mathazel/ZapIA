const fs = require('fs');
const path = require('path');
const conversationSummarizer = require('./services/conversationSummarizer');
const { 
    conversationHistoryFile, 
    MAX_HISTORY_MESSAGES,
    HISTORY_CLEANUP_INTERVAL
} = require('./config');

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
    history: {}, // Usando um objeto ao invés de Map
    saveCounter: 0,

    // Salvar histórico de conversas
    saveHistory: function(force = false) {
        this.saveCounter++;
        
        if (!force && this.saveCounter < 5) return;
        
        this.saveCounter = 0;
        
        try {
            ensureDirectoryExists(conversationHistoryFile);
            // Salvar em arquivo temporário para evitar corrupção
            const tempFile = `${conversationHistoryFile}.tmp`;
            fs.writeFileSync(tempFile, JSON.stringify(this.history, null, 2), 'utf8');
            fs.renameSync(tempFile, conversationHistoryFile);
        } catch (error) {
            console.error('Erro ao salvar histórico de conversas:', error);
        }
    },
    
    // Carregar histórico de conversas
    loadHistory: function() {
        if (fs.existsSync(conversationHistoryFile)) {
            try {
                const historyData = JSON.parse(fs.readFileSync(conversationHistoryFile, 'utf8'));
                this.history = historyData;
                console.log(`Histórico de conversas carregado para ${Object.keys(this.history).length} usuários`);
            } catch (error) {
                console.error('Erro ao carregar histórico de conversas:', error);
                this.tryRestoreFromBackup();
            }
        }
    },
    
    // Restaurar de backup
    tryRestoreFromBackup: function() {
        const backupFile = `${conversationHistoryFile}.bak`;
        if (fs.existsSync(backupFile)) {
            try {
                const historyData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
                this.history = historyData;
                console.log(`Histórico restaurado do backup`);
            } catch (error) {
                console.error('Erro ao restaurar do backup:', error);
                this.history = {};
            }
        } else {
            this.history = {};
        }
    },
    
    // Criar backup do histórico
    createBackup: function() {
        try {
            if (fs.existsSync(conversationHistoryFile)) {
                fs.copyFileSync(conversationHistoryFile, `${conversationHistoryFile}.bak`);
                console.log('Backup do histórico criado com sucesso');
            }
        } catch (error) {
            console.error('Erro ao criar backup:', error);
        }
    },
    
    // Adicionar mensagem ao histórico
    addMessage: function(userId, role, content) {
        if (!this.history[userId]) {
            this.history[userId] = [];
        }
        
        const userHistory = this.history[userId];
        userHistory.push({ role, content, timestamp: Date.now() });
        
        if (userHistory.length > MAX_HISTORY_MESSAGES) {
            this.history[userId] = userHistory.slice(-MAX_HISTORY_MESSAGES);
        }
        
        this.saveHistory();
    },
    
    // Obter histórico formatado para a API
    getUserConversation: function(userId) {
        const userHistory = this.history[userId] || [];
        return userHistory.map(msg => ({ role: msg.role, content: msg.content }));
    },
    
    // Limpar histórico de um usuário
    clearUserHistory: function(userId) {
        delete this.history[userId];
        this.saveHistory(true);
    },
    
    // Limpeza de históricos antigos
    cleanupOldHistories: function() {
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const now = Date.now();
        let cleanedCount = 0;
        
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
        
        if (cleanedCount > 0) {
            console.log(`Limpeza concluída: ${cleanedCount} históricos removidos`);
            this.saveHistory(true);
            this.createBackup();
        }
    },
    
    // Resumir histórico para economizar tokens
    summarizeHistory: function(userId) {
        if (!this.history[userId]) return;
        
        const userHistory = this.history[userId];
        if (userHistory.length < MAX_HISTORY_MESSAGES) return;
        
        // Usa o novo serviço de resumo
        const summarizedHistory = conversationSummarizer.summarize(
            userHistory,
            Math.floor(MAX_HISTORY_MESSAGES * 0.75)
        );
        
        this.history[userId] = summarizedHistory;
        this.saveHistory(true);
    }
};

// Agendamento da limpeza periódica e backup
const scheduleCleanup = () => {
    conversationManager.createBackup();
    
    setInterval(() => {
        console.log('Executando limpeza de históricos antigos...');
        conversationManager.cleanupOldHistories();
    }, HISTORY_CLEANUP_INTERVAL);
    
    setInterval(() => {
        console.log('Criando backup do histórico...');
        conversationManager.createBackup();
    }, 12 * 60 * 60 * 1000); // A cada 12 horas
};

module.exports = {
    addMessage: conversationManager.addMessage.bind(conversationManager),
    getUserConversation: conversationManager.getUserConversation.bind(conversationManager),
    clearUserHistory: conversationManager.clearUserHistory.bind(conversationManager),
    loadHistory: conversationManager.loadHistory.bind(conversationManager),
    summarizeHistory: conversationManager.summarizeHistory.bind(conversationManager),
    scheduleCleanup
};
