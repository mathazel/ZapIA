const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

/**
 * Sistema de gerenciamento de conversas com persistência
 * Mantém o histórico de mensagens e gerencia o ciclo de vida dos dados
 */
class ConversationManager {
  constructor() {
    this.history = {};
    this.lastSave = Date.now();
    this.saveInterval = config.SAVE_INTERVAL || 5000;
    this.dirty = false;
    this._saveTimeout = null;

    this.loadHistory();
  }

  /**
   * Inicializa o histórico a partir do armazenamento
   * Cria arquivo de histórico caso não exista
   */
  async loadHistory() {
    try {
      const data = await fs.readFile(config.conversationHistoryFile, 'utf8');
      this.history = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.history = {};
        const dir = path.dirname(config.conversationHistoryFile);
        await fs.mkdir(dir, { recursive: true });
        await this.saveHistory(true);
      } else {
        console.error('Erro ao carregar histórico:', error);
        this.history = {};
      }
    }
  }

  /**
   * Registra nova mensagem no histórico
   * @param {string} userId Identificador do usuário
   * @param {string} role Origem da mensagem (user/assistant)
   * @param {string} content Conteúdo da mensagem
   * @returns {Object|null} Mensagem adicionada ou null se inválida
   */
  addMessage(userId, role, content) {
    if (!userId || !role || !content) {
      console.warn('Tentativa de adicionar mensagem com parâmetros inválidos');
      return null;
    }

    if (!this.history[userId]) {
      this.history[userId] = [];
    }

    if (this.history[userId].length >= config.MAX_HISTORY_PER_USER) {
      this.history[userId] = this.history[userId].slice(-config.MAX_HISTORY_PER_USER + 1);
    }

    const message = { role, content, timestamp: Date.now() };
    this.history[userId].push(message);
    this.dirty = true;
    this.saveHistory();

    return message;
  }

  /**
   * Persiste histórico em disco com proteção contra corrupção
   * @param {boolean} force Força salvamento imediato ignorando intervalo
   */
  async saveHistory(force = false) {
    const now = Date.now();
    if (!force && !this.dirty) return;

    if (!force && now - this.lastSave < this.saveInterval) {
      if (!this._saveTimeout) {
        this._saveTimeout = setTimeout(() => {
          this._saveTimeout = null;
          this.saveHistory(true);
        }, this.saveInterval - (now - this.lastSave));
      }
      return;
    }

    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }

    try {
      const historyToSave = JSON.stringify(this.history, null, 2);
      const tempFile = `${config.conversationHistoryFile}.tmp`;

      await fs.writeFile(tempFile, historyToSave, 'utf8');
      await fs.rename(tempFile, config.conversationHistoryFile);

      this.lastSave = now;
      this.dirty = false;
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
      setTimeout(() => this.saveHistory(true), config.RETRY_SAVE_INTERVAL);
    }
  }

  getUserConversation(userId) {
    return this.history[userId] || [];
  }

  clearUserHistory(userId) {
    if (this.history[userId]) {
      delete this.history[userId];
      this.dirty = true;
      this.saveHistory();
      return true;
    }
    return false;
  }

  /**
   * Remove conversas inativas
   * @param {number} maxAge Tempo máximo de inatividade em ms (padrão 24h)
   */
  async cleanupOldHistories(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleanedCount = 0;

    Object.keys(this.history).forEach(userId => {
      const messages = this.history[userId];
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (now - lastMessage.timestamp > maxAge) {
          delete this.history[userId];
          cleanedCount++;
        }
      }
    });

    if (cleanedCount > 0) {
      this.dirty = true;
      await this.saveHistory(true);
    }
  }

  async close() {
    if (this.dirty) {
      await this.saveHistory(true);
    }
  }
}

const conversationManager = new ConversationManager();

process.on('SIGINT', async () => {
  await conversationManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await conversationManager.close();
  process.exit(0);
});

module.exports = conversationManager;
