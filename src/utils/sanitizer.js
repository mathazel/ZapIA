/**
 * Utilitário de sanitização de dados
 */
class Sanitizer {
    // Mapa de caracteres especiais HTML para escape
    static htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    /**
     * Escapa caracteres especiais HTML
     */
    static escapeHtml(str) {
        return String(str).replace(/[&<>"'`=\/]/g, char => this.htmlEscapes[char]);
    }

    /**
     * Sanitiza input genérico
     */
    static sanitizeGeneral(input) {
        if (typeof input !== 'string') {
            input = String(input);
        }

        return this.escapeHtml(input)
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 255);
    }

    /**
     * Sanitiza ID do WhatsApp
     */
    static sanitizeWhatsAppId(id) {
        if (!id) return '';
        
        // IDs do WhatsApp só devem conter números e sufixos específicos
        const cleanId = String(id)
            .replace(/[^\d@.s-]/g, '')
            .replace(/(@s\.whatsapp\.net|@g\.us)$/g, '');
            
        return cleanId ? cleanId + '@s.whatsapp.net' : '';
    }

    /**
     * Sanitiza mensagem
     */
    static sanitizeMessage(message) {
        if (!message) return '';
        
        return this.escapeHtml(String(message))
            .trim()
            .slice(0, 4096);
    }

    /**
     * Sanitiza nome de arquivo
     */
    static sanitizeFileName(fileName) {
        if (!fileName) return '';

        // Remove caracteres perigosos para nomes de arquivo
        return String(fileName)
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
            .replace(/\s+/g, '_')
            .trim();
    }

    /**
     * Sanitiza URL
     */
    static sanitizeUrl(url) {
        if (!url) return '';

        try {
            const parsed = new URL(String(url));
            // Aceita apenas http e https
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return '';
            }
            return parsed.toString();
        } catch {
            return '';
        }
    }

    /**
     * Remove scripts e atributos perigosos de HTML
     */
    static sanitizeHtml(html) {
        return String(html)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/(on\w+)="[^"]*"/g, '')
            .replace(/(on\w+)='[^']*'/g, '')
            .replace(/javascript:[^\s]*/g, '');
    }
}

module.exports = Sanitizer;