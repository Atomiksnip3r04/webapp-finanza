// Categories - Sistema categorizzazione transazioni

const DEFAULT_CATEGORIES = [
    { id: 'food', name: 'Alimentari', icon: '🛒', color: '#10b981' },
    { id: 'transport', name: 'Trasporti', icon: '🚗', color: '#3b82f6' },
    { id: 'home', name: 'Casa', icon: '🏠', color: '#8b5cf6' },
    { id: 'health', name: 'Salute', icon: '⚕️', color: '#ef4444' },
    { id: 'entertainment', name: 'Svago', icon: '🎮', color: '#f59e0b' },
    { id: 'education', name: 'Educazione', icon: '📚', color: '#06b6d4' },
    { id: 'clothing', name: 'Abbigliamento', icon: '👕', color: '#ec4899' },
    { id: 'subscriptions', name: 'Abbonamenti', icon: '📱', color: '#6366f1' },
    { id: 'gifts', name: 'Regali', icon: '🎁', color: '#f43f5e' },
    { id: 'savings', name: 'Risparmi', icon: '💰', color: '#14b8a6' },
    { id: 'other', name: 'Altro', icon: '📦', color: '#64748b' }
];

class CategoryManager {
    constructor() {
        this.categories = [...DEFAULT_CATEGORIES];
        this.customCategories = [];
        this.patterns = this.initPatterns();
    }

    // Pattern per auto-categorizzazione
    initPatterns() {
        return {
            food: ['super', 'alimentari', 'spesa', 'lidl', 'coop', 'esselunga', 'conad', 'pizza', 'ristorante', 'bar', 'caffè'],
            transport: ['benzina', 'carburante', 'treno', 'autobus', 'taxi', 'uber', 'atm', 'trenitalia', 'italo'],
            home: ['affitto', 'bolletta', 'luce', 'gas', 'acqua', 'internet', 'telefono', 'condominio'],
            health: ['farmacia', 'medico', 'ospedale', 'dentista', 'analisi'],
            entertainment: ['cinema', 'teatro', 'concerto', 'museo', 'netflix', 'spotify', 'gaming'],
            education: ['libri', 'corso', 'università', 'scuola', 'formazione'],
            clothing: ['abbigliamento', 'scarpe', 'zara', 'h&m'],
            subscriptions: ['abbonamento', 'netflix', 'spotify', 'prime', 'disney'],
            gifts: ['regalo', 'compleanno'],
            savings: ['risparmio', 'investimento', 'deposito']
        };
    }

    // Auto-categorizza basandosi sulla descrizione
    autoCategorizeDinámico(description) {
        const desc = description.toLowerCase();

        for (const [categoryId, keywords] of Object.entries(this.patterns)) {
            for (const keyword of keywords) {
                if (desc.includes(keyword)) {
                    return categoryId;
                }
            }
        }

        return 'other'; // Default
    }

    // Get categoria by ID
    getCategory(id) {
        const all = [...this.categories, ...this.customCategories];
        return all.find(cat => cat.id === id);
    }

    // Get tutte le categorie
    getAllCategories() {
        return [...this.categories, ...this.customCategories];
    }

    // Aggiungi categoria custom
    addCustomCategory(name, icon = '📁', color = '#64748b') {
        const id = `custom_${Date.now()}`;
        const category = { id, name, icon, color, custom: true };
        this.customCategories.push(category);
        this.saveCustomCategories();
        return category;
    }

    // Rimuovi categoria custom
    removeCustomCategory(id) {
        this.customCategories = this.customCategories.filter(cat => cat.id !== id);
        this.saveCustomCategories();
    }

    // Load custom categories da storage
    loadCustomCategories() {
        const saved = storage.get('custom_categories', []);
        this.customCategories = saved;
    }

    // Save custom categories
    saveCustomCategories() {
        storage.set('custom_categories', this.customCategories);
    }

    // Statistiche per categoria
    getCategoryStats(transactions) {
        const stats = {};

        transactions.forEach(trans => {
            const catId = trans.category || 'other';
            if (!stats[catId]) {
                stats[catId] = {
                    category: this.getCategory(catId),
                    total: 0,
                    count: 0,
                    transactions: []
                };
            }

            if (trans.type === 'out') {
                stats[catId].total += trans.amount;
                stats[catId].count++;
                stats[catId].transactions.push(trans);
            }
        });

        return Object.values(stats).sort((a, b) => b.total - a.total);
    }

    // Get top categorie spesa
    getTopCategories(transactions, limit = 5) {
        const stats = this.getCategoryStats(transactions);
        return stats.slice(0, limit);
    }
}

// Singleton
const categoryManager = new CategoryManager();

// Auto-load custom categories
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        categoryManager.loadCustomCategories();
    });
}
