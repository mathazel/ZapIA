const fs = require('fs').promises;
const path = require('path');

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
        const backupPath = `${filePath}.bak`;
        
        try {
            // Verifica se arquivo original existe
            await fs.access(filePath);
            
            // Verifica se backup existe e compara conteúdos
            try {
                const [originalContent, backupContent] = await Promise.all([
                    fs.readFile(filePath, 'utf8'),
                    fs.readFile(backupPath, 'utf8')
                ]);

                if (originalContent === backupContent) {
                    return; // Conteúdo idêntico, não precisa backup
                }
            } catch {
                // Backup não existe ou não pode ser lido
            }

            // Cria backup
            await fs.copyFile(filePath, backupPath);
            console.log(`Backup criado: ${backupPath}`);
        } catch (error) {
            this.handleFileError(error, filePath);
        }
    }

    /**
     * Remove arquivos de backup
     * @param {string} filePath - Caminho do arquivo original
     * @returns {Promise<void>}
     */
    async removeBackup(filePath) {
        const backupPath = `${filePath}.bak`;
        
        try {
            await fs.access(backupPath);
            await fs.unlink(backupPath);
            console.log(`Backup removido: ${backupPath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') { // Ignora erro se arquivo não existe
                this.handleFileError(error, backupPath);
            }
        }
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