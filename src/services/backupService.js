const fs = require('fs').promises;
const path = require('path');
const AsyncLock = require('async-lock');

class BackupService {
    constructor() {
        this.lock = new AsyncLock({ timeout: 5000 });
        this.backupRegistry = new Map(); // Registra último backup de cada arquivo
        this.backupInterval = 3600000; // 1 hora em millisegundos
    }

    /**
     * Cria backup de um arquivo
     */
    async createBackup(filePath, force = false) {
        const backupPath = `${filePath}.bak`;
        const now = Date.now();
        
        try {
            // Verifica se já foi feito backup recentemente
            if (!force && this.backupRegistry.has(filePath)) {
                const lastBackup = this.backupRegistry.get(filePath);
                if (now - lastBackup < this.backupInterval) {
                    return;
                }
            }

            await this.lock.acquire(`backup-${filePath}`, async () => {
                // Verifica se arquivo existe
                await fs.access(filePath);

                // Cria diretório de backup se não existir
                const backupDir = path.dirname(backupPath);
                await fs.mkdir(backupDir, { recursive: true });

                // Copia arquivo para backup
                await fs.copyFile(filePath, backupPath);
                
                // Registra horário do backup
                this.backupRegistry.set(filePath, now);
                
                console.log(`Backup criado: ${backupPath}`);
            });
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Erro ao criar backup de ${filePath}:`, error);
                throw error;
            }
        }
    }

    /**
     * Restaura arquivo do backup
     */
    async restoreFromBackup(filePath) {
        const backupPath = `${filePath}.bak`;
        
        try {
            await this.lock.acquire(`restore-${filePath}`, async () => {
                // Verifica se backup existe
                await fs.access(backupPath);
                
                // Restaura do backup
                await fs.copyFile(backupPath, filePath);
                console.log(`Arquivo restaurado do backup: ${filePath}`);
                
                return true;
            });
        } catch (error) {
            console.error(`Erro ao restaurar backup de ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Agenda backup periódico
     */
    scheduleBackup(filePath, interval = this.backupInterval) {
        setInterval(async () => {
            try {
                await this.createBackup(filePath);
            } catch (error) {
                console.error(`Erro no backup agendado de ${filePath}:`, error);
            }
        }, interval);
    }

    /**
     * Remove backup antigo
     */
    async removeBackup(filePath) {
        const backupPath = `${filePath}.bak`;
        
        try {
            await fs.unlink(backupPath);
            this.backupRegistry.delete(filePath);
            console.log(`Backup removido: ${backupPath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Erro ao remover backup de ${filePath}:`, error);
            }
        }
    }
}

module.exports = new BackupService();