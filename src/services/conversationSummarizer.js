class ConversationSummarizer {
    constructor() {
        this.stopWords = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'e', 'ou', 'de', 'para']);
    }

    summarize(messages, maxTokens = 2000) {
        if (!messages || messages.length < 3) return messages;

        const messageGroups = this.groupMessagesByContext(messages);
        return this.optimizeHistory(messageGroups, maxTokens);
    }

    groupMessagesByContext(messages) {
        const groups = [];
        let currentGroup = {
            messages: [],
            importance: 0,
            context: '',
            tokens: 0
        };

        messages.forEach((msg, index) => {
            const importance = this.calculateMessageImportance(msg, index, messages);
            
            // Condição para iniciar um novo grupo
            if (this.shouldStartNewGroup(msg, currentGroup, importance)) {
                if (currentGroup.messages.length > 0) {
                    groups.push({...currentGroup});
                }
                currentGroup = {
                    messages: [msg],
                    importance: importance,
                    context: this.extractContext(msg),
                    tokens: this.estimateTokens(msg)
                };
            } else {
                currentGroup.messages.push(msg);
                currentGroup.importance = Math.max(currentGroup.importance, importance);
                currentGroup.tokens += this.estimateTokens(msg);
            }
        });

        if (currentGroup.messages.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    calculateMessageImportance(message, index, allMessages) {
        let importance = 0;

        // A importância de mensagens recentes aumenta
        const recency = index / allMessages.length;
        importance += recency * 0.3;

        // Mensagens do sistema têm peso especial
        if (message.role === 'system') {
            importance += 0.4;
        }

        // Identifica palavras-chave no conteúdo da mensagem
        const hasKeywords = /\b(define|explique|resumo|importante|urgente)\b/i.test(message.content);
        if (hasKeywords) {
            importance += 0.2;
        }

        // Verifica se é um novo tópico com base na análise de conteúdo
        if (index > 0 && this.isNewTopic(message, allMessages[index - 1])) {
            importance += 0.25;
        }

        return Math.min(importance, 1);
    }

    optimizeHistory(groups, maxTokens) {
        // Ordena os grupos pela importância e tenta otimizar o número de tokens
        groups.sort((a, b) => b.importance - a.importance);

        const optimizedHistory = [];
        let totalTokens = 0;

        groups.forEach(group => {
            if (totalTokens + group.tokens <= maxTokens) {
                optimizedHistory.push(...group.messages);
                totalTokens += group.tokens;
            } else if (group.importance > 0.7) {
                // Resumo de grupos muito importantes
                const summary = this.summarizeGroup(group);
                const summaryTokens = this.estimateTokens(summary);
                
                if (totalTokens + summaryTokens <= maxTokens) {
                    optimizedHistory.push(summary);
                    totalTokens += summaryTokens;
                }
            }
        });

        return optimizedHistory;
    }

    summarizeGroup(group) {
        const context = group.context || 'Conversa';
        const messageCount = group.messages.length;
        
        return {
            role: 'system',
            content: `[Resumo de ${messageCount} mensagens sobre ${context}]`,
            timestamp: Date.now(),
            isSystemSummary: true
        };
    }

    isNewTopic(currentMsg, previousMsg) {
        if (!previousMsg) return true;

        const currentTopics = this.extractKeywords(currentMsg.content);
        const previousTopics = this.extractKeywords(previousMsg.content);
        
        return this.calculateTopicOverlap(currentTopics, previousTopics) < 0.3;
    }

    extractKeywords(text) {
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        return new Set(words.filter(word => !this.stopWords.has(word)));
    }

    calculateTopicOverlap(set1, set2) {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }

    estimateTokens(message) {
        // Estimativa melhorada de tokens, agora usando uma média mais realista
        return Math.ceil(message.content.length / 3);
    }

    shouldStartNewGroup(message, currentGroup, importance) {
        if (currentGroup.messages.length === 0) return true;
        if (importance > 0.8) return true;
        if (this.isNewTopic(message, currentGroup.messages[currentGroup.messages.length - 1])) return true;
        return false;
    }

    extractContext(message) {
        // Melhor extração de contexto: agora considera as 3 palavras-chave mais relevantes
        const keywords = Array.from(this.extractKeywords(message.content));
        return keywords.slice(0, 3).join(', ') || 'Geral';
    }
}

module.exports = new ConversationSummarizer();
