const fs = require('fs').promises;
const path = require('path');
const backupService = require('../services/backupService');

class FileManager {
    constructor() {
        this.initPromises = new Map();
    }

    /**
     * Verifica e cria diretório e arquivo se necessário
     * @param {string} filePath - Caminho completo do arquivo
     * @param {string|object} defaultContent - Conteúdo padrão caso o arquivo precise ser criado
     * @returns {Promise<void>}
     */
    async ensureFileAndDirectoryExists(filePath, defaultContent = '') {
        // Evita múltiplas inicializações simultâneas do mesmo arquivo
        if (this.initPromises.has(filePath)) {
            return this.initPromises.get(filePath);
        }

        const initPromise = (async () => {
            try {
                const dir = path.dirname(filePath);
                
                // Verifica permissões do diretório
                try {
                    await fs.access(dir);
                } catch {
                    await fs.mkdir(dir, { recursive: true });
                    console.log(`Diretório criado: ${dir}`);
                }

                // Verifica permissões do arquivo
                try {
                    await fs.access(filePath);
                } catch {
                    const content = typeof defaultContent === 'object' 
                        ? JSON.stringify(defaultContent, null, 2)
                        : defaultContent;
                    
                    await fs.writeFile(filePath, content, 'utf8');
                    console.log(`Arquivo criado: ${filePath}`);
                }
            } catch (error) {
                this.handleFileError(error, filePath);
            } finally {
                this.initPromises.delete(filePath);
            }
        })();

        this.initPromises.set(filePath, initPromise);
        return initPromise;
    }

    /**
     * Gerencia backups incrementais
     * @param {string} filePath - Caminho do arquivo original
     * @returns {Promise<void>}
     */
    async createIncrementalBackup(filePath) {
        await backupService.createBackup(filePath);
    }

    /**
     * Remove arquivos de backup
     * @param {string} filePath - Caminho do arquivo original
     * @returns {Promise<void>}
     */
    async removeBackup(filePath) {
        await backupService.removeBackup(filePath);
    }

    /**
     * Tratamento centralizado de erros de arquivo
     * @param {Error} error - Erro ocorrido
     * @param {string} filePath - Caminho do arquivo
     */
    handleFileError(error, filePath) {
        const errorDetails = {
            code: error.code,
            message: error.message,
            path: filePath,
            timestamp: new Date().toISOString(),
            stack: error.stack
        };

        console.error('Erro em operação de arquivo:', errorDetails);

        switch (error.code) {
            case 'EACCES':
                throw new Error(`Sem permissão para acessar: ${filePath}`);
            case 'ENOSPC':
                throw new Error('Sem espaço em disco');
            default:
                throw error;
        }
    }
}

module.exports = new FileManager();