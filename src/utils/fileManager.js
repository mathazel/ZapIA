const fs = require('fs').promises;
const path = require('path');

class FileManager {
    constructor() {
        this.initPromises = new Map();
        this._cleanupInterval = null;
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
     * Agenda limpeza periódica de arquivos temporários
     */
    scheduleCleanup() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }

        this._cleanupInterval = setInterval(async () => {
            try {
                console.log('Iniciando limpeza de arquivos temporários...');
                await this.cleanupTempFiles();
            } catch (error) {
                console.error('Erro durante limpeza de arquivos:', error);
            }
        }, 24 * 60 * 60 * 1000); // A cada 24 horas

        console.log('Limpeza automática de arquivos agendada');
    }

    /**
     * Limpa arquivos temporários antigos
     */
    async cleanupTempFiles() {
        const tempDir = path.join(process.cwd(), 'data', 'temp');

        try {
            // Primeiro verifica se o diretório existe
            try {
                await fs.access(tempDir);
            } catch {
                // Se não existir, cria o diretório
                await fs.mkdir(tempDir, { recursive: true });
                console.log(`Diretório temporário criado: ${tempDir}`);
                return; // Retorna pois não há arquivos para limpar ainda
            }

            // Lê os arquivos do diretório
            const files = await fs.readdir(tempDir);
            const now = Date.now();
            let cleanedCount = 0;

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    
                    // Remove arquivos mais antigos que 24 horas
                    if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                    }
                } catch (error) {
                    // Se houver erro ao acessar um arquivo específico, 
                    // loga e continua com os próximos
                    console.warn(`Erro ao processar arquivo ${filePath}:`, error.message);
                    continue;
                }
            }

            if (cleanedCount > 0) {
                console.log(`${cleanedCount} arquivos temporários removidos`);
            } else {
                console.log('Nenhum arquivo temporário antigo encontrado');
            }
        } catch (error) {
            console.error('Erro durante limpeza de arquivos temporários:', error);
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
    }

    /**
     * Limpa recursos ao encerrar
     */
    close() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
    }
}

// Singleton
const fileManager = new FileManager();

// Cleanup ao encerrar
process.on('SIGINT', () => {
    fileManager.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    fileManager.close();
    process.exit(0);
});

module.exports = fileManager;
