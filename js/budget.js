// Budget - Sistema gestione budget mensili

class BudgetManager {
    constructor() {
        this.budgets = [];
        this.loadBudgets();
    }

    // Crea nuovo budget
    createBudget(category, amount, month = new Date()) {
        const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;

        const budget = {
            id: generateId(),
            category,
            amount: parseFloat(amount),
            month: monthKey,
            spent: 0,
            createdAt: new Date().toISOString()
        };

        this.budgets.push(budget);
        this.saveBudgets();

        return budget;
    }

    // Update budget
    updateBudget(id, updates) {
        const index = this.budgets.findIndex(b => b.id === id);
        if (index !== -1) {
            this.budgets[index] = { ...this.budgets[index], ...updates };
            this.saveBudgets();
            return this.budgets[index];
        }
        return null;
    }

    // Delete budget
    deleteBudget(id) {
        this.budgets = this.budgets.filter(b => b.id !== id);
        this.saveBudgets();
    }

    // Get budget per categoria e mese
    getBudget(category, month = new Date()) {
        const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
        return this.budgets.find(b => b.category === category && b.month === monthKey);
    }

    // Get tutti i budget del mese
    getMonthBudgets(month = new Date()) {
        const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
        return this.budgets.filter(b => b.month === monthKey);
    }

    // Calcola spesa per categoria nel mese
    calculateSpent(category, transactions, month = new Date()) {
        const bounds = getMonthBounds(month);

        const categoryExpenses = transactions.filter(t =>
            t.type === 'out' &&
            t.category === category &&
            isDateInRange(t.timestamp || t.date, bounds.start, bounds.end)
        );

        return categoryExpenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    }

    // Update spent per tutti i budget
    updateAllSpent(transactions) {
        this.budgets.forEach(budget => {
            const month = new Date(budget.month + '-01');
            budget.spent = this.calculateSpent(budget.category, transactions, month);
        });

        this.saveBudgets();
    }

    // Get budget status
    getBudgetStatus(budget) {
        const percentage = (budget.spent / budget.amount) * 100;
        const remaining = budget.amount - budget.spent;

        let status = 'safe';
        if (percentage >= 100) status = 'exceeded';
        else if (percentage >= 80) status = 'warning';
        else if (percentage >= 60) status = 'caution';

        return {
            percentage: Math.min(percentage, 100),
            spent: budget.spent,
            remaining,
            status,
            overbudget: remaining < 0
        };
    }

    // Check se budget è stato superato
    checkBudgetAlerts(transactions) {
        const alerts = [];
        const currentBudgets = this.getMonthBudgets();

        currentBudgets.forEach(budget => {
            const spent = this.calculateSpent(budget.category, transactions);
            const percentage = (spent / budget.amount) * 100;

            if (percentage >= 80 && percentage < 100) {
                alerts.push({
                    type: 'warning',
                    budget,
                    percentage,
                    message: `Budget "${categoryManager.getCategory(budget.category)?.name}" al ${Math.round(percentage)}%`
                });
            } else if (percentage >= 100) {
                alerts.push({
                    type: 'exceeded',
                    budget,
                    percentage,
                    message: `Budget "${categoryManager.getCategory(budget.category)?.name}" superato del ${Math.round(percentage - 100)}%`
                });
            }
        });

        return alerts;
    }

    // Raccomandazioni budget
    suggestBudgets(transactions, months = 3) {
        const suggestions = {};

        // Analizza ultimi N mesi
        const categoryStats = categoryManager.getCategoryStats(transactions);

        categoryStats.forEach(stat => {
            if (stat.count > 0) {
                const avgMonthly = stat.total / months;
                const suggested = Math.ceil(avgMonthly * 1.1); // +10% buffer

                suggestions[stat.category.id] = {
                    category: stat.category,
                    suggested: suggested,
                    based_on_avg: avgMonthly
                };
            }
        });

        return suggestions;
    }

    // Save to storage
    saveBudgets() {
        storage.set('budgets', this.budgets);
    }

    // Load from storage
    loadBudgets() {
        this.budgets = storage.get('budgets', []);
    }

    // Export budgets
    exportBudgets() {
        return this.budgets;
    }

    // Import budgets
    importBudgets(data) {
        this.budgets = data;
        this.saveBudgets();
    }
}

// Singleton
const budgetManager = new BudgetManager();
