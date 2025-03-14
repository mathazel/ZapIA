class Sanitizer {
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
}

module.exports = Sanitizer;