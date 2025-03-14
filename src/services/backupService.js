const fs = require('fs');
const path = require('path');
const { conversationHistoryFile } = require('../config/config');

class BackupService {
    constructor() {
        this.backupDir = path.join(process.cwd(), 'data', 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        // Configura o backup no encerramento
        process.on('SIGTERM', () => this.handleShutdown());
        process.on('SIGINT', () => this.handleShutdown());
    }

    async handleShutdown() {
        console.log('Iniciando backup de encerramento...');
        try {
            const fileName = path.basename(conversationHistoryFile);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `${fileName}.${timestamp}.bak`);
            
            await fs.promises.copyFile(conversationHistoryFile, backupPath);
            console.log(`Backup de encerramento concluído`);
            process.exit(0);
        } catch (error) {
            console.error('Erro no backup de encerramento:', error);
            process.exit(1);
        }
    }
}

module.exports = new BackupService();